@echo off
echo Stopping existing Manga Tracker server...
taskkill /IM manga-tracker.exe /F >nul 2>&1

echo Compiling new version...
go build -ldflags "-H=windowsgui" -o manga-tracker.exe

if %errorlevel% neq 0 (
    echo Build failed! Please check your code.
    pause
    exit /b %errorlevel%
)

echo Starting new Manga Tracker server...
start manga-tracker.exe

echo Update Complete!
pause
