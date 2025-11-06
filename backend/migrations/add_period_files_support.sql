-- Migration script to add period-level file support
-- This adds period_id to the files table and makes task_id nullable

-- Step 1: Add period_id column (nullable initially to allow existing data)
ALTER TABLE files ADD COLUMN period_id INTEGER;

-- Step 2: Add foreign key constraint for period_id
ALTER TABLE files ADD CONSTRAINT files_period_id_fkey 
    FOREIGN KEY (period_id) REFERENCES periods(id) ON DELETE CASCADE;

-- Step 3: Make task_id nullable (if not already)
-- Note: This depends on your database. For PostgreSQL:
ALTER TABLE files ALTER COLUMN task_id DROP NOT NULL;

-- Step 4: Update existing files to have period_id based on their task's period
UPDATE files 
SET period_id = tasks.period_id
FROM tasks
WHERE files.task_id = tasks.id;

-- Step 5: Create an index on period_id for better query performance
CREATE INDEX idx_files_period_id ON files(period_id);

-- Verification query - check that all files now have either task_id or period_id
-- SELECT id, task_id, period_id FROM files WHERE task_id IS NULL AND period_id IS NULL;








