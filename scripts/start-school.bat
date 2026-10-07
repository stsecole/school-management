@echo off
chcp 65001 >nul 2>&1
title نظام إدارة المؤسسة التعليمية

:: تحديد المسار
set "APP_DIR=%~dp0"
set "APP_DIR=%APP_DIR:~0,-1%"
set "NODE_EXE=%APP_DIR%\node\node.exe"

:: فحص وجود node.exe
if not exist "%NODE_EXE%" (
    echo ❌ خطأ: node.exe غير موجود في %APP_DIR%\node\
    echo    تأكد من اكتمال التثبيت
    pause
    exit /b 1
)

:: تشغيل التطبيق
cd /d "%APP_DIR%"

echo ============================================================
echo   نظام إدارة المؤسسة التعليمية
echo ============================================================
echo.
echo   🌐 الرابط: http://localhost:3000
echo   📱 من الأجهزة الأخرى: http://[IP-هذا-الجهاز]:3000
echo.
echo   لإيقاف التطبيق: اضغط Ctrl+C
echo   لإعادة التشغيل: شغّل هذا الملف مرة أخرى
echo.
echo   جاري التشغيل...
echo.

:: فتح المتصفح بعد 3 ثوان
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: تشغيل خادم Next.js
"%NODE_EXE%" "%APP_DIR%\server.js"
