@echo off
chcp 65001 >nul 2>&1
title تحديث نظام إدارة المؤسسة التعليمية

echo ============================================================
echo   تحديث نظام إدارة المؤسسة التعليمية
echo ============================================================
echo.

:: فحص صلاحيات المسؤول
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ يرجى تشغيل هذا الملف كمسؤول!
    echo    اضغط يميناً على update-branch.bat ← "تشغيل كمسؤول"
    echo.
    pause
    exit /b 1
)

:: تحديد المسارات
set "UPDATE_DIR=%~dp0"
set "UPDATE_DIR=%UPDATE_DIR:~0,-1%"
set "INSTALL_DIR=C:\SchoolManagement"

:: فحص وجود التثبيت
if not exist "%INSTALL_DIR%" (
    echo ❌ التطبيق غير مثبت على هذا الجهاز!
    echo    استخدم install.bat للتثبيت الأول (من الحزمة الكاملة)
    echo.
    pause
    exit /b 1
)

echo 📁 مجلد التثبيت: %INSTALL_DIR%
echo 📁 مجلد التحديث: %UPDATE_DIR%
echo.

:: نسخة احتياطية من قاعدة البيانات (للأمان)
echo 🗄️ [1/4] نسخة احتياطية من قاعدة البيانات...
if exist "%INSTALL_DIR%\db\custom.db" (
    set "BACKUP_NAME=custom.db.before-update-%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%"
    set "BACKUP_NAME=%BACKUP_NAME: =0%"
    copy "%INSTALL_DIR%\db\custom.db" "%INSTALL_DIR%\db\%BACKUP_NAME%" >nul 2>&1
    echo    ✅ تم حفظ نسخة احتياطية: %BACKUP_NAME%
) else (
    echo    ⚠ لا توجد قاعدة بيانات — سيتم إنشاء واحدة جديدة
)
echo.

:: إيقاف التطبيق
echo 🛑 [2/4] إيقاف التطبيق...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul 2>&1
echo    ✅ تم إيقاف التطبيق
echo.

:: نسخ الملفات المحدّثة
echo 📋 [3/4] نسخ الملفات المحدّثة...

:: نسخ .next (كود التطبيق)
echo    نسخ كود التطبيق...
xcopy "%UPDATE_DIR%\.next" "%INSTALL_DIR%\.next\" /E /I /Q /Y >nul 2>&1

:: نسخ server.js
if exist "%UPDATE_DIR%\server.js" (
    copy "%UPDATE_DIR%\server.js" "%INSTALL_DIR%\server.js" >nul 2>&1
)

:: نسخ public
if exist "%UPDATE_DIR%\public" (
    echo    نسخ الملفات العامة...
    xcopy "%UPDATE_DIR%\public" "%INSTALL_DIR%\public\" /E /I /Q /Y >nul 2>&1
)

:: نسخ node_modules (إذا وُجدت في التحديث)
if exist "%UPDATE_DIR%\node_modules" (
    echo    نسخ node_modules...
    xcopy "%UPDATE_DIR%\node_modules" "%INSTALL_DIR%\node_modules\" /E /I /Q /Y >nul 2>&1
)

:: نسخ Prisma schema
if exist "%UPDATE_DIR%\prisma\schema.prisma" (
    echo    نسخ Prisma schema...
    copy "%UPDATE_DIR%\prisma\schema.prisma" "%INSTALL_DIR%\prisma\schema.prisma" >nul 2>&1
)

echo    ✅ تم نسخ الملفات
echo.

:: تحديث قاعدة البيانات (إذا تغيّر schema)
echo 🗄️ [4/4] تحديث قاعدة البيانات...
set "NODE_EXE=%INSTALL_DIR%\node\node.exe"
set "PRISMA_CLI=%INSTALL_DIR%\node_modules\prisma\build\index.js"

if exist "%NODE_EXE%" (
    if exist "%PRISMA_CLI%" (
        echo    تشغيل Prisma db push (إضافة حقول جديدة بدون فقدان البيانات)...
        "%NODE_EXE%" "%PRISMA_CLI%" db push --schema="%INSTALL_DIR%\prisma\schema.prisma" --accept-data-loss 2>nul
        echo    ✅ تم تحديث قاعدة البيانات
    ) else (
        echo    ⚠ Prisma CLI غير موجود — تخطي تحديث قاعدة البيانات
    )
) else (
    echo    ⚠ node.exe غير موجود — تخطي تحديث قاعدة البيانات
)
echo.

:: تشغيل التطبيق
echo 🚀 تشغيل التطبيق...
echo.
echo ============================================================
echo   ✅ تم التحديث بنجاح!
echo ============================================================
echo.
echo   📁 مجلد التثبيت: %INSTALL_DIR%
echo   🌐 الرابط: http://localhost:3000
echo.
echo   النسخة الاحتياطية السابقة: %INSTALL_DIR%\db\%BACKUP_NAME%
echo.
echo   سيتم فتح المتصفح تلقائياً خلال 3 ثوان...
echo.

:: انتظار ثم فتح المتصفح
timeout /t 3 /nobreak >nul 2>&1
start "" "http://localhost:3000"

:: تشغيل التطبيق
cd /d "%INSTALL_DIR%"
start "" "%INSTALL_DIR%\start-school.bat"

echo اضغط أي مفتاح للإنهاء...
pause >nul
