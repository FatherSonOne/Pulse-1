@echo off
REM start-session.cmd — double-click to spawn a parallel Claude session safely.
REM
REM Runs scripts\branch-safety\start-session.ps1, which:
REM   1. Prompts you for a task slug
REM   2. Fetches latest origin/main
REM   3. Creates an isolated worktree at ..\pulse1-<slug>\ on a fresh feat/<slug> branch
REM   4. Opens a new VSCode window pointed at it
REM
REM Pin this file to your taskbar / Start menu for one-click parallel sessions.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\branch-safety\start-session.ps1"
echo.
pause
