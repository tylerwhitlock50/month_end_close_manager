# Database Migrations

This directory contains database migration scripts for the Month-End Close application.

## File Cabinet Feature Migration

The `add_period_files_support` migration adds support for period-level file uploads and enhances the file management system.

### Changes Made

1. **Added `period_id` column to `files` table** - Allows files to be associated directly with periods
2. **Made `task_id` nullable** - Files can now belong to either a task OR a period
3. **Updated existing files** - Backfills `period_id` for existing files based on their task's period
4. **Added indexes** - Improves query performance for period-based file lookups

### Running the Migration

#### Option 1: Using Python Script (Recommended)

```bash
# From the project root directory
venv/scripts/python.exe backend/migrations/migrate_add_period_files.py
```

This will automatically:
- Add the new columns and constraints
- Update existing data
- Verify the migration
- Provide a summary of changes

#### Option 2: Using SQL Script

If you prefer to run SQL directly:

```bash
# For PostgreSQL
psql -U your_username -d your_database -f backend/migrations/add_period_files_support.sql

# Or using pgAdmin, DBeaver, or any SQL client
```

### Verification

After running the migration, verify it succeeded by checking:

1. All files have either `task_id` or `period_id`:
   ```sql
   SELECT COUNT(*) FROM files WHERE task_id IS NULL AND period_id IS NULL;
   ```
   Should return 0.

2. Files are properly linked to periods:
   ```sql
   SELECT 
       COUNT(*) FILTER (WHERE task_id IS NOT NULL) as task_files,
       COUNT(*) FILTER (WHERE period_id IS NOT NULL) as period_files,
       COUNT(*) as total
   FROM files;
   ```

### Rollback

If you need to rollback this migration:

```sql
-- Remove the period_id column
ALTER TABLE files DROP COLUMN period_id;

-- Make task_id required again (only if no period-level files exist)
ALTER TABLE files ALTER COLUMN task_id SET NOT NULL;

-- Drop the index
DROP INDEX IF EXISTS idx_files_period_id;
```

**Warning:** Rolling back will delete all period-level files that have no task association!

## Notes

- Always backup your database before running migrations
- Test migrations in a development environment first
- Existing file uploads will continue to work unchanged after migration
- New functionality allows uploading files directly to periods without task assignment








