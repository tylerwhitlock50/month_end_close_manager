"""Utilities for importing NetSuite Trial Balance exports.

The default NetSuite CSV export places company metadata in the first few
rows, followed by a header row with "Account", "Debit", and "Credit"
columns (and occasionally an "Amount" column). Account numbers and names
are combined in the "Account" column using the pattern
"<number> - <name>". Summary rows prefixed with "Total -" and hierarchy
parents without numeric values should be ignored.

This module normalises the exported CSV into the shape expected by the
standard trial balance importer. It handles:

* Skipping preamble/header lines prior to the account table
* Ignoring subtotal rows ("Total - …") and section headers with no
  balance data
* Splitting the combined account column into number + name
* Parsing currency strings that may include currency symbols, commas, or
  parentheses
* Deriving ending balances when only debit/credit columns are present
* Capturing metadata such as entity name and period description
* Returning warnings for rows that could not be parsed cleanly
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Iterable, List, Optional


ACCOUNT_PATTERN = re.compile(r"^\s*(?P<number>[^-]+?)(?:\s*-\s*(?P<name>.+))?\s*$")
TOTAL_PREFIX = "total - "


@dataclass
class ParsedAccount:
    """Represents a normalized account row from a NetSuite export."""

    account_number: str
    account_name: str
    debit: Optional[Decimal]
    credit: Optional[Decimal]
    ending_balance: Optional[Decimal]
    account_type: Optional[str] = None
    source_row: dict[str, str] = field(default_factory=dict)


@dataclass
class NetSuiteTrialBalanceResult:
    """Return value for :func:`parse_netsuite_trial_balance`."""

    accounts: List[ParsedAccount]
    total_debit: Optional[Decimal]
    total_credit: Optional[Decimal]
    total_balance: Optional[Decimal]
    metadata: dict[str, Optional[str]]
    warnings: List[str] = field(default_factory=list)


def _parse_decimal(raw_value: Optional[str]) -> Optional[Decimal]:
    """Convert NetSuite-style currency strings into ``Decimal`` objects."""

    if raw_value is None:
        return None

    value = raw_value.strip()
    if not value:
        return None

    value = value.replace(",", "")
    if value.startswith("$"):
        value = value[1:]
    if value.endswith("$"):
        value = value[:-1]
    if value.startswith("(") and value.endswith(")"):
        value = f"-{value[1:-1]}"

    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _normalise_headers(fieldnames: Iterable[str]) -> list[str]:
    return [name.strip() for name in fieldnames]


def _find_column(fieldnames: Iterable[str], *candidates: str) -> Optional[str]:
    lookup = {name.lower(): name for name in fieldnames}
    for candidate in candidates:
        key = candidate.lower()
        if key in lookup:
            return lookup[key]
    # fallback to startswith / contains matching
    for field in fieldnames:
        lowered = field.lower()
        if any(candidate.lower() in lowered for candidate in candidates):
            return field
    return None


def _extract_metadata(preamble_lines: List[str]) -> dict[str, Optional[str]]:
    metadata: dict[str, Optional[str]] = {
        "entity": None,
        "preamble": None,
        "period_label": None,
        "generated_at": None,
    }

    if preamble_lines:
        metadata["entity"] = preamble_lines[0].strip('" ')
    if len(preamble_lines) > 1:
        metadata["preamble"] = preamble_lines[1].strip()
    if len(preamble_lines) > 2:
        metadata["period_label"] = preamble_lines[2].strip()
    if len(preamble_lines) > 3:
        metadata["generated_at"] = preamble_lines[3].strip()

    return metadata


def parse_netsuite_trial_balance(content: str) -> NetSuiteTrialBalanceResult:
    """Parse the raw NetSuite export into normalized account records.

    Parameters
    ----------
    content:
        The raw CSV content (decoded text). The helper is resilient to
        BOM markers and preamble lines.
    """

    # Normalise newlines and strip BOM if present
    normalised = content.replace("\r\n", "\n").replace("\r", "\n")
    if normalised.startswith("\ufeff"):
        normalised = normalised[1:]

    all_lines = normalised.split("\n")

    header_index = None
    for idx, line in enumerate(all_lines):
        lowered = line.lower()
        if "account" in lowered and "debit" in lowered and "credit" in lowered and "," in line:
            header_index = idx
            break

    if header_index is None:
        raise ValueError("Unable to locate NetSuite Trial Balance header row")

    data_lines = [line for line in all_lines[header_index:] if line.strip()]
    csv_stream = io.StringIO("\n".join(data_lines))
    reader = csv.reader(csv_stream)

    try:
        raw_headers = next(reader)
    except StopIteration as exc:  # pragma: no cover - defensive
        raise ValueError("NetSuite export is missing data rows") from exc

    headers = _normalise_headers(raw_headers)
    # Build DictReader using the stripped headers to simplify downstream logic
    csv_stream.seek(0)
    dict_reader = csv.DictReader(csv_stream, fieldnames=headers)

    account_col = _find_column(headers, "account")
    debit_col = _find_column(headers, "debit")
    credit_col = _find_column(headers, "credit")
    balance_col = _find_column(headers, "amount", "balance", "net amount")
    account_type_col = _find_column(headers, "type")

    if not account_col:
        raise ValueError("NetSuite export missing 'Account' column")

    accounts: List[ParsedAccount] = []
    warnings: List[str] = []
    total_debit: Optional[Decimal] = Decimal("0") if debit_col else None
    total_credit: Optional[Decimal] = Decimal("0") if credit_col else None
    total_balance: Optional[Decimal] = Decimal("0") if balance_col else Decimal("0")
    reported_total_debit: Optional[Decimal] = None
    reported_total_credit: Optional[Decimal] = None
    reported_total_balance: Optional[Decimal] = None

    # Skip header row for the DictReader by advancing once
    next(dict_reader, None)

    for row in dict_reader:
        account_raw = (row.get(account_col) or "").strip().strip('"')
        if not account_raw:
            continue

        lowered = account_raw.lower()
        normalized_account = lowered.replace(":", "").strip()

        if normalized_account == "total":
            reported_total_debit = _parse_decimal(row.get(debit_col)) if debit_col else None
            reported_total_credit = _parse_decimal(row.get(credit_col)) if credit_col else None
            reported_total_balance = _parse_decimal(row.get(balance_col)) if balance_col else None
            continue

        if lowered.startswith(TOTAL_PREFIX) or (normalized_account.startswith("total") and "-" not in account_raw):
            # Subtotal rows should be ignored
            continue

        match = ACCOUNT_PATTERN.match(account_raw)
        if not match:
            warnings.append(f"Unable to parse account column: '{account_raw}'")
            continue

        account_number = (match.group("number") or "").strip()
        account_name = (match.group("name") or "").strip()

        debit_value = _parse_decimal(row.get(debit_col)) if debit_col else None
        credit_value = _parse_decimal(row.get(credit_col)) if credit_col else None
        balance_value = _parse_decimal(row.get(balance_col)) if balance_col else None

        if balance_value is None and (debit_value is not None or credit_value is not None):
            debit_component = debit_value or Decimal("0")
            credit_component = credit_value or Decimal("0")
            balance_value = debit_component - credit_component

        if balance_value is None and debit_value is None and credit_value is None:
            # Likely a hierarchy header with no amounts
            continue

        account_type = (row.get(account_type_col) or "").strip() if account_type_col else None

        parsed_account = ParsedAccount(
            account_number=account_number,
            account_name=account_name or account_number,
            debit=debit_value,
            credit=credit_value,
            ending_balance=balance_value,
            account_type=account_type or None,
            source_row={key: (value or "").strip() for key, value in row.items()},
        )
        accounts.append(parsed_account)

        if debit_value is not None and total_debit is not None:
            total_debit += debit_value
        if credit_value is not None and total_credit is not None:
            total_credit += credit_value
        if balance_value is not None and total_balance is not None:
            total_balance += balance_value

    metadata = _extract_metadata(all_lines[:header_index])

    def _compare_totals(label: str, reported: Optional[Decimal], computed: Optional[Decimal]) -> None:
        if reported is None or computed is None:
            return
        if reported != computed:
            warnings.append(
                f"NetSuite reported total {label} {reported} but calculated total is {computed}"
            )

    _compare_totals("debit", reported_total_debit, total_debit)
    _compare_totals("credit", reported_total_credit, total_credit)
    _compare_totals("balance", reported_total_balance, total_balance)

    return NetSuiteTrialBalanceResult(
        accounts=accounts,
        total_debit=total_debit,
        total_credit=total_credit,
        total_balance=total_balance,
        metadata=metadata,
        warnings=warnings,
    )


__all__ = [
    "ParsedAccount",
    "NetSuiteTrialBalanceResult",
    "parse_netsuite_trial_balance",
]
