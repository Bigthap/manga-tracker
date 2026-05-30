@echo off
setlocal enabledelayedexpansion

echo ===================================
echo   Manga Tracker - Easy Updater
echo   (No Go/Git Required)
echo ===================================
echo.

:: Config
set "REPO=Bigthap/manga-tracker"
set "TEMP_DIR=%~dp0_update_tmp"
set "ZIP_FILE=%TEMP_DIR%\latest.zip"

:: Step 1: Stop running server
echo [1/5] Stopping Manga Tracker server...
taskkill /IM manga-tracker.exe /F >nul 2>&1
ping 127.0.0.1 -n 3 >nul 2>&1
echo.

:: Step 2: Get latest release download URL from GitHub API
echo [2/5] Checking for latest release...
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/%REPO%/releases/latest'; $asset = $release.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1; if ($asset) { Write-Output $asset.browser_download_url; Write-Output $release.tag_name } else { throw 'No ZIP asset found in latest release' } } catch { Write-Error $_.Exception.Message; exit 1 }" > "%TEMP_DIR%_info.txt" 2>&1

if %errorlevel% neq 0 (
    echo [ERROR] Failed to fetch release info from GitHub.
    echo         Make sure you have internet access.
    type "%TEMP_DIR%_info.txt" 2>nul
    del "%TEMP_DIR%_info.txt" 2>nul
    pause
    exit /b 1
)

:: Parse download URL and version
set /p DOWNLOAD_URL=<"%TEMP_DIR%_info.txt"
for /f "skip=1 delims=" %%a in ('type "%TEMP_DIR%_info.txt"') do set "LATEST_VERSION=%%a"
del "%TEMP_DIR%_info.txt" 2>nul

echo    Latest version: %LATEST_VERSION%
echo    Download URL:   %DOWNLOAD_URL%
echo.

:: Step 3: Download the ZIP
echo [3/5] Downloading %LATEST_VERSION%...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%ZIP_FILE%' -UseBasicParsing } catch { Write-Error $_.Exception.Message; exit 1 }"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to download the release.
    rmdir /S /Q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)
echo.

:: Step 4: Extract and update files
echo [4/5] Extracting and updating files...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TEMP_DIR%\extracted' -Force } catch { Write-Error $_.Exception.Message; exit 1 }"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to extract the ZIP file.
    rmdir /S /Q "%TEMP_DIR%" 2>nul
    pause
    exit /b 1
)

:: Copy files from extracted folder, preserving user data
set "SRC=%TEMP_DIR%\extracted"

:: Handle nested folder structure (ZIP may contain a root folder)
for /d %%d in ("%SRC%\*") do (
    if exist "%%d\manga-tracker.exe" set "SRC=%%d"
    if exist "%%d\run_hidden.vbs" set "SRC=%%d"
)

:: Update exe
if exist "%SRC%\manga-tracker.exe" (
    copy /Y "%SRC%\manga-tracker.exe" "%~dp0manga-tracker.exe" >nul
    echo    Updated: manga-tracker.exe
)

:: Update run_hidden.vbs
if exist "%SRC%\run_hidden.vbs" (
    copy /Y "%SRC%\run_hidden.vbs" "%~dp0run_hidden.vbs" >nul
    echo    Updated: run_hidden.vbs
)

:: Update README
if exist "%SRC%\README.md" (
    copy /Y "%SRC%\README.md" "%~dp0README.md" >nul
    echo    Updated: README.md
)

:: Update extension folder
if exist "%SRC%\extension" (
    xcopy /E /Y /I "%SRC%\extension" "%~dp0extension" >nul
    echo    Updated: extension\
)

:: Preserve user data (NOT copied):
echo.
echo    Preserved (not overwritten):
echo      - config.json (your API key)
echo      - manga_tracker.db (your manga data)
echo      - covers\ (your cached images)

:: Step 5: Cleanup
echo.
echo [5/5] Cleaning up...
rmdir /S /Q "%TEMP_DIR%" 2>nul
echo.

echo =======================================================
echo  UPDATE COMPLETE! (%LATEST_VERSION%)
echo =======================================================
echo.
echo  Next steps:
echo  1. Double-click run_hidden.vbs to start the server
echo  2. Go to chrome://extensions/
echo  3. Find Manga Tracker and click the refresh icon
echo =======================================================
echo.
pause
