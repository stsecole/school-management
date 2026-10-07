@echo off
title School Management System - Build Deploy Package
echo ============================================
echo   Building Deployment Package for Branches
echo ============================================
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo ERROR: Run this file from the project folder
    pause
    exit /b 1
)

:: Clean previous build
echo [1/6] Cleaning previous build...
if exist ".next" rmdir /s /q ".next"
if exist "dist" rmdir /s /q "dist"
echo Done.
echo.

:: Generate Prisma Client
echo [2/6] Generating Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo ERROR: Prisma generate failed
    pause
    exit /b 1
)
echo Done.
echo.

:: Build the application
echo [3/6] Building application for production...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo Done.
echo.

:: Create package folder
echo [4/6] Creating deployment package...
set "PACKAGE_NAME=school-management-deploy"
set "PACKAGE_DIR=dist\%PACKAGE_NAME%"

mkdir "%PACKAGE_DIR%\app"
mkdir "%PACKAGE_DIR%\app\db"
mkdir "%PACKAGE_DIR%\app\public"
mkdir "%PACKAGE_DIR%\app\prisma"

echo   Copying standalone files...
xcopy ".next\standalone\*" "%PACKAGE_DIR%\app\" /E /I /Q /Y >nul
xcopy ".next\static" "%PACKAGE_DIR%\app\.next\static" /E /I /Q /Y >nul
xcopy "public" "%PACKAGE_DIR%\app\public" /E /I /Q /Y >nul
xcopy "prisma" "%PACKAGE_DIR%\app\prisma" /E /I /Q /Y >nul

echo   Copying config files...
copy "package.json" "%PACKAGE_DIR%\app\package.json" >nul
copy ".env" "%PACKAGE_DIR%\app\.env" >nul
copy "next.config.ts" "%PACKAGE_DIR%\app\next.config.ts" >nul

echo   Creating empty database placeholder...
if exist "%PACKAGE_DIR%\app\db\custom.db" del "%PACKAGE_DIR%\app\db\custom.db"
echo. > "%PACKAGE_DIR%\app\db\.gitkeep"

echo Done.
echo.

:: Create start.bat
echo [5/6] Creating startup files...

(
echo @echo off
echo title School Management System
echo cd /d "%%~dp0app"
echo.
echo if not exist "db\custom.db" (
echo     echo Setting up database for first time...
echo     call npx prisma db push
echo     echo.
echo     echo Creating admin account...
echo     node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.create({data:{username:'admin',password:'admin123',name:'Director',role:'director'}}).then(() => {console.log('Admin created successfully'); process.exit(0);}).catch(() => {console.log('Admin already exists'); process.exit(0);})"
echo )
echo.
echo echo Starting School Management System...
echo echo.
echo echo Open browser at: http://localhost:3000
echo echo To stop: Press Ctrl+C
echo echo.
echo node server.js
echo pause
) > "%PACKAGE_DIR%\start.bat"

:: Create setup.bat
(
echo @echo off
title School Management System - Setup
echo ============================================
echo   School Management System - First Time Setup
echo ============================================
echo.
echo This will set up the system for this branch.
echo.
echo Default login: admin / admin123
echo.
echo ============================================
echo.
pause
echo.
cd /d "%%~dp0app"
echo.
echo [1/4] Generating Prisma Client...
call npx prisma generate
echo.
echo [2/4] Creating database...
call npx prisma db push
echo.
echo [3/4] Creating admin account...
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.create({data:{username:'admin',password:'admin123',name:'Director',role:'director'}}).then(() => {console.log('Admin created successfully'); process.exit(0);}).catch(() => {console.log('Admin already exists'); process.exit(0);})"
echo.
echo [4/4] Setup complete!
echo.
echo ============================================
echo   Setup completed successfully!
echo ============================================
echo.
echo   Username: admin
echo   Password: admin123
echo.
echo   Run start.bat to start the system
echo.
echo   IMPORTANT: Change password after first login!
echo ============================================
echo.
pause
) > "%PACKAGE_DIR%\setup.bat"

:: Create README.txt
(
echo ============================================
echo   School Management System - Branch Package
echo ============================================
echo.
echo Contents:
echo   app\          - Application files
echo   start.bat     - Run the system
echo   setup.bat     - First time setup (run once)
echo.
echo Installation:
echo   1. Copy this folder to the branch computer
echo   2. Run setup.bat once
echo   3. Run start.bat to start
echo   4. Open browser: http://localhost:3000
echo.
echo Default Login:
echo   Username: admin
echo   Password: admin123
echo.
echo IMPORTANT:
echo   - Change password after first login
echo   - Create backup after entering data
echo   - Do NOT delete the db folder
echo.
echo ============================================
) > "%PACKAGE_DIR%\README.txt"

echo Done.
echo.

:: Zip the package
echo [6/6] Zipping the package...
cd dist
powershell -Command "Compress-Archive -Path '%PACKAGE_NAME%' -DestinationPath '%PACKAGE_NAME%.zip' -Force"
cd ..
echo Done.
echo.

echo ============================================
echo   Build completed successfully!
echo ============================================
echo.
echo   Package: dist\%PACKAGE_NAME%.zip
echo   Folder:  dist\%PACKAGE_NAME%\
echo.
echo   To deploy to a branch:
echo   1. Copy zip file to branch computer
echo   2. Extract
echo   3. Run setup.bat
echo   4. Run start.bat
echo.
echo ============================================
pause
