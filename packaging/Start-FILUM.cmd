@echo off
setlocal

set "FILUM_DIR=%~dp0"
set "FILUM_PROFILE=%FILUM_DIR%profile"
set "FILUM_TEMP=%FILUM_DIR%temp"

if not exist "%FILUM_PROFILE%" mkdir "%FILUM_PROFILE%"
if errorlevel 1 exit /b 1
if not exist "%FILUM_TEMP%" mkdir "%FILUM_TEMP%"
if errorlevel 1 exit /b 1

set "TEMP=%FILUM_TEMP%"
set "TMP=%FILUM_TEMP%"

"%FILUM_DIR%browser.exe" -no-remote -profile "%FILUM_PROFILE%"
exit /b %ERRORLEVEL%
