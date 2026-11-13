@echo off
rem Double-click to open the character viewer (tools/viewer/) in the default browser.
rem Keep this window open while using the viewer; close it to stop the dev server.
cd /d "%~dp0"
call npm run viewer
