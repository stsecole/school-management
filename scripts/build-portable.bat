@echo off
chcp 65001 >nul 2>&1
title بناء الحزمة المحمولة الكاملة

echo ============================================================
echo   بناء الحزمة المحمولة الكاملة (للتثبيت الأول على الفروع)
echo ============================================================
echo.

:: تحديد المسار
set "PROJECT_DIR=%~dp0.."
cd /d "%PROJECT_DIR%"

echo 📦 [1/6] بناء Next.js...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ فشل البناء!
    pause
    exit /b 1
)

echo.
echo 📁 [2/6] إنشاء مجلد الحزمة...
set "PORTABLE_DIR=%PROJECT_DIR%\school-management-portable"
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%\.next"

echo.
echo 📋 [3/6] نسخ ملفات التطبيق...
xcopy ".next\standalone\*" "%PORTABLE_DIR%\" /E /I /Q /Y >nul 2>&1
xcopy ".next\static" "%PORTABLE_DIR%\.next\static\" /E /I /Q /Y >nul 2>&1
xcopy "public\*" "%PORTABLE_DIR%\public\" /E /I /Q /Y >nul 2>&1

echo.
echo 🗄️ [4/6] نسخ Prisma...
mkdir "%PORTABLE_DIR%\prisma"
copy "prisma\schema.prisma" "%PORTABLE_DIR%\prisma\" >nul 2>&1
mkdir "%PORTABLE_DIR%\db"

echo.
echo ⚙️ [5/6] نسخ سكربتات التثبيت...
copy "scripts\install.bat" "%PORTABLE_DIR%\" >nul 2>&1
copy "scripts\start-school.bat" "%PORTABLE_DIR%\" >nul 2>&1
copy "scripts\uninstall.bat" "%PORTABLE_DIR%\" >nul 2>&1

:: حذف مجلدات غير ضرورية
if exist "%PORTABLE_DIR%\db\custom.db" del "%PORTABLE_DIR%\db\custom.db"
if exist "%PORTABLE_DIR%\download" rmdir /s /q "%PORTABLE_DIR%\download"

echo.
echo 🗜️ [6/6] ضغط الحزمة...
set "ZIP_FILE=%PROJECT_DIR%\school-management-portable.zip"
if exist "%ZIP_FILE%" del "%ZIP_FILE%"
powershell -Command "Compress-Archive -Path '%PORTABLE_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"

echo.
echo ============================================================
echo   ✅ تم إنشاء الحزمة المحمولة بنجاح!
echo ============================================================
echo.
echo   📦 الملف: school-management-portable.zip
echo   📍 المسار: %ZIP_FILE%
echo.
echo   ⚠ ملاحظة: هذه الحزمة لا تتضمن node.exe
echo   تحتاج لتثبيت Node.js على جهاز الفرع، أو نسخ node.exe يدوياً
echo   من C:\Program Files\nodejs\ إلى مجلد school-management-portable\node\
echo.
echo   📋 خطوات التوزيع:
echo      1. انسخ school-management-portable.zip إلى جهاز الفرع
echo      2. استخرج الملف في C:\
echo      3. اضغط يميناً على install.bat ← "تشغيل كمسؤول"
echo.
pause
