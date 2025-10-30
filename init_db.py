"""
Database initialization script.
Creates tables and optionally seeds with sample data.
"""
import sys
from sqlalchemy.orm import Session

from backend.database import engine, Base, SessionLocal
from backend.models import User, Period, TaskTemplate, UserRole, CloseType
from backend.auth import get_password_hash


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")


def seed_data():
    """Seed database with initial data."""
    db = SessionLocal()
    
    try:
        print("\nSeeding database with initial data...")
        
        # Create admin user
        admin = db.query(User).filter(User.email == "admin@monthend.com").first()
        if not admin:
            admin = User(
                email="admin@monthend.com",
                name="System Administrator",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                department="Finance",
                is_active=True
            )
            db.add(admin)
            print("✓ Created admin user (admin@monthend.com / admin123)")
        
        # Create sample users
        users_data = [
            {
                "email": "john.doe@monthend.com",
                "name": "John Doe",
                "role": UserRole.PREPARER,
                "department": "Accounting"
            },
            {
                "email": "jane.smith@monthend.com",
                "name": "Jane Smith",
                "role": UserRole.REVIEWER,
                "department": "Finance"
            },
            {
                "email": "bob.wilson@monthend.com",
                "name": "Bob Wilson",
                "role": UserRole.PREPARER,
                "department": "Operations"
            }
        ]
        
        for user_data in users_data:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing:
                user = User(
                    **user_data,
                    hashed_password=get_password_hash("password123"),
                    is_active=True
                )
                db.add(user)
        
        db.commit()
        print("✓ Created sample users")
        
        # Create task templates
        templates_data = [
            {
                "name": "Trial Balance Export",
                "description": "Export trial balance from NetSuite",
                "close_type": CloseType.MONTHLY,
                "department": "Accounting",
                "days_offset": 0,
                "estimated_hours": 0.5,
                "sort_order": 1,
                "default_account_numbers": []
            },
            {
                "name": "Bank Reconciliation",
                "description": "Reconcile all bank accounts",
                "close_type": CloseType.MONTHLY,
                "department": "Accounting",
                "days_offset": 1,
                "estimated_hours": 2.0,
                "sort_order": 2,
                "default_account_numbers": ["cash", "bank"]
            },
            {
                "name": "Inventory Reconciliation",
                "description": "Reconcile inventory balances",
                "close_type": CloseType.MONTHLY,
                "department": "Operations",
                "days_offset": 2,
                "estimated_hours": 4.0,
                "sort_order": 3,
                "default_account_numbers": ["inventory"]
            },
            {
                "name": "AR Aging Review",
                "description": "Review accounts receivable aging",
                "close_type": CloseType.MONTHLY,
                "department": "Accounting",
                "days_offset": 1,
                "estimated_hours": 1.5,
                "sort_order": 4,
                "default_account_numbers": ["accounts receivable", "ar"]
            },
            {
                "name": "AP Accruals",
                "description": "Record accounts payable accruals",
                "close_type": CloseType.MONTHLY,
                "department": "Accounting",
                "days_offset": 2,
                "estimated_hours": 2.0,
                "sort_order": 5,
                "default_account_numbers": ["accounts payable", "ap"]
            },
            {
                "name": "Revenue Recognition",
                "description": "Review and post revenue recognition entries",
                "close_type": CloseType.MONTHLY,
                "department": "Finance",
                "days_offset": 3,
                "estimated_hours": 3.0,
                "sort_order": 6,
                "default_account_numbers": ["revenue"]
            },
            {
                "name": "Depreciation Entries",
                "description": "Post depreciation journal entries",
                "close_type": CloseType.MONTHLY,
                "department": "Accounting",
                "days_offset": 2,
                "estimated_hours": 1.0,
                "sort_order": 7,
                "default_account_numbers": ["depreciation", "fixed asset"]
            },
            {
                "name": "Intercompany Reconciliation",
                "description": "Reconcile intercompany accounts",
                "close_type": CloseType.MONTHLY,
                "department": "Finance",
                "days_offset": 3,
                "estimated_hours": 2.5,
                "sort_order": 8
            },
            {
                "name": "Financial Statement Review",
                "description": "Review preliminary financial statements",
                "close_type": CloseType.MONTHLY,
                "department": "Finance",
                "days_offset": 5,
                "estimated_hours": 3.0,
                "sort_order": 9
            },
            {
                "name": "Close Checklist Sign-off",
                "description": "Final review and sign-off of close checklist",
                "close_type": CloseType.MONTHLY,
                "department": "Finance",
                "days_offset": 6,
                "estimated_hours": 1.0,
                "sort_order": 10
            }
        ]
        
        for template_data in templates_data:
            existing = db.query(TaskTemplate).filter(
                TaskTemplate.name == template_data["name"],
                TaskTemplate.close_type == template_data["close_type"]
            ).first()
            
            if not existing:
                template = TaskTemplate(**template_data, default_owner_id=admin.id)
                db.add(template)
        
        db.commit()
        print("✓ Created task templates")
        
        print("\n✅ Database seeding completed successfully!")
        print("\nLogin credentials:")
        print("  Email: admin@monthend.com")
        print("  Password: admin123")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def reset_database():
    """Drop all tables and recreate them."""
    print("⚠️  Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("✓ Tables dropped")
    create_tables()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Initialize database")
    parser.add_argument("--reset", action="store_true", help="Reset database (drop all tables)")
    parser.add_argument("--seed", action="store_true", help="Seed with sample data")
    
    args = parser.parse_args()
    
    if args.reset:
        reset_database()
    else:
        create_tables()
    
    if args.seed:
        seed_data()

