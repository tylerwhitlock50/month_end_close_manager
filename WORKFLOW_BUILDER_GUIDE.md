# Workflow Builder Guide

## Overview

The **Workflow Builder** is a visual drag-and-drop interface for managing task dependencies and workflows. It allows you to:
- Build reusable template workflows that apply across all periods
- Customize task dependencies for specific periods
- Visualize task chains and identify bottlenecks
- Support multiple disconnected workflow chains
- Auto-layout complex workflows

## Key Features

### 1. **Dual Mode Operation**

#### Template Mode
- Build reusable workflows from task templates
- Filter by close type (Monthly, Quarterly, Year-End)
- Dependencies automatically applied when creating new periods
- Ideal for standardizing month-end processes

#### Period Mode
- Customize dependencies for specific period tasks
- Override template workflows for special circumstances
- Visual task status and progress tracking
- Period-specific workflow management

### 2. **Visual Canvas**

- **Drag & Drop**: Position nodes anywhere on the canvas
- **Connect Tasks**: Draw connections between tasks to define dependencies
- **Auto-Layout**: Automatically arrange nodes using Dagre algorithm
- **Mini-Map**: Navigate large workflows easily
- **Zoom & Pan**: Full canvas control with mouse/trackpad

### 3. **Smart Validation**

- **Circular Dependency Detection**: Prevents creating dependency loops
- **Real-time Validation**: Instant feedback on invalid connections
- **Error Messages**: Clear guidance when issues occur

### 4. **Auto-Save**

- Position changes save automatically (500ms debounce)
- Dependency changes save immediately
- Visual save status indicator
- No manual save button needed

## Getting Started

### Access the Workflow Builder

1. Navigate to **"Workflow Builder"** in the main navigation menu
2. Choose your mode: **Templates** or **Period Tasks**

### Building a Template Workflow

1. **Switch to Template Mode**
   - Click the "Templates" button in the header
   - Optionally filter by close type

2. **View Existing Templates**
   - All active templates for the selected close type appear as nodes
   - Templates are displayed in purple

3. **Connect Templates**
   - Click and drag from the right handle of one template to the left handle of another
   - The target template will now depend on the source template
   - Example: Drag from "Upload Trial Balance" to "Reconcile Cash" means "Reconcile Cash" depends on "Upload Trial Balance"

4. **Auto-Layout**
   - Click the "Auto Layout" button to automatically arrange nodes
   - Uses left-to-right flow showing dependency chains clearly

5. **Disconnect Dependencies**
   - Click on a connection edge
   - Press Delete or click the X button
   - Dependency is removed immediately

### Working with Period Tasks

1. **Switch to Period Mode**
   - Click the "Period Tasks" button in the header
   - Select a period from the dropdown

2. **View Period Workflow**
   - All tasks for the selected period appear as nodes
   - Tasks show status, assignee, and due date
   - Color-coded by status (green=complete, blue=in progress, etc.)

3. **Customize Dependencies**
   - Override template dependencies as needed
   - Add ad-hoc dependencies for special circumstances
   - Changes only affect the current period

4. **Visual Indicators**
   - **Overdue tasks**: Red ring around the node
   - **Disconnected tasks**: Listed in stats bar
   - **Separate chains**: Count shown in stats bar

## Node Information

Each node displays:
- **Task/Template Name**: Main identifier
- **Department**: Organizational unit
- **Status Badge**: Current state (period tasks only)
- **Assignee**: Person responsible (period tasks only)
- **Due Date**: Deadline (period tasks only)
- **Priority**: P1-P10 indicator
- **Dependency Count**: How many other tasks it depends on

## Workflow Statistics

The stats bar shows:
- **Total Nodes**: Number of tasks/templates in the workflow
- **Total Connections**: Number of dependencies
- **Separate Chains**: Count of disconnected workflow groups
- **Disconnected Nodes**: Tasks with no dependencies (warning indicator)

## Creating New Periods

When you create a new period with **"Roll Forward Tasks"** enabled:

1. All templates matching the close type are created as tasks
2. Template dependencies are **automatically** copied to the new tasks
3. Node positions are preserved for consistent layout
4. You can then customize the workflow for that specific period

## Keyboard Shortcuts

- **Delete**: Remove selected edge connection
- **Mouse Wheel**: Zoom in/out
- **Middle Click + Drag**: Pan canvas
- **Ctrl + Scroll**: Zoom in/out (alternative)

## Best Practices

### Template Workflows

1. **Keep It Simple**: Start with core dependencies
2. **Use Clear Names**: Make templates self-explanatory
3. **Test First**: Build template workflow before rolling forward
4. **Document**: Add descriptions to clarify complex steps

### Dependency Design

1. **Chain Critical Path**: Link time-sensitive tasks sequentially
2. **Parallel Chains**: Allow independent work streams
3. **Avoid Over-Constraining**: Only add necessary dependencies
4. **Review Regularly**: Update templates as processes evolve

### Period Customization

1. **Start with Templates**: Let templates provide the baseline
2. **Customize Sparingly**: Only override when truly needed
3. **Document Changes**: Add notes explaining period-specific changes
4. **Review Critical Path**: Check longest chain for bottlenecks

## Troubleshooting

### "Circular dependency detected"
**Problem**: Trying to create a dependency loop (A→B→C→A)  
**Solution**: Review the chain and remove the conflicting connection

### Nodes aren't saving position
**Problem**: Auto-save may have failed  
**Solution**: Check the save status indicator; try manually dragging again

### Can't see all nodes
**Problem**: Workflow extends beyond visible canvas  
**Solution**: Use the mini-map to navigate or click "Auto Layout"

### Template dependencies not applied to period
**Problem**: Period created before template workflow was built  
**Solution**: Manually add dependencies in Period Mode or recreate the period

## API Endpoints

### Template Workflows
- `GET /api/task-templates/workflow?close_type={type}` - Fetch template workflow
- `PUT /api/task-templates/{id}/position` - Update node position
- `PUT /api/task-templates/{id}/dependencies` - Update dependencies

### Period Workflows
- `GET /api/tasks/period/{id}/workflow` - Fetch period workflow
- `PUT /api/tasks/{id}/position` - Update node position
- `PUT /api/tasks/{id}/dependencies` - Update dependencies

## Technical Details

- **Frontend**: React Flow library for node-based visualization
- **Backend**: SQLAlchemy many-to-many relationships for dependencies
- **Layout Algorithm**: Dagre for automatic graph layout
- **Validation**: Client and server-side circular dependency detection
- **Storage**: Positions stored as floating-point coordinates in database

## Future Enhancements (Not Yet Implemented)

- Create tasks directly from workflow canvas
- Bulk dependency operations
- Import/export workflow as JSON
- Workflow templates library
- Undo/redo functionality
- Collaborative editing

## Support

For issues or questions:
1. Check this guide first
2. Review error messages in the UI
3. Check browser console for technical errors
4. Verify database migration ran successfully

---

**Ready to build your workflows!** Start by navigating to the Workflow Builder and exploring the template mode.

