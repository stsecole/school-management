@echo off
cd /d "%~dp0.."

echo ============================================================
echo   Build Update Package
echo ============================================================
echo.

echo [1/6] Building Next.js (standalone)...
call npx next build
if %errorlevel% neq 0 (
    echo BUILD FAILED!
    pause
    exit /b 1
)

echo.
echo [2/6] Copying static files to standalone...
if not exist ".next\standalone\.next" mkdir ".next\standalone\.next"
xcopy ".next\static" ".next\standalone\.next\static\" /E /I /Q /Y >nul 2>&1

echo    Copying public to standalone...
xcopy "public" ".next\standalone\public\" /E /I /Q /Y >nul 2>&1

echo.
echo [3/6] Creating update folder...
set "UPDATE_DIR=%CD%\school-management-update"
if exist "%UPDATE_DIR%" rmdir /s /q "%UPDATE_DIR%"
mkdir "%UPDATE_DIR%"
mkdir "%UPDATE_DIR%\.next"
mkdir "%UPDATE_DIR%\prisma"
mkdir "%UPDATE_DIR%\public"

echo.
echo [4/6] Copying files...

echo    Copying standalone...
xcopy ".next\standalone\*" "%UPDATE_DIR%\" /E /I /Q /Y >nul 2>&1

echo    Copying static...
xcopy ".next\static" "%UPDATE_DIR%\.next\static\" /E /I /Q /Y >nul 2>&1

echo    Copying public...
xcopy "public\*" "%UPDATE_DIR%\public\" /E /I /Q /Y >nul 2>&1
del "%UPDATE_DIR%\public\custom.db" 2>nul

echo    Copying prisma schema...
copy "prisma\schema.prisma" "%UPDATE_DIR%\prisma\" >nul 2>&1

echo    Copying update-branch.bat...
copy "scripts\update-branch.bat" "%UPDATE_DIR%\" >nul 2>&1

if exist "%UPDATE_DIR%\db" rmdir /s /q "%UPDATE_DIR%\db"
if exist "%UPDATE_DIR%\download" rmdir /s /q "%UPDATE_DIR%\download"

echo    Cleaning node_modules...
if exist "%UPDATE_DIR%\node_modules\typescript" rmdir /s /q "%UPDATE_DIR%\node_modules\typescript"

echo.
echo [5/6] Zipping...
set "ZIP_FILE=%CD%\school-management-update.zip"
if exist "%ZIP_FILE%" del "%ZIP_FILE%"
powershell -Command "Compress-Archive -Path '%UPDATE_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

echo.
echo [6/6] Done!
echo.
echo ============================================================
echo   SUCCESS! Update package created.
echo ============================================================
echo.
echo   File: school-management-update.zip
echo   Path: %ZIP_FILE%
echo.
echo   Steps to deploy:
echo   1. Copy school-management-update.zip to branch PC
echo   2. Extract the zip
echo   3. Copy contents to C:\SchoolManagement\
echo   4. Right-click update-branch.bat - Run as admin
echo.
pause
