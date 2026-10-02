@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: FamCal Kiosk — Windows SD Card Setup Utility
:: Prepares a freshly flashed Raspberry Pi OS Lite SD card on Windows so it
:: boots straight into FamCal Kiosk OS automatically on first power-up.
:: ==============================================================================

title FamCal Kiosk - Windows SD Card Setup
color 0B

echo ======================================================================
echo     FamCal Kiosk SD Card Setup Utility for Windows
echo ======================================================================
echo.

set SCRIPT_DIR=%~dp0
set REPO_DIR=%SCRIPT_DIR%..

:GET_DRIVE
set /p SD_DRIVE="Enter your SD card drive letter (e.g. E: or D:): "
if "%SD_DRIVE%"=="" goto GET_DRIVE

:: Ensure trailing backslash
if not "%SD_DRIVE:~-1%"=="\" set SD_DRIVE=%SD_DRIVE%\

:: Check for cmdline.txt
set CMDLINE_PATH=
set SUBDIR=
if exist "%SD_DRIVE%firmware\cmdline.txt" (
    set CMDLINE_PATH=%SD_DRIVE%firmware\cmdline.txt
    set SUBDIR=firmware
) else if exist "%SD_DRIVE%cmdline.txt" (
    set CMDLINE_PATH=%SD_DRIVE%cmdline.txt
    set SUBDIR=
) else (
    echo [ERROR] Could not find cmdline.txt on %SD_DRIVE%!
    echo Please make sure you flashed Raspberry Pi OS and selected the FAT32 "bootfs" partition.
    echo.
    goto GET_DRIVE
)

echo [OK] Detected Raspberry Pi boot partition at %SD_DRIVE%
echo.

:: Ask for initial URL
set DEFAULT_URL=http://localhost:8080
echo Enter the web URL you want FamCal Kiosk to launch on startup:
echo (Press ENTER to use local FamCal: %DEFAULT_URL%)
set /p USER_URL="Kiosk URL [%DEFAULT_URL%]: "
if "%USER_URL%"=="" set USER_URL=%DEFAULT_URL%

:: Ask for orientation
echo.
echo Select screen orientation for your display:
echo   1) Portrait 90 degrees clockwise (FamCal 9:16 vertical wall monitor) [Recommended]
echo   2) Landscape 0 degrees (Standard widescreen monitor)
echo   3) Portrait 270 degrees counter-clockwise
set /p ORIENT_CHOICE="Selection [1]: "
if "%ORIENT_CHOICE%"=="" set ORIENT_CHOICE=1

set ORIENTATION=right
if "%ORIENT_CHOICE%"=="1" set ORIENTATION=right
if "%ORIENT_CHOICE%"=="2" set ORIENTATION=normal
if "%ORIENT_CHOICE%"=="3" set ORIENTATION=left

echo.
echo Configuring SD card...

:: Write famcal-url.txt and famcal-orientation.txt
(
    echo # FamCal Kiosk URL Configuration
    echo %USER_URL%
) > "%SD_DRIVE%famcal-url.txt"
echo %ORIENTATION% > "%SD_DRIVE%famcal-orientation.txt"
echo [OK] Created famcal-url.txt and famcal-orientation.txt

:: Copy firstrun.sh
copy /y "%SCRIPT_DIR%firstrun.sh" "%SD_DRIVE%firstrun.sh" >nul
echo [OK] Copied firstrun.sh

:: Copy payload
set PAYLOAD_DEST=%SD_DRIVE%famcal-payload
if not exist "%PAYLOAD_DEST%\kiosk" mkdir "%PAYLOAD_DEST%\kiosk"
if not exist "%PAYLOAD_DEST%\systemd" mkdir "%PAYLOAD_DEST%\systemd"
if not exist "%PAYLOAD_DEST%\web" mkdir "%PAYLOAD_DEST%\web"

copy /y "%SCRIPT_DIR%install.sh" "%PAYLOAD_DEST%\" >nul
xcopy /s /e /y "%SCRIPT_DIR%kiosk\*" "%PAYLOAD_DEST%\kiosk\" >nul
xcopy /s /e /y "%SCRIPT_DIR%systemd\*" "%PAYLOAD_DEST%\systemd\" >nul
xcopy /s /e /y "%SCRIPT_DIR%web\*" "%PAYLOAD_DEST%\web\" >nul

if exist "%REPO_DIR%\dist" (
    if not exist "%PAYLOAD_DEST%\dist" mkdir "%PAYLOAD_DEST%\dist"
    xcopy /s /e /y "%REPO_DIR%\dist\*" "%PAYLOAD_DEST%\dist\" >nul
    echo [OK] Bundled local FamCal web assets
)

:: Update cmdline.txt
findstr /C:"firstrun.sh" "%CMDLINE_PATH%" >nul
if %errorlevel% neq 0 (
    if "%SUBDIR%"=="firmware" (
        powershell -Command "(Get-Content '%CMDLINE_PATH%').Trim() + ' systemd.run=/boot/firmware/firstrun.sh' | Set-Content -NoNewline '%CMDLINE_PATH%'"
    ) else (
        powershell -Command "(Get-Content '%CMDLINE_PATH%').Trim() + ' systemd.run=/boot/firstrun.sh' | Set-Content -NoNewline '%CMDLINE_PATH%'"
    )
    echo [OK] Injected first-boot installer hook into cmdline.txt
)

echo.
echo ======================================================================
echo     SD Card Successfully Configured!
echo ======================================================================
echo Next Steps:
echo   1. Safely Eject the SD card from Windows (Right-click drive -^> Eject).
echo   2. Insert the SD card into your Raspberry Pi 3B+.
echo   3. Connect your HDMI screen, keyboard, and power cable.
echo   4. On first boot, the Pi will auto-install and boot straight into
echo      your full-screen FamCal Kiosk!
echo.
pause
