@echo off
chcp 65001 >nul
title School Management System - Local Installation
color 0A

echo ============================================================
echo    SCHOOL MANAGEMENT SYSTEM - LOCAL INSTALLATION
echo    Target: C:\school-management
echo ============================================================
echo.

:: Check if running as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Please run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

:: Check Node.js
echo [1/8] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo   Node.js: %%i
echo.

:: Create target directory
echo [2/8] Creating C:\school-management...
if exist "C:\school-management" (
    echo   Folder exists. Existing files will be updated.
) else (
    mkdir "C:\school-management"
)
echo   Done.
echo.

:: Copy project files (from current folder to C:\school-management)
echo [3/8] Copying project files...

if exist "src" (
    xcopy "src" "C:\school-management\src" /E /I /Q /Y >nul
    echo   src\ copied
)
if exist "prisma" (
    xcopy "prisma" "C:\school-management\prisma" /E /I /Q /Y >nul
    echo   prisma\ copied
)
if exist "public" (
    xcopy "public" "C:\school-management\public" /E /I /Q /Y >nul
    echo   public\ copied
)
if exist "package.json" copy "package.json" "C:\school-management\package.json" >nul
if exist "next.config.ts" copy "next.config.ts" "C:\school-management\next.config.ts" >nul
if exist "tsconfig.json" copy "tsconfig.json" "C:\school-management\tsconfig.json" >nul

:: Create .env with correct path
echo DATABASE_URL="file:./db/custom.db" > "C:\school-management\.env"
echo   .env created with correct path

:: Create db folder if not exists
if not exist "C:\school-management\db" mkdir "C:\school-management\db"
echo   db\ folder ready
echo   Done.
echo.

:: Install npm packages
echo [4/8] Installing npm packages (2-5 minutes)...
cd /d "C:\school-management"
call npm install
if %errorlevel% neq 0 (
    echo   ERROR: npm install failed
    pause
    exit /b 1
)
echo   Done.
echo.

:: Generate Prisma
echo [5/8] Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo   ERROR: Prisma generate failed
    pause
    exit /b 1
)
echo   Done.
echo.

:: Create database (only if not exists)
echo [6/8] Setting up database...
if not exist "C:\school-management\db\custom.db" (
    call npx prisma db push
    echo   Database created.
) else (
    echo   Database already exists. Keeping existing data.
)
echo   Done.
echo.

:: Create admin account (only if not exists)
echo [7/8] Creating admin account...
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.findFirst({where:{username:'admin'}}).then(u => { if(!u) { return p.user.create({data:{username:'admin',password:'admin123',name:'Director',role:'director'}}).then(() => {console.log('   Admin created: admin / admin123'); process.exit(0);}); } else { console.log('   Admin already exists'); process.exit(0); }}).catch(e => {console.log('   Error:', e.message); process.exit(0);})"
echo   Done.
echo.

:: Create start.bat
echo [8/8] Creating start.bat...
(
echo @echo off
echo chcp 65001 ^>nul
echo title School Management System
echo cd /d "C:\school-management"
echo echo.
echo echo   Starting School Management System...
echo echo   Open browser: http://localhost:3000
echo echo   Login: admin / admin123
echo echo   Press Ctrl+C to stop
echo echo.
echo npm run dev
echo pause
) > "C:\school-management\start.bat"
echo   start.bat created.

:: Create desktop shortcut
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut(\"$env:USERPROFILE\Desktop\School Management.lnk\"); $Shortcut.TargetPath = 'C:\school-management\start.bat'; $Shortcut.WorkingDirectory = 'C:\school-management'; $Shortcut.Description = 'Start School Management System'; $Shortcut.IconLocation = 'C:\Program Files\nodejs\node.exe,0'; $Shortcut.Save()" 2>nul
echo   Desktop shortcut created.
echo.

echo ============================================================
echo    INSTALLATION COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo   Location: C:\school-management
echo.
echo   To start:
echo     - Double-click "School Management" on Desktop
echo     - Or run: C:\school-management\start.bat
echo.
echo   Browser: http://localhost:3000
echo   Login: admin
echo   Password: admin123
echo.
echo   IMPORTANT: Change password after first login!
echo.
echo ============================================================
pause
