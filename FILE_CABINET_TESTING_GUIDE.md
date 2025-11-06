# File Cabinet - Quick Testing Guide

## Prerequisites

Before testing the File Cabinet feature, ensure:

1. ✅ Backend server is running
2. ✅ Frontend dev server is running  
3. ✅ You have a test period created with some tasks
4. ✅ Database migration has been run

## Running the Migration

**IMPORTANT**: Run this first before testing!

```bash
# From project root directory
venv/scripts/python.exe backend/migrations/migrate_add_period_files.py
```

Expected output:
```
Starting migration: Add period-level file support
Step 1: Adding period_id column...
  ✓ period_id column added
Step 2: Adding foreign key constraint...
  ✓ Foreign key constraint added
...
Migration completed successfully!
```

## Test Scenarios

### Test 1: Access File Cabinet

1. Log into the application
2. Click **"File Cabinet"** in the left sidebar
3. ✅ Page should load without errors
4. ✅ You should see a period selector dropdown
5. ✅ Three sections should be visible (collapsed or expanded)

### Test 2: Upload Period-Level File

1. Select a period from the dropdown
2. Click **"Upload Files"** button
3. Ensure **"Period Files"** is selected in the upload target dropdown
4. Drag and drop a test file (or click browse)
5. Add a description: "Test period document"
6. Click **"Upload"**
7. ✅ File should appear in the "Period Files" section
8. ✅ File should show name, size, upload date, and your name

### Test 3: Upload Task File

1. Click **"Upload Files"** button
2. Select a specific task from the dropdown
3. Drag and drop a test file
4. Add a description: "Test task document"
5. Click **"Upload"**
6. Expand the "Task Files" section
7. Find and expand the task you uploaded to
8. ✅ File should appear under that task
9. ✅ Task should show file count badge

### Test 4: Multiple File Upload

1. Click **"Upload Files"** button
2. Select upload target (period or task)
3. Drag multiple files at once (3-5 files)
4. ✅ All files should appear in the selected files list
5. Click **"Upload"**
6. ✅ All files should be uploaded successfully
7. ✅ Files should appear in the correct section

### Test 5: Download Individual File

1. In any section, find a file
2. Click the download icon (⬇️) next to the file
3. ✅ File should download to your Downloads folder
4. ✅ File should have the original filename
5. ✅ File content should be intact

### Test 6: Download ZIP Archive

1. Ensure the selected period has several files (period files, task files)
2. Click **"Download All as ZIP"** button at the top
3. ✅ Button should show "Preparing..." briefly
4. ✅ ZIP file should download: `{Period_Name}_files.zip`
5. ✅ Open the ZIP file
6. ✅ Verify folder structure:
   - `period_files/` - Contains period-level files
   - `tasks/{task_name}/` - Contains task files organized by task
   - `trial_balance/` - Contains trial balance files (if any)

### Test 7: Delete File

1. Find any file in any section
2. Click the trash icon (🗑️) next to the file
3. ✅ Confirmation dialog should appear
4. Click "OK" to confirm
5. ✅ File should be removed from the list
6. Refresh the page
7. ✅ File should still be gone (persisted)

### Test 8: Expand/Collapse Sections

1. Click on "Period Files" section header
2. ✅ Section should collapse/expand
3. Repeat for "Task Files" and "Trial Balance Files"
4. ✅ All sections should be independently collapsible
5. ✅ Badge counts should always be visible

### Test 9: Task File Tree Navigation

1. Go to "Task Files" section
2. ✅ Should see a list of tasks with file counts
3. Click on a task to expand it
4. ✅ Task should expand showing its files
5. ✅ Task status should be displayed with color coding
6. Click task again to collapse
7. ✅ Files should hide

### Test 10: Period Switching

1. Select one period from dropdown
2. Note the files displayed
3. Switch to a different period
4. ✅ File counts should update
5. ✅ Different files should be displayed
6. ✅ No errors should occur

### Test 11: Empty States

1. Create a brand new period with no tasks or files
2. Select that period
3. ✅ "Period Files" section should show "No period-level files" message
4. ✅ "Task Files" section should show "No tasks with files" message
5. ✅ "Trial Balance Files" section should show "No trial balance files" message

### Test 12: External Link Files (If Applicable)

If you have external file links in your system:
1. Find a file marked with the external link icon (🔗)
2. Click download
3. ✅ Should open the external URL in a new tab
4. ✅ Should not download a local file

## Backend API Testing (Optional)

### Using Swagger UI

1. Navigate to `http://localhost:8000/docs`
2. Find the `/api/files/period/{period_id}/all` endpoint
3. Click "Try it out"
4. Enter a period ID (e.g., 1)
5. Click "Execute"
6. ✅ Should return JSON with period, period_files, task_files, trial_balance_files

### Using curl

```bash
# Get all files for period 1
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/files/period/1/all

# Upload a period file
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "period_id=1" \
  -F "file=@/path/to/test.pdf" \
  -F "description=Test upload" \
  http://localhost:8000/api/files/upload-period

# Download ZIP
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/files/period/1/download-zip \
  -o period_files.zip
```

## Common Issues & Solutions

### Issue: "Period not found" error
**Solution**: Ensure you have at least one period created in the system

### Issue: Files not appearing after upload
**Solution**: 
- Check browser console for errors
- Verify file was actually uploaded (check `files/` directory)
- Refresh the page
- Check that migration was run successfully

### Issue: ZIP download fails
**Solution**:
- Check total file size (very large archives may fail)
- Check server logs for errors
- Verify files exist on disk

### Issue: Migration fails
**Solution**:
- Check database connection
- Verify you're using the correct Python environment
- Check database user has ALTER TABLE permissions
- Review error message in console

### Issue: Upload button disabled
**Solution**: 
- Ensure a period is selected
- Check that you're logged in
- Verify your user has upload permissions

## Performance Testing

### Large File Sets
1. Upload 50+ files to a period
2. ✅ Page should still load within a few seconds
3. ✅ ZIP generation should complete (may take 10-30 seconds)
4. ✅ UI should remain responsive

### Large Files
1. Upload a file > 10MB
2. ✅ Should upload successfully (up to configured limit)
3. ✅ Should appear in file list
4. ✅ Should be included in ZIP download

## Cleanup After Testing

To clean up test files:

```bash
# Delete test period files (be careful!)
# rm -rf files/202510/*  # Example for October 2025
```

Or use the UI to delete files individually.

## Success Criteria

The File Cabinet feature is working correctly if:

✅ All 12 test scenarios pass
✅ No console errors appear
✅ Files upload and download correctly
✅ ZIP archives contain all expected files
✅ File organization is logical and easy to navigate
✅ UI is responsive and intuitive

## Reporting Issues

If you encounter issues:

1. Check browser console for errors (F12)
2. Check backend logs
3. Verify migration was successful
4. Note the exact steps to reproduce
5. Check that you're using the correct API URL

---

**Happy Testing! 🎉**








