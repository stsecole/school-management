@echo off
chcp 65001 >nul 2>&1
title إلغاء تثبيت نظام إدارة المؤسسة

echo ============================================================
echo   إلغاء تثبيت نظام إدارة المؤسسة التعليمية
echo ============================================================
echo.

:: فحص صلاحيات المسؤول
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ يرجى تشغيل هذا الملف كمسؤول!
    echo    اضغط يميناً على uninstall.bat ← "تشغيل كمسؤول"
    pause
    exit /b 1
)

set "INSTALL_DIR=C:\SchoolManagement"

if not exist "%INSTALL_DIR%" (
    echo ❌ التطبيق غير مثبت على هذا الجهاز.
    pause
    exit /b 0
)

echo ⚠ تحذير: سيتم حذف جميع البيانات!
echo    مجلد التثبيت: %INSTALL_DIR%
echo.
echo    يُنصح بأخذ نسخة احتياطية قبل الإلغاء.
echo.

set /p CONFIRM="هل أنت متأكد؟ اكتب 'نعم' للمتابعة: "
if /i not "%CONFIRM%"=="نعم" (
    echo تم الإلغاء.
    pause
    exit /b 0
)

:: نسخة احتياطية قبل الحذف
echo.
echo 📦 أخذ نسخة احتياطية قبل الحذف...
if exist "%INSTALL_DIR%\db\custom.db" (
    set "BACKUP_DIR=%USERPROFILE%\Desktop\SchoolManagement-Backup-%date:~-4%%date:~3,2%%date:~0,2%"
    mkdir "%BACKUP_DIR%" 2>nul
    copy "%INSTALL_DIR%\db\custom.db" "%BACKUP_DIR%\" >nul 2>&1
    if exist "%INSTALL_DIR%\download\backups" (
        xcopy "%INSTALL_DIR%\download\backups" "%BACKUP_DIR%\backups\" /E /I /Q /Y >nul 2>&1
    )
    echo    ✅ تم حفظ النسخة الاحتياطية في: %BACKUP_DIR%
)

:: حذف الاختصارات
echo.
echo 🗑️ حذف الاختصارات...
del "%USERPROFILE%\Desktop\نظام إدارة المؤسسة التعليمية.lnk" >nul 2>&1
del "%PUBLIC%\Desktop\نظام إدارة المؤسسة التعليمية.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SchoolManagement.lnk" >nul 2>&1

:: إيقاف التطبيق
echo 🛑 إيقاف التطبيق...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq نظام*" >nul 2>&1

:: حذف الملفات
echo 🗑️ حذف الملفات...
rd /s /q "%INSTALL_DIR%" 2>nul

if exist "%INSTALL_DIR%" (
    echo    ⚠ بعض الملفات لا يمكن حذفها (قد تكون قيد الاستخدام)
    echo    أعد تشغيل الجهاز ثم احذف المجلد يدوياً:
    echo    %INSTALL_DIR%
) else (
    echo    ✅ تم الحذف بنجاح
)

echo.
echo ============================================================
echo   ✅ تم إلغاء التثبيت
echo ============================================================
echo.
echo   النسخة الاحتياطية (إن وُجدت): %BACKUP_DIR%
echo.
pause
