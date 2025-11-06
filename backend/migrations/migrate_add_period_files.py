"""
Database migration script to add period-level file support.

This script:
1. Adds period_id column to the files table
2. Makes task_id nullable
3. Updates existing files with period_id from their tasks
4. Creates necessary indexes

Run this script using: venv/scripts/python.exe backend/migrations/migrate_add_period_files.py
"""

import sys
import os

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import text
from backend.database import engine, SessionLocal


def run_migration():
    """Run the migration to add period file support."""
    print("Starting migration: Add period-level file support")
    
    db = SessionLocal()
    
    try:
        # Step 1: Add period_id column if it doesn't exist
        print("Step 1: Adding period_id column...")
        db.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='files' AND column_name='period_id'
                ) THEN
                    ALTER TABLE files ADD COLUMN period_id INTEGER;
                END IF;
            END $$;
        """))
        db.commit()
        print("  ✓ period_id column added")
        
        # Step 2: Add foreign key constraint
        print("Step 2: Adding foreign key constraint...")
        db.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name='files_period_id_fkey'
                ) THEN
                    ALTER TABLE files 
                    ADD CONSTRAINT files_period_id_fkey 
                    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE;
                END IF;
            END $$;
        """))
        db.commit()
        print("  ✓ Foreign key constraint added")
        
        # Step 3: Make task_id nullable
        print("Step 3: Making task_id nullable...")
        db.execute(text("""
            ALTER TABLE files ALTER COLUMN task_id DROP NOT NULL;
        """))
        db.commit()
        print("  ✓ task_id is now nullable")
        
        # Step 4: Update existing files with period_id from their tasks
        print("Step 4: Updating existing files with period_id...")
        result = db.execute(text("""
            UPDATE files 
            SET period_id = tasks.period_id
            FROM tasks
            WHERE files.task_id = tasks.id AND files.period_id IS NULL;
        """))
        db.commit()
        rows_updated = result.rowcount
        print(f"  ✓ Updated {rows_updated} files with period_id")
        
        # Step 5: Create index on period_id
        print("Step 5: Creating index on period_id...")
        db.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE indexname='idx_files_period_id'
                ) THEN
                    CREATE INDEX idx_files_period_id ON files(period_id);
                END IF;
            END $$;
        """))
        db.commit()
        print("  ✓ Index created")
        
        # Verification
        print("\nVerifying migration...")
        result = db.execute(text("""
            SELECT COUNT(*) as count 
            FROM files 
            WHERE task_id IS NULL AND period_id IS NULL;
        """))
        orphaned_files = result.fetchone()[0]
        
        if orphaned_files > 0:
            print(f"  ⚠ Warning: Found {orphaned_files} files with no task_id or period_id")
        else:
            print("  ✓ All files have either task_id or period_id")
        
        # Summary
        result = db.execute(text("""
            SELECT 
                COUNT(*) FILTER (WHERE task_id IS NOT NULL) as task_files,
                COUNT(*) FILTER (WHERE task_id IS NULL AND period_id IS NOT NULL) as period_files,
                COUNT(*) as total_files
            FROM files;
        """))
        summary = result.fetchone()
        
        print("\n" + "="*50)
        print("Migration completed successfully!")
        print("="*50)
        print(f"Task files: {summary[0]}")
        print(f"Period files: {summary[1]}")
        print(f"Total files: {summary[2]}")
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
        print(f"\nError: {str(e)}")
        sys.exit(1)








