import csv
import io
import os
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone, date
from pathlib import Path
from typing import List, Optional
import calendar

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    status,
    File as FastAPIFile,
    Form
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload

from backend.auth import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.models import (
    TrialBalance as TrialBalanceModel,
    TrialBalanceAccount as TrialBalanceAccountModel,
    TrialBalanceAttachment as TrialBalanceAttachmentModel,
    TrialBalanceValidation as TrialBalanceValidationModel,
    Period as PeriodModel,
    Task as TaskModel,
    TaskTemplate as TaskTemplateModel,
    User as UserModel,
    File as FileModel,
    Approval as ApprovalModel,
    TaskStatus,
    ApprovalStatus,
)
from backend.schemas import (
    TrialBalance,
    TrialBalanceSummary,
    TrialBalanceAccount,
    TrialBalanceAccountUpdate,
    TrialBalanceAccountTasksUpdate,
    TrialBalanceAttachment,
    TrialBalanceAttachmentLink,
    TrialBalanceValidation,
    TrialBalanceComparison,
    TrialBalanceComparisonAccount,
    TrialBalanceAccountTaskCreate,
    TaskWithRelations,
    TaskSummary,
    MissingTaskSuggestion,
)
from backend.services.trial_balance_linker import auto_link_tasks_to_trial_balance_accounts
from backend.services.netsuite_parser import parse_netsuite_trial_balance


router = APIRouter(prefix="/api/trial-balance", tags=["trial-balance"])


BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATE_PATH = BASE_DIR / "resources" / "trial_balance_template.csv"


ACCOUNT_NUMBER_COLUMNS = [
    "account number",
    "account",
    "number",
    "acct",
    "acct number"
]
ACCOUNT_NAME_COLUMNS = [
    "account name",
    "name",
    "acct name"
]
ACCOUNT_TYPE_COLUMNS = [
    "account type",
    "type"
]
DEBIT_COLUMNS = [
    "debit",
    "debits"
]
CREDIT_COLUMNS = [
    "credit",
    "credits"
]
BALANCE_COLUMNS = [
    "ending balance",
    "balance",
    "amount",
    "net amount",
    "ending amt"
]


def _find_column(fieldnames, candidates):
    if not fieldnames:
        return None

    normalized = {name.lower().strip(): name for name in fieldnames}
    for candidate in candidates:
        key = candidate.lower().strip()
        if key in normalized:
            return normalized[key]

    for name in fieldnames:
        lowered = name.lower().strip()
        for candidate in candidates:
            if candidate.lower() in lowered:
                return name

    return None


def _parse_decimal(raw_value: Optional[str]) -> Optional[Decimal]:
    if raw_value is None:
        return None

    value = raw_value.strip()
    if not value:
        return None

    value = value.replace(",", "")
    if value.startswith("$"):
        value = value[1:]
    if value.startswith("(") and value.endswith(")"):
        value = f"-{value[1:-1]}"

    try:
        return Decimal(value)
    except (InvalidOperation, ValueError):
        return None


def _store_import_file(trial_balance_id: int, original_filename: str, content: bytes) -> tuple[str, str]:
    safe_name = original_filename or "trial_balance.csv"
    extension = os.path.splitext(safe_name)[1]
    stored_filename = f"{uuid.uuid4()}{extension}"

    base_dir = os.path.join(settings.file_storage_path, "trial_balances", str(trial_balance_id))
    os.makedirs(base_dir, exist_ok=True)

    file_path = os.path.join(base_dir, stored_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    return stored_filename, file_path


def _store_validation_file(trial_balance_id: int, account_id: int, original_filename: str, content: bytes) -> tuple[str, str, str]:
    safe_name = original_filename or "validation_support"
    extension = os.path.splitext(safe_name)[1]
    stored_filename = f"{uuid.uuid4()}{extension}"

    base_dir = os.path.join(
        settings.file_storage_path,
        "trial_balances",
        str(trial_balance_id),
        str(account_id),
        "validations"
    )
    os.makedirs(base_dir, exist_ok=True)

    file_path = os.path.join(base_dir, stored_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    relative_path = os.path.relpath(file_path, settings.file_storage_path)

    return stored_filename, file_path, relative_path


def _compute_validation_metrics(account: TrialBalanceAccountModel, supporting_amount: Decimal) -> tuple[Decimal, Decimal, bool]:
    account_balance = account.ending_balance if account.ending_balance is not None else Decimal("0")
    difference = supporting_amount - account_balance
    matches = difference == Decimal("0")
    return account_balance, difference, matches


def _get_previous_period(db: Session, period: PeriodModel) -> Optional[PeriodModel]:
    """Locate the most recent prior period with the same close type."""

    prev_month = period.month - 1
    prev_year = period.year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    candidate = (
        db.query(PeriodModel)
        .filter(
            PeriodModel.close_type == period.close_type,
            PeriodModel.year == prev_year,
            PeriodModel.month == prev_month,
        )
        .order_by(PeriodModel.id.desc())
        .first()
    )

    if candidate:
        return candidate

    # Fallback: find the immediately preceding period chronologically
    return (
        db.query(PeriodModel)
        .filter(PeriodModel.close_type == period.close_type)
        .filter(
            (PeriodModel.year < period.year)
            | ((PeriodModel.year == period.year) & (PeriodModel.month < period.month))
        )
        .order_by(PeriodModel.year.desc(), PeriodModel.month.desc())
        .first()
    )


def _map_task_to_summary(task: TaskModel) -> TaskSummary:
    return TaskSummary.model_validate(task, from_attributes=True)


def _build_task_payload(db: Session, task: TaskModel) -> dict:
    file_count = db.query(FileModel).filter(FileModel.task_id == task.id).count()
    pending_approvals = (
        db.query(ApprovalModel)
        .filter(ApprovalModel.task_id == task.id, ApprovalModel.status == ApprovalStatus.PENDING)
        .count()
    )

    payload = TaskWithRelations.model_validate(task, from_attributes=True).model_dump()
    payload["owner"] = task.owner
    payload["assignee"] = task.assignee
    payload["period"] = task.period
    payload["file_count"] = file_count
    payload["pending_approvals"] = pending_approvals
    payload["dependencies"] = [dep.id for dep in task.dependencies]
    payload["dependency_details"] = [
        _map_task_to_summary(dep).model_dump()
        for dep in task.dependencies
    ]
    payload["dependent_details"] = [
        _map_task_to_summary(dep).model_dump()
        for dep in task.dependent_tasks
    ]
    return payload


def _calculate_template_offset(period: PeriodModel, due_date: Optional[datetime]) -> int:
    if not due_date:
        return 0

    if period.target_close_date:
        anchor = period.target_close_date
    else:
        last_day = calendar.monthrange(period.year, period.month)[1]
        anchor = date(period.year, period.month, last_day)

    if due_date.tzinfo is not None:
        due = due_date.astimezone(timezone.utc).date()
    else:
        due = due_date.date()

    return (due - anchor).days


def _format_notes_from_metadata(metadata: dict, warnings: list[str]) -> Optional[str]:
    parts: list[str] = []

    entity = metadata.get("entity")
    if entity:
        parts.append(f"Entity: {entity}")

    label = metadata.get("period_label")
    if label:
        parts.append(f"Label: {label}")

    generated_at = metadata.get("generated_at")
    if generated_at:
        parts.append(f"Generated: {generated_at}")

    if warnings:
        joined = "; ".join(warnings)
        parts.append(f"Warnings: {joined}")

    if not parts:
        return None

    return " | ".join(parts)


def _get_latest_trial_balance(db: Session, period_id: int) -> Optional[TrialBalanceModel]:
    return (
        db.query(TrialBalanceModel)
        .filter(TrialBalanceModel.period_id == period_id)
        .order_by(TrialBalanceModel.uploaded_at.desc())
        .first()
    )


def _delete_existing_trial_balance_files(db: Session, *, period_id: int) -> None:
    db.query(FileModel).filter(
        FileModel.period_id == period_id,
        FileModel.description.ilike("Trial balance import%")
    ).delete(synchronize_session=False)


def _record_trial_balance_upload(
    db: Session,
    *,
    period_id: int,
    trial_balance: TrialBalanceModel,
    original_filename: str,
    stored_filename: str,
    file_path: str,
    file_size: int,
    mime_type: Optional[str],
    uploaded_by_id: Optional[int]
) -> None:
    description = f"Trial balance import (TB #{trial_balance.id})"
    file_record = FileModel(
        period_id=period_id,
        filename=stored_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        description=description,
        uploaded_by_id=uploaded_by_id,
        is_external_link=False,
    )
    db.add(file_record)


@router.get("/template")
async def download_trial_balance_template(
    current_user: UserModel = Depends(get_current_user)
):
    if not TEMPLATE_PATH.exists():
        raise HTTPException(status_code=500, detail="Trial balance template is missing")

    return FileResponse(
        path=str(TEMPLATE_PATH),
        media_type="text/csv",
        filename="trial_balance_template.csv"
    )


@router.get("/period/{period_id}", response_model=List[TrialBalance])
async def list_trial_balances(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Return all trial balance imports for a given period."""
    period_exists = db.query(PeriodModel.id).filter(PeriodModel.id == period_id).first()
    if not period_exists:
        raise HTTPException(status_code=404, detail="Period not found")

    trial_balances = (
        db.query(TrialBalanceModel)
        .options(selectinload(TrialBalanceModel.accounts))
        .filter(TrialBalanceModel.period_id == period_id)
        .order_by(TrialBalanceModel.uploaded_at.desc())
        .all()
    )

    if not trial_balances:
        return []

    return trial_balances


@router.post("/{period_id}/import", response_model=TrialBalanceSummary, status_code=status.HTTP_201_CREATED)
async def import_trial_balance(
    period_id: int,
    replace_existing: bool = False,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        decoded = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_bytes.decode("latin-1")

    file_size = len(raw_bytes)

    csv_stream = io.StringIO(decoded)
    reader = csv.DictReader(csv_stream)

    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV header row is missing")

    account_number_col = _find_column(reader.fieldnames, ACCOUNT_NUMBER_COLUMNS)
    account_name_col = _find_column(reader.fieldnames, ACCOUNT_NAME_COLUMNS)
    debit_col = _find_column(reader.fieldnames, DEBIT_COLUMNS)
    credit_col = _find_column(reader.fieldnames, CREDIT_COLUMNS)
    balance_col = _find_column(reader.fieldnames, BALANCE_COLUMNS)
    account_type_col = _find_column(reader.fieldnames, ACCOUNT_TYPE_COLUMNS)

    if not account_number_col or not account_name_col:
        raise HTTPException(status_code=400, detail="CSV must include account number and account name columns")

    if not balance_col and not (debit_col or credit_col):
        raise HTTPException(status_code=400, detail="CSV must include either an ending balance column or debit/credit columns")

    accounts_to_create = []
    total_debit: Optional[Decimal] = Decimal("0") if debit_col else None
    total_credit: Optional[Decimal] = Decimal("0") if credit_col else None
    total_balance: Optional[Decimal] = Decimal("0") if balance_col else Decimal("0")

    for row in reader:
        account_number = (row.get(account_number_col) or "").strip()
        account_name = (row.get(account_name_col) or "").strip()

        if not account_number and not account_name:
            continue

        debit_value = _parse_decimal(row.get(debit_col)) if debit_col else None
        credit_value = _parse_decimal(row.get(credit_col)) if credit_col else None
        balance_value = _parse_decimal(row.get(balance_col)) if balance_col else None

        if balance_value is None and (debit_value is not None or credit_value is not None):
            debit_component = debit_value or Decimal("0")
            credit_component = credit_value or Decimal("0")
            balance_value = debit_component - credit_component

        account_entry = {
            "account_number": account_number,
            "account_name": account_name,
            "account_type": (row.get(account_type_col) or "").strip() if account_type_col else None,
            "debit": debit_value,
            "credit": credit_value,
            "ending_balance": balance_value
        }
        accounts_to_create.append(account_entry)

        if debit_value is not None:
            if total_debit is None:
                total_debit = Decimal("0")
            total_debit += debit_value
        if credit_value is not None:
            if total_credit is None:
                total_credit = Decimal("0")
            total_credit += credit_value
        if balance_value is not None:
            if total_balance is None:
                total_balance = Decimal("0")
            total_balance += balance_value

    if not accounts_to_create:
        raise HTTPException(status_code=400, detail="No account rows were detected in the CSV")

    if replace_existing:
        existing = db.query(TrialBalanceModel).filter(TrialBalanceModel.period_id == period_id).all()
        _delete_existing_trial_balance_files(db, period_id=period_id)
        for tb in existing:
            db.delete(tb)
        db.commit()

    trial_balance = TrialBalanceModel(
        period_id=period_id,
        name=f"{period.name} Trial Balance",
        source_filename=file.filename or "trial_balance.csv",
        stored_filename="",
        file_path="",
        uploaded_by_id=current_user.id,
        total_debit=total_debit,
        total_credit=total_credit,
        total_balance=total_balance
    )
    db.add(trial_balance)
    db.flush()

    stored_filename, file_path = _store_import_file(trial_balance.id, file.filename or "trial_balance.csv", raw_bytes)
    trial_balance.stored_filename = stored_filename
    trial_balance.file_path = file_path

    _record_trial_balance_upload(
        db,
        period_id=period_id,
        trial_balance=trial_balance,
        original_filename=file.filename or "trial_balance.csv",
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "text/csv",
        uploaded_by_id=current_user.id if current_user else None,
    )

    created_accounts = []

    for account in accounts_to_create:
        account_model = TrialBalanceAccountModel(
            trial_balance_id=trial_balance.id,
            account_number=account["account_number"],
            account_name=account["account_name"],
            account_type=account["account_type"],
            debit=account["debit"],
            credit=account["credit"],
            ending_balance=account["ending_balance"]
        )
        db.add(account_model)
        created_accounts.append(account_model)

    db.flush()

    auto_link_tasks_to_trial_balance_accounts(
        db,
        period_id=period_id,
        trial_balance_id=trial_balance.id,
        accounts=created_accounts
    )

    db.commit()
    db.refresh(trial_balance)

    account_count = db.query(TrialBalanceAccountModel).filter(TrialBalanceAccountModel.trial_balance_id == trial_balance.id).count()

    return TrialBalanceSummary(
        trial_balance_id=trial_balance.id,
        period_id=period_id,
        account_count=account_count,
        total_debit=float(trial_balance.total_debit) if trial_balance.total_debit is not None else None,
        total_credit=float(trial_balance.total_credit) if trial_balance.total_credit is not None else None,
        total_balance=float(trial_balance.total_balance) if trial_balance.total_balance is not None else None,
        metadata=None,
        warnings=[],
    )


@router.post("/{period_id}/import-netsuite", response_model=TrialBalanceSummary, status_code=status.HTTP_201_CREATED)
async def import_trial_balance_netsuite(
    period_id: int,
    replace_existing: bool = False,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        decoded = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = raw_bytes.decode("latin-1")

    file_size = len(raw_bytes)

    try:
        parsed = parse_netsuite_trial_balance(decoded)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not parsed.accounts:
        raise HTTPException(status_code=400, detail="No account rows detected in the NetSuite export")

    if replace_existing:
        existing = db.query(TrialBalanceModel).filter(TrialBalanceModel.period_id == period_id).all()
        _delete_existing_trial_balance_files(db, period_id=period_id)
        for tb in existing:
            db.delete(tb)
        db.commit()

    trial_balance = TrialBalanceModel(
        period_id=period_id,
        name=f"{period.name} NetSuite Trial Balance",
        source_filename=file.filename or "netsuite_trial_balance.csv",
        stored_filename="",
        file_path="",
        uploaded_by_id=current_user.id,
        total_debit=parsed.total_debit,
        total_credit=parsed.total_credit,
        total_balance=parsed.total_balance,
        notes=_format_notes_from_metadata(parsed.metadata, parsed.warnings),
    )
    db.add(trial_balance)
    db.flush()

    stored_filename, file_path = _store_import_file(
        trial_balance.id,
        file.filename or "netsuite_trial_balance.csv",
        raw_bytes,
    )
    trial_balance.stored_filename = stored_filename
    trial_balance.file_path = file_path

    _record_trial_balance_upload(
        db,
        period_id=period_id,
        trial_balance=trial_balance,
        original_filename=file.filename or "netsuite_trial_balance.csv",
        stored_filename=stored_filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "text/csv",
        uploaded_by_id=current_user.id if current_user else None,
    )

    account_models: list[TrialBalanceAccountModel] = []

    for account in parsed.accounts:
        account_model = TrialBalanceAccountModel(
            trial_balance_id=trial_balance.id,
            account_number=account.account_number,
            account_name=account.account_name,
            account_type=account.account_type,
            debit=account.debit,
            credit=account.credit,
            ending_balance=account.ending_balance,
        )
        db.add(account_model)
        account_models.append(account_model)

    db.flush()

    auto_link_tasks_to_trial_balance_accounts(
        db,
        period_id=period_id,
        trial_balance_id=trial_balance.id,
        accounts=account_models,
    )

    db.commit()
    db.refresh(trial_balance)

    account_count = (
        db.query(TrialBalanceAccountModel)
        .filter(TrialBalanceAccountModel.trial_balance_id == trial_balance.id)
        .count()
    )

    return TrialBalanceSummary(
        trial_balance_id=trial_balance.id,
        period_id=period_id,
        account_count=account_count,
        total_debit=float(trial_balance.total_debit) if trial_balance.total_debit is not None else None,
        total_credit=float(trial_balance.total_credit) if trial_balance.total_credit is not None else None,
        total_balance=float(trial_balance.total_balance) if trial_balance.total_balance is not None else None,
        metadata=parsed.metadata,
        warnings=parsed.warnings,
    )


@router.get("/{period_id}/comparison", response_model=TrialBalanceComparison)
async def get_trial_balance_comparison(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    period = db.query(PeriodModel).filter(PeriodModel.id == period_id).first()
    if not period:
        raise HTTPException(status_code=404, detail="Period not found")

    current_tb = _get_latest_trial_balance(db, period_id)
    if not current_tb:
        return TrialBalanceComparison(period_id=period_id, previous_period_id=None, accounts=[])

    current_accounts = (
        db.query(TrialBalanceAccountModel)
        .filter(TrialBalanceAccountModel.trial_balance_id == current_tb.id)
        .all()
    )

    previous_period = _get_previous_period(db, period)
    previous_tb = (
        _get_latest_trial_balance(db, previous_period.id) if previous_period else None
    )

    previous_accounts = (
        db.query(TrialBalanceAccountModel)
        .filter(TrialBalanceAccountModel.trial_balance_id == previous_tb.id)
        .all()
        if previous_tb
        else []
    )

    previous_map = {account.account_number: account for account in previous_accounts}
    current_map = {account.account_number: account for account in current_accounts}

    account_numbers = sorted(set(current_map.keys()) | set(previous_map.keys()))

    comparison_accounts: list[TrialBalanceComparisonAccount] = []

    for account_number in account_numbers:
        current_account = current_map.get(account_number)
        previous_account = previous_map.get(account_number)

        current_balance = (
            float(current_account.ending_balance)
            if current_account and current_account.ending_balance is not None
            else None
        )
        previous_balance = (
            float(previous_account.ending_balance)
            if previous_account and previous_account.ending_balance is not None
            else None
        )

        delta = None
        delta_percent = None
        if current_balance is not None or previous_balance is not None:
            current_value = current_balance or 0.0
            previous_value = previous_balance or 0.0
            delta = current_value - previous_value
            if previous_balance and previous_balance != 0:
                delta_percent = (delta / previous_balance) * 100

        comparison_accounts.append(
            TrialBalanceComparisonAccount(
                account_number=account_number,
                account_name=(current_account or previous_account).account_name if (current_account or previous_account) else account_number,
                current_account_id=current_account.id if current_account else None,
                previous_account_id=previous_account.id if previous_account else None,
                current_balance=current_balance,
                previous_balance=previous_balance,
                delta=delta,
                delta_percent=delta_percent,
            )
        )

    return TrialBalanceComparison(
        period_id=period_id,
        previous_period_id=previous_period.id if previous_period else None,
        accounts=comparison_accounts,
    )


@router.get("/{period_id}", response_model=TrialBalance)
async def get_trial_balance(
    period_id: int,
    trial_balance_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(TrialBalanceModel).options(
        selectinload(TrialBalanceModel.accounts).selectinload(TrialBalanceAccountModel.attachments),
        selectinload(TrialBalanceModel.accounts).selectinload(TrialBalanceAccountModel.tasks),
        selectinload(TrialBalanceModel.accounts)
        .selectinload(TrialBalanceAccountModel.validations)
        .selectinload(TrialBalanceValidationModel.task)
    ).filter(TrialBalanceModel.period_id == period_id)

    if trial_balance_id:
        query = query.filter(TrialBalanceModel.id == trial_balance_id)
    else:
        query = query.order_by(TrialBalanceModel.uploaded_at.desc())

    trial_balance = query.first()
    if not trial_balance:
        raise HTTPException(status_code=404, detail="Trial balance not found for period")

    return trial_balance


@router.get("/accounts/{account_id}", response_model=TrialBalanceAccount)
async def get_trial_balance_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).options(
        selectinload(TrialBalanceAccountModel.attachments),
        selectinload(TrialBalanceAccountModel.tasks),
        selectinload(TrialBalanceAccountModel.validations).selectinload(TrialBalanceValidationModel.task)
    ).filter(TrialBalanceAccountModel.id == account_id).first()

    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    return account


@router.patch("/accounts/{account_id}", response_model=TrialBalanceAccount)
async def update_trial_balance_account(
    account_id: int,
    update: TrialBalanceAccountUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).filter(TrialBalanceAccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    if update.notes is not None:
        account.notes = update.notes

    if update.is_verified is not None:
        account.is_verified = update.is_verified
        if update.is_verified:
            account.verified_at = datetime.utcnow()
            account.verified_by_id = current_user.id
        else:
            account.verified_at = None
            account.verified_by_id = None

    db.commit()
    db.refresh(account)

    return account


@router.post(
    "/accounts/{account_id}/tasks",
    response_model=TaskWithRelations,
    status_code=status.HTTP_201_CREATED,
)
async def create_account_task(
    account_id: int,
    payload: TrialBalanceAccountTaskCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    account = (
        db.query(TrialBalanceAccountModel)
        .options(selectinload(TrialBalanceAccountModel.trial_balance).selectinload(TrialBalanceModel.period))
        .filter(TrialBalanceAccountModel.id == account_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    trial_balance = account.trial_balance
    if not trial_balance:
        raise HTTPException(status_code=400, detail="Account is missing trial balance context")

    period = trial_balance.period
    if not period:
        raise HTTPException(status_code=400, detail="Account period is not available")

    owner = db.query(UserModel).filter(UserModel.id == payload.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    assignee = None
    if payload.assignee_id is not None:
        assignee = db.query(UserModel).filter(UserModel.id == payload.assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assignee not found")

    base_department = payload.department or payload.template_department
    if base_department:
        normalized_department = base_department.strip() or "Accounting"
    elif payload.save_as_template:
        normalized_department = "Accounting"
    else:
        normalized_department = (account.account_type or "Accounting").strip() or "Accounting"

    template_estimated_hours = payload.template_estimated_hours
    if template_estimated_hours is None and payload.save_as_template:
        template_estimated_hours = 0.25

    estimated_hours = template_estimated_hours

    new_task = TaskModel(
        period_id=period.id,
        name=payload.name,
        description=payload.description,
        owner_id=payload.owner_id,
        assignee_id=payload.assignee_id,
        status=payload.status,
        due_date=payload.due_date,
        priority=payload.priority if payload.priority is not None else 5,
        department=normalized_department,
        estimated_hours=estimated_hours,
    )

    db.add(new_task)
    account.tasks.append(new_task)
    db.flush()

    if payload.save_as_template:
        default_account_numbers = [
            value.strip()
            for value in (payload.template_default_account_numbers or [])
            if value and value.strip()
        ]
        if account.account_number:
            account_number_clean = account.account_number.strip()
            if account_number_clean and account_number_clean not in default_account_numbers:
                default_account_numbers.append(account_number_clean)

        template = TaskTemplateModel(
            name=payload.template_name or payload.name,
            description=payload.description,
            close_type=period.close_type,
            default_owner_id=payload.owner_id,
            department=payload.template_department or normalized_department,
            days_offset=_calculate_template_offset(period, payload.due_date),
            estimated_hours=template_estimated_hours if template_estimated_hours is not None else 0.25,
            default_account_numbers=default_account_numbers,
        )
        db.add(template)
        db.flush()
        new_task.template_id = template.id

    db.commit()
    db.refresh(new_task)

    return _build_task_payload(db, new_task)


@router.put("/accounts/{account_id}/tasks", response_model=TrialBalanceAccount)
async def update_account_tasks(
    account_id: int,
    payload: TrialBalanceAccountTasksUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).options(selectinload(TrialBalanceAccountModel.trial_balance)).filter(TrialBalanceAccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    if not payload.task_ids:
        account.tasks = []
    else:
        tasks = db.query(TaskModel).filter(TaskModel.id.in_(payload.task_ids)).all()

        if len(tasks) != len(set(payload.task_ids)):
            raise HTTPException(status_code=400, detail="One or more tasks were not found")

        period_id = account.trial_balance.period_id if account.trial_balance else None
        invalid_tasks = [task.id for task in tasks if task.period_id != period_id]
        if invalid_tasks:
            raise HTTPException(status_code=400, detail=f"Tasks {invalid_tasks} are not part of the same period")

        account.tasks = tasks

    db.commit()
    db.refresh(account)

    return account


@router.post("/accounts/{account_id}/validations", response_model=TrialBalanceValidation, status_code=status.HTTP_201_CREATED)
async def create_validation(
    account_id: int,
    task_id: Optional[int] = Form(None),
    supporting_amount: str = Form(...),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = FastAPIFile(None),
    file_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).options(selectinload(TrialBalanceAccountModel.trial_balance)).filter(TrialBalanceAccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    try:
        supporting_amount_decimal = Decimal(supporting_amount)
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Invalid supporting amount")

    linked_task = None
    if task_id is not None:
        linked_task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
        if not linked_task:
            raise HTTPException(status_code=404, detail="Linked task not found")

        period_id = account.trial_balance.period_id if account.trial_balance else None
        if linked_task.period_id != period_id:
            raise HTTPException(status_code=400, detail="Linked task must belong to the same period")

    stored_filename = None
    file_path = None
    relative_path = None
    file_size = None
    mime_type = None
    parsed_file_date = None

    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    if file is not None:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        if size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
            )

        file_bytes = await file.read()
        stored_filename, file_path, relative_path = _store_validation_file(
            account.trial_balance_id,
            account.id,
            file.filename or "support",
            file_bytes
        )
        file_size = len(file_bytes)
        mime_type = file.content_type

    if file_date:
        try:
            parsed_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            parsed_file_date = None

    _, difference, matches = _compute_validation_metrics(account, supporting_amount_decimal)

    validation = TrialBalanceValidationModel(
        account_id=account.id,
        task_id=task_id,
        supporting_amount=supporting_amount_decimal,
        difference=difference,
        matches_balance=matches,
        notes=notes,
        evidence_filename=stored_filename,
        evidence_original_filename=file.filename if file else None,
        evidence_path=file_path,
        evidence_relative_path=relative_path,
        evidence_size=file_size,
        evidence_mime_type=mime_type,
        evidence_file_date=parsed_file_date
    )
    db.add(validation)
    db.commit()
    db.refresh(validation)

    return validation


@router.patch("/validations/{validation_id}", response_model=TrialBalanceValidation)
async def update_validation(
    validation_id: int,
    supporting_amount: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    task_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = FastAPIFile(None),
    file_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    validation = db.query(TrialBalanceValidationModel).options(selectinload(TrialBalanceValidationModel.account).selectinload(TrialBalanceAccountModel.trial_balance)).filter(TrialBalanceValidationModel.id == validation_id).first()
    if not validation:
        raise HTTPException(status_code=404, detail="Validation not found")

    if supporting_amount is not None:
        try:
            supporting_amount_decimal = Decimal(supporting_amount)
        except (InvalidOperation, ValueError):
            raise HTTPException(status_code=400, detail="Invalid supporting amount")
        validation.supporting_amount = supporting_amount_decimal
        _, difference, matches = _compute_validation_metrics(validation.account, supporting_amount_decimal)
        validation.difference = difference
        validation.matches_balance = matches

    if notes is not None:
        validation.notes = notes

    if task_id is not None:
        if task_id == 0:
            validation.task_id = None
        else:
            linked_task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
            if not linked_task:
                raise HTTPException(status_code=404, detail="Linked task not found")
            period_id = validation.account.trial_balance.period_id if validation.account and validation.account.trial_balance else None
            if linked_task.period_id != period_id:
                raise HTTPException(status_code=400, detail="Linked task must belong to the same period")
            validation.task_id = task_id

    if file_date is not None:
        try:
            validation.evidence_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            validation.evidence_file_date = None

    if file is not None:
        max_size_bytes = settings.max_file_size_mb * 1024 * 1024
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        if size > max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
            )

        file_bytes = await file.read()

        if validation.evidence_path and os.path.exists(validation.evidence_path):
            try:
                os.remove(validation.evidence_path)
            except OSError:
                pass

        stored_filename, file_path, relative_path = _store_validation_file(
            validation.account.trial_balance_id,
            validation.account_id,
            file.filename or "support",
            file_bytes
        )
        validation.evidence_filename = stored_filename
        validation.evidence_original_filename = file.filename
        validation.evidence_path = file_path
        validation.evidence_relative_path = relative_path
        validation.evidence_size = len(file_bytes)
        validation.evidence_mime_type = file.content_type
        validation.evidence_uploaded_at = datetime.utcnow()

    db.commit()
    db.refresh(validation)

    return validation


@router.delete("/validations/{validation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_validation(
    validation_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    validation = db.query(TrialBalanceValidationModel).filter(TrialBalanceValidationModel.id == validation_id).first()
    if not validation:
        raise HTTPException(status_code=404, detail="Validation not found")

    if validation.evidence_path and os.path.exists(validation.evidence_path):
        try:
            os.remove(validation.evidence_path)
        except OSError:
            pass

    db.delete(validation)
    db.commit()


@router.post("/accounts/{account_id}/attachments/upload", response_model=TrialBalanceAttachment, status_code=status.HTTP_201_CREATED)
async def upload_account_attachment(
    account_id: int,
    file: UploadFile = FastAPIFile(...),
    description: Optional[str] = Form(None),
    file_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).filter(TrialBalanceAccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    max_size_bytes = settings.max_file_size_mb * 1024 * 1024
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
        )

    raw_bytes = await file.read()
    extension = os.path.splitext(file.filename or "")[1]
    stored_name = f"{uuid.uuid4()}{extension}"
    base_dir = os.path.join(settings.file_storage_path, "trial_balances", str(account.trial_balance_id), str(account.id))
    os.makedirs(base_dir, exist_ok=True)
    file_path = os.path.join(base_dir, stored_name)

    with open(file_path, "wb") as buffer:
        buffer.write(raw_bytes)

    parsed_file_date = None
    if file_date:
        try:
            parsed_file_date = datetime.fromisoformat(file_date).date()
        except ValueError:
            parsed_file_date = None

    attachment = TrialBalanceAttachmentModel(
        account_id=account.id,
        filename=stored_name,
        original_filename=file.filename or stored_name,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
        file_date=parsed_file_date,
        uploaded_by_id=current_user.id,
        is_external_link=False
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.post("/accounts/{account_id}/attachments/link", response_model=TrialBalanceAttachment, status_code=status.HTTP_201_CREATED)
async def link_account_attachment(
    account_id: int,
    payload: TrialBalanceAttachmentLink,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    account = db.query(TrialBalanceAccountModel).filter(TrialBalanceAccountModel.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Trial balance account not found")

    attachment = TrialBalanceAttachmentModel(
        account_id=account.id,
        filename=payload.external_url.split("/")[-1] or "External Link",
        original_filename=payload.external_url.split("/")[-1] or "External Link",
        file_path="",
        file_size=0,
        mime_type=None,
        description=payload.description,
        file_date=payload.file_date,
        uploaded_by_id=current_user.id,
        is_external_link=True,
        external_url=payload.external_url
    )

    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    return attachment


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    attachment = db.query(TrialBalanceAttachmentModel).filter(TrialBalanceAttachmentModel.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if not attachment.is_external_link and attachment.file_path:
        try:
            if os.path.exists(attachment.file_path):
                os.remove(attachment.file_path)
        except OSError:
            pass

    db.delete(attachment)
    db.commit()


@router.get("/attachments/{attachment_id}", response_model=TrialBalanceAttachment)
async def get_account_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    attachment = db.query(TrialBalanceAttachmentModel).filter(TrialBalanceAttachmentModel.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    attachment.last_accessed_at = datetime.utcnow()
    db.commit()
    db.refresh(attachment)

    return attachment


@router.get("/{trial_balance_id}/missing-tasks", response_model=List[MissingTaskSuggestion])
async def get_missing_task_suggestions(
    trial_balance_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Suggest missing tasks based on templates with default_account_numbers.
    Finds templates that have accounts in this trial balance but no corresponding task in this period.
    """
    from backend.models import trial_balance_account_tasks
    
    # Get trial balance with period info
    trial_balance = db.query(TrialBalanceModel).filter(
        TrialBalanceModel.id == trial_balance_id
    ).first()
    
    if not trial_balance:
        raise HTTPException(status_code=404, detail="Trial balance not found")
    
    period_id = trial_balance.period_id
    
    # Get all accounts in this trial balance
    accounts = db.query(TrialBalanceAccountModel).filter(
        TrialBalanceAccountModel.trial_balance_id == trial_balance_id
    ).all()
    
    account_map = {acc.account_number: acc for acc in accounts}
    
    # Get all active templates
    templates = db.query(TaskTemplateModel).filter(
        TaskTemplateModel.is_active == True,
        TaskTemplateModel.default_account_numbers.isnot(None)
    ).all()
    
    suggestions = []
    
    for template in templates:
        if not template.default_account_numbers:
            continue
        
        # For each account number in template's default list
        for account_number in template.default_account_numbers:
            account_number_clean = str(account_number).strip()
            
            # Check if this account exists in trial balance
            if account_number_clean not in account_map:
                continue
            
            account = account_map[account_number_clean]
            
            # Check if a task already exists for this template + account in this period
            existing_task = db.query(TaskModel).join(
                trial_balance_account_tasks,
                TaskModel.id == trial_balance_account_tasks.c.task_id
            ).filter(
                TaskModel.period_id == period_id,
                TaskModel.template_id == template.id,
                trial_balance_account_tasks.c.account_id == account.id
            ).first()
            
            if not existing_task:
                # This is a missing task - template exists, account exists, but no task
                suggestions.append(MissingTaskSuggestion(
                    template_id=template.id,
                    template_name=template.name,
                    account_id=account.id,
                    account_number=account.account_number,
                    account_name=account.account_name,
                    department=template.department,
                    estimated_hours=template.estimated_hours,
                    default_owner_id=template.default_owner_id
                ))
    
    return suggestions
