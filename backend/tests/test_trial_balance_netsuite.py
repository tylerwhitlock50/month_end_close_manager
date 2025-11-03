from decimal import Decimal
from pathlib import Path

from backend.models import (
    User,
    Period,
    TrialBalance,
    TrialBalanceAccount,
    File,
    UserRole,
    PeriodStatus,
    CloseType,
)


def seed_period_and_user(session):
    user = User(
        id=1,
        email="tester@example.com",
        name="Test Admin",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    period = Period(
        id=1,
        name="September 2025",
        month=9,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    session.add_all([user, period])
    session.commit()


def test_import_netsuite_trial_balance(client, db_session):
    seed_period_and_user(db_session)

    sample_path = Path("netsuite_file/TrialBalance677.csv")
    payload = sample_path.read_bytes()

    response = client.post(
        "/api/trial-balance/1/import-netsuite",
        params={"replace_existing": False},
        files={"file": ("TrialBalance677.csv", payload, "text/csv")},
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["trial_balance_id"] > 0
    assert body["account_count"] > 0
    assert body["total_balance"] is not None
    assert body["metadata"]["entity"] == "Future Comp, LLC"
    assert body["warnings"] == []

    trial_balance = db_session.query(TrialBalance).filter(TrialBalance.id == body["trial_balance_id"]).one()
    accounts = db_session.query(TrialBalanceAccount).filter(TrialBalanceAccount.trial_balance_id == trial_balance.id).all()

    assert len(accounts) == body["account_count"]
    numbers = {account.account_number for account in accounts}
    assert "10010" in numbers
    assert "12090" in numbers

    checking = next(account for account in accounts if account.account_number == "10010")
    assert checking.debit == Decimal("165289.63")

    allowance = next(account for account in accounts if account.account_number == "12090")
    assert allowance.credit == Decimal("759638.37")

    period_files = (
        db_session.query(File)
        .filter(File.period_id == 1, File.description.ilike("Trial balance import%"))
        .all()
    )
    assert len(period_files) == 1
    assert period_files[0].original_filename == "TrialBalance677.csv"


def test_import_trial_balance_creates_period_file(client, db_session):
    seed_period_and_user(db_session)

    csv_content = (
        "account number,account name,debit,credit\n"
        "1000,Cash,100.00,0\n"
    ).encode("utf-8")

    response = client.post(
        "/api/trial-balance/1/import",
        files={"file": ("simple_tb.csv", csv_content, "text/csv")},
    )

    assert response.status_code == 201, response.text

    period_files = (
        db_session.query(File)
        .filter(File.period_id == 1, File.description.ilike("Trial balance import%"))
        .all()
    )
    assert len(period_files) == 1
    assert period_files[0].original_filename == "simple_tb.csv"


def test_import_netsuite_validation_on_empty_file(client, db_session):
    seed_period_and_user(db_session)

    response = client.post(
        "/api/trial-balance/1/import-netsuite",
        files={"file": ("empty.csv", b"", "text/csv")},
    )

    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_trial_balance_comparison_endpoint(client, db_session):
    # Create current and previous periods
    user = User(
        id=10,
        email="owner@example.com",
        name="Owner",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        is_active=True,
    )
    current_period = Period(
        id=20,
        name="February 2025",
        month=2,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.IN_PROGRESS,
        is_active=True,
    )
    previous_period = Period(
        id=21,
        name="January 2025",
        month=1,
        year=2025,
        close_type=CloseType.MONTHLY,
        status=PeriodStatus.CLOSED,
        is_active=False,
    )
    db_session.add_all([user, current_period, previous_period])
    db_session.commit()

    def seed_trial_balance(period_id: int, accounts: dict[str, float]) -> TrialBalance:
        tb = TrialBalance(
            period_id=period_id,
            name=f"TB {period_id}",
            source_filename="seed.csv",
            stored_filename="seed.csv",
            file_path="/tmp/seed.csv",
            uploaded_by_id=user.id,
            total_debit=Decimal("0"),
            total_credit=Decimal("0"),
            total_balance=Decimal("0"),
        )
        db_session.add(tb)
        db_session.flush()

        for number, balance in accounts.items():
            account = TrialBalanceAccount(
                trial_balance_id=tb.id,
                account_number=number,
                account_name=f"Account {number}",
                ending_balance=Decimal(str(balance)),
            )
            db_session.add(account)

        db_session.commit()
        return tb

    seed_trial_balance(previous_period.id, {"100": 80.0, "200": 20.0})
    seed_trial_balance(current_period.id, {"100": 120.0, "300": 50.0})

    response = client.get(f"/api/trial-balance/{current_period.id}/comparison")
    assert response.status_code == 200
    payload = response.json()

    assert payload["period_id"] == current_period.id
    assert payload["previous_period_id"] == previous_period.id

    accounts = {item["account_number"]: item for item in payload["accounts"]}
    assert set(accounts.keys()) == {"100", "200", "300"}

    account_100 = accounts["100"]
    assert account_100["current_balance"] == 120.0
    assert account_100["previous_balance"] == 80.0
    assert account_100["delta"] == 40.0
    assert round(account_100["delta_percent"], 2) == 50.0

    account_300 = accounts["300"]
    assert account_300["previous_balance"] is None
    assert account_300["delta"] == 50.0

    account_200 = accounts["200"]
    assert account_200["current_balance"] is None
    assert account_200["previous_balance"] == 20.0
