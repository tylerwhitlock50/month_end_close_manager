-- Add workflow support: template dependencies and position tracking
-- This migration adds the ability to define dependencies between task templates
-- and store visual positions for both templates and tasks in the workflow builder

-- Create task_template_dependencies association table
CREATE TABLE IF NOT EXISTS task_template_dependencies (template_id INTEGER NOT NULL, depends_on_id INTEGER NOT NULL, PRIMARY KEY (template_id, depends_on_id), FOREIGN KEY (template_id) REFERENCES task_templates(id) ON DELETE CASCADE, FOREIGN KEY (depends_on_id) REFERENCES task_templates(id) ON DELETE CASCADE);

-- Add position columns to task_templates for workflow visualization
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS position_x REAL DEFAULT NULL;
ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS position_y REAL DEFAULT NULL;

-- Add position columns to tasks for workflow visualization
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position_x REAL DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position_y REAL DEFAULT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_template_deps_template ON task_template_dependencies(template_id);
CREATE INDEX IF NOT EXISTS idx_task_template_deps_depends ON task_template_dependencies(depends_on_id);

