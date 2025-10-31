"""
Migration script to add workflow support.
Adds template dependencies table and position tracking for visual workflow builder.

Run this with: docker-compose exec backend python backend/migrations/migrate_add_workflow_support.py
"""
import os
import sys

# Add the parent directory to the path so we can import from backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database import SessionLocal


def run_migration():
    """Execute the workflow support migration."""
    print("Starting migration: Add workflow support")
    
    db = SessionLocal()
    
    try:
        # Step 1: Create task_template_dependencies table
        print("\nStep 1: Creating task_template_dependencies table...")
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS task_template_dependencies (
                template_id INTEGER NOT NULL,
                depends_on_id INTEGER NOT NULL,
                PRIMARY KEY (template_id, depends_on_id),
                FOREIGN KEY (template_id) REFERENCES task_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (depends_on_id) REFERENCES task_templates(id) ON DELETE CASCADE
            )
        """))
        db.commit()
        print("  ✓ task_template_dependencies table created")
        
        # Step 2: Add position columns to task_templates
        print("\nStep 2: Adding position columns to task_templates...")
        try:
            db.execute(text("ALTER TABLE task_templates ADD COLUMN position_x REAL DEFAULT NULL"))
            db.commit()
            print("  ✓ position_x added to task_templates")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e) or "duplicate column" in str(e).lower():
                print("  ℹ position_x already exists in task_templates")
            else:
                raise
        
        try:
            db.execute(text("ALTER TABLE task_templates ADD COLUMN position_y REAL DEFAULT NULL"))
            db.commit()
            print("  ✓ position_y added to task_templates")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e) or "duplicate column" in str(e).lower():
                print("  ℹ position_y already exists in task_templates")
            else:
                raise
        
        # Step 3: Add position columns to tasks
        print("\nStep 3: Adding position columns to tasks...")
        try:
            db.execute(text("ALTER TABLE tasks ADD COLUMN position_x REAL DEFAULT NULL"))
            db.commit()
            print("  ✓ position_x added to tasks")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e) or "duplicate column" in str(e).lower():
                print("  ℹ position_x already exists in tasks")
            else:
                raise
        
        try:
            db.execute(text("ALTER TABLE tasks ADD COLUMN position_y REAL DEFAULT NULL"))
            db.commit()
            print("  ✓ position_y added to tasks")
        except Exception as e:
            db.rollback()
            if "already exists" in str(e) or "duplicate column" in str(e).lower():
                print("  ℹ position_y already exists in tasks")
            else:
                raise
        
        # Step 4: Create indexes
        print("\nStep 4: Creating indexes...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_task_template_deps_template 
            ON task_template_dependencies(template_id)
        """))
        db.commit()
        print("  ✓ Index on template_id created")
        
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_task_template_deps_depends 
            ON task_template_dependencies(depends_on_id)
        """))
        db.commit()
        print("  ✓ Index on depends_on_id created")
        
        print("\n" + "="*50)
        print("Migration completed successfully!")
        print("="*50)
        print("  ✓ Added task_template_dependencies table")
        print("  ✓ Added position_x, position_y to task_templates")
        print("  ✓ Added position_x, position_y to tasks")
        print("  ✓ Created indexes for performance")
        print("="*50)
        
    except Exception as e:
        db.rollback()
        print(f"\n✗ Migration failed: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    try:
        run_migration()
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        sys.exit(1)

