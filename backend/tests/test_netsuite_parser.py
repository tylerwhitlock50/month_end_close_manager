from decimal import Decimal
from pathlib import Path

import pytest

from backend.services.netsuite_parser import parse_netsuite_trial_balance


@pytest.fixture()
def sample_netsuite_csv() -> str:
    sample_path = Path("netsuite_file/TrialBalance677.csv")
    if not sample_path.exists():
        pytest.skip("Sample NetSuite trial balance file is missing")
    return sample_path.read_text(encoding="utf-8")


def test_parser_extracts_accounts_and_totals(sample_netsuite_csv):
    result = parse_netsuite_trial_balance(sample_netsuite_csv)

    assert result.accounts, "Expected at least one account to be parsed"
    assert not result.warnings, f"Unexpected warnings: {result.warnings}"

    numbers = {account.account_number for account in result.accounts}
    assert "10010" in numbers
    assert "12050" in numbers
    assert "25061" in numbers

    checking = next(account for account in result.accounts if account.account_number == "10010")
    assert checking.debit == Decimal("165289.63")
    assert checking.credit in (None, Decimal("0"))

    allowance = next(account for account in result.accounts if account.account_number == "12090")
    assert allowance.credit == Decimal("759638.37")

    assert result.total_balance is not None
    assert result.total_balance > Decimal("0")


def test_parser_skips_totals_and_headers(sample_netsuite_csv):
    result = parse_netsuite_trial_balance(sample_netsuite_csv)

    # NetSuite emits summary rows like "Total - 10010 - Checking Account" which should not appear
    assert all(
        not account.account_name.lower().startswith("total -")
        for account in result.accounts
    )

    # Parent headers with no balances should be excluded (e.g., "10000 - Cash" with blank amounts)
    assert "10000" not in {account.account_number for account in result.accounts}


def test_parser_excludes_overall_total_row(sample_netsuite_csv):
    result = parse_netsuite_trial_balance(sample_netsuite_csv)

    # A trailing "Total" row should be ignored and used only for reconciliation
    assert all(account.account_name.lower() != "total" for account in result.accounts)
    assert result.warnings == []


def test_parser_surfaces_metadata(sample_netsuite_csv):
    result = parse_netsuite_trial_balance(sample_netsuite_csv)

    assert result.metadata["entity"] == "Future Comp, LLC"
    assert result.metadata["period_label"] == "Trial Balance"
    assert result.metadata["generated_at"].startswith("End of ")
