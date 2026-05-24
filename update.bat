@echo off
echo ===================================
echo   Manga Tracker - Auto Updater
echo ===================================
echo.

echo [1/3] Pulling latest updates from GitHub...
git pull origin main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to pull updates. Make sure you have Git installed and cloned the repo.
    pause
    exit /b %errorlevel%
)
echo.

echo [2/3] Building the Go Server...
echo Building Manga Tracker...
go build -ldflags="-s -w -H=windowsgui" -o manga-tracker.exe
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build the server. Make sure Go is installed.
    pause
    exit /b %errorlevel%
)
echo.

echo [3/3] Update Complete!
echo.
echo =======================================================
echo  IMPORTANT: Chrome Extension Update
echo =======================================================
echo  To apply extension updates, you must:
echo  1. Open Chrome and go to chrome://extensions/
echo  2. Find Manga Tracker
echo  3. Click the reload/refresh icon (circular arrow)
echo =======================================================
echo.
pause
