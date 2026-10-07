@echo off
chcp 65001 >nul 2>&1
title تثبيت نظام إدارة المؤسسة التعليمية

echo ============================================================
echo   نظام إدارة المؤسسة التعليمية — التثبيت
echo ============================================================
echo.

:: فحص صلاحيات المسؤول
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ يرجى تشغيل هذا الملف كمسؤول!
    echo    اضغط يميناً على install.bat ← "تشغيل كمسؤول"
    echo.
    pause
    exit /b 1
)

:: تحديد المسارات
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "INSTALL_DIR=C:\SchoolManagement"
set "NODE_EXE=%APP_DIR%\node\node.exe"
set "NPM_CMD=%NODE_EXE% %APP_DIR%\node\node_modules\npm\bin\npm-cli.js"

echo 📁 مجلد التثبيت: %INSTALL_DIR%
echo.

:: نسخ الملفات
echo 📋 [1/5] نسخ الملفات...
if exist "%INSTALL_DIR%" (
    echo    مجلد موجود — سيتم التحديث...
    :: نسخة احتياطية من قاعدة البيانات الحالية
    if exist "%INSTALL_DIR%\db\custom.db" (
        copy "%INSTALL_DIR%\db\custom.db" "%INSTALL_DIR%\db\custom.db.bak" >nul 2>&1
        echo    تم حفظ نسخة احتياطية من قاعدة البيانات الحالية
    )
)
xcopy "%APP_DIR%\*" "%INSTALL_DIR%\" /E /I /Q /Y >nul 2>&1

:: استعادة قاعدة البيانات المحفوظة
if exist "%INSTALL_DIR%\db\custom.db.bak" (
    if not exist "%INSTALL_DIR%\db\custom.db" (
        copy "%INSTALL_DIR%\db\custom.db.bak" "%INSTALL_DIR%\db\custom.db" >nul 2>&1
    )
    del "%INSTALL_DIR%\db\custom.db.bak" >nul 2>&1
)

echo    ✅ تم نسخ الملفات
echo.

:: تهيئة قاعدة البيانات
echo 🗄️ [2/5] تهيئة قاعدة البيانات...
cd /d "%INSTALL_DIR%"

if not exist "%INSTALL_DIR%\db\custom.db" (
    echo    إنشاء قاعدة بيانات جديدة...
    "%NODE_EXE%" "%INSTALL_DIR%\node_modules\prisma\build\index.js" db push --schema="%INSTALL_DIR%\prisma\schema.prisma" --accept-data-loss 2>nul
    echo    ✅ تم إنشاء قاعدة البيانات
) else (
    echo    قاعدة البيانات موجودة — يتم استخدامها
)

:: إنشاء مجلدات ضرورية
if not exist "%INSTALL_DIR%\public\uploads" mkdir "%INSTALL_DIR%\public\uploads"
if not exist "%INSTALL_DIR%\download\backups" mkdir "%INSTALL_DIR%\download\backups"
echo    ✅ تم تهيئة المجلدات
echo.

:: إنشاء اختصار على سطح المكتب
echo 🖥️ [3/5] إنشاء اختصار على سطح المكتب...
set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%" set "DESKTOP=%PUBLIC%\Desktop"

:: إنشاء سكربت VBS لإنشاء الاختصار
echo Set WshShell = WScript.CreateObject("WScript.Shell") > "%TEMP%\create_shortcut.vbs"
echo Set shortcut = WshShell.CreateShortcut("%DESKTOP%\نظام إدارة المؤسسة التعليمية.lnk") >> "%TEMP%\create_shortcut.vbs"
echo shortcut.TargetPath = "%INSTALL_DIR%\start-school.bat" >> "%TEMP%\create_shortcut.vbs"
echo shortcut.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\create_shortcut.vbs"
echo shortcut.IconLocation = "%INSTALL_DIR%\public\favicon.ico, 0" >> "%TEMP%\create_shortcut.vbs"
echo shortcut.Description = "نظام إدارة المؤسسة التعليمية" >> "%TEMP%\create_shortcut.vbs"
echo shortcut.Save >> "%TEMP%\create_shortcut.vbs"
cscript //nologo "%TEMP%\create_shortcut.vbs" >nul 2>&1
del "%TEMP%\create_shortcut.vbs" >nul 2>&1
echo    ✅ تم إنشاء اختصار على سطح المكتب
echo.

:: إضافة للتشغيل التلقائي عند بدء Windows
echo ⚡ [4/5] إعداد التشغيل التلقائي...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
echo Set WshShell = WScript.CreateObject("WScript.Shell") > "%TEMP%\create_startup.vbs"
echo Set shortcut = WshShell.CreateShortcut("%STARTUP%\SchoolManagement.lnk") >> "%TEMP%\create_startup.vbs"
echo shortcut.TargetPath = "%INSTALL_DIR%\start-school.bat" >> "%TEMP%\create_startup.vbs"
echo shortcut.WorkingDirectory = "%INSTALL_DIR%" >> "%TEMP%\create_startup.vbs"
echo shortcut.WindowStyle = 7 >> "%TEMP%\create_startup.vbs"
echo shortcut.Save >> "%TEMP%\create_startup.vbs"
cscript //nologo "%TEMP%\create_startup.vbs" >nul 2>&1
del "%TEMP%\create_startup.vbs" >nul 2>&1
echo    ✅ تم إعداد التشغيل التلقائي
echo.

:: تشغيل التطبيق
echo 🚀 [5/5] تشغيل التطبيق...
echo.
echo ============================================================
echo   ✅ تم التثبيت بنجاح!
echo ============================================================
echo.
echo   📁 مجلد التثبيت: %INSTALL_DIR%
echo   🌐 الرابط: http://localhost:3000
echo   📱 من الأجهزة الأخرى: http://[IP-هذا-الجهاز]:3000
echo.
echo   👤 بيانات الدخول الافتراضية:
echo      المدير: admin / admin123
echo      الموظف: employee / emp123
echo.
echo   ⚠ غيّر كلمات المرور بعد أول دخول!
echo.
echo   سيتم فتح المتصفح تلقائياً خلال 5 ثوان...
echo.

:: انتظار ثم فتح المتصفح
timeout /t 5 /nobreak >nul 2>&1
start "" "http://localhost:3000"

:: تشغيل التطبيق في الخلفية
cd /d "%INSTALL_DIR%"
start "" /B "%INSTALL_DIR%\start-school.bat"

echo اضغط أي مفتاح للإنهاء...
pause >nul
