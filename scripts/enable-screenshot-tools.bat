@echo off
chcp 65001 >nul 2>&1
title إعادة تفعيل أدوات التقاط الشاشة

echo ============================================================
echo   إعادة تفعيل أدوات التقاط الشاشة
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ يرجى تشغيل كمسؤول!
    pause
    exit /b 1
)

echo [1/4] إعادة تفعيل Snipping Tool...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\SnippingTool.exe" /v "Block" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\TabletPC" /v "DisableSnippingTool" /f >nul 2>&1

echo [2/4] إعادة تفعيل Snip & Sketch...
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "DisabledHotkeys" /f >nul 2>&1

echo [3/4] إعادة تفعيل اختصار Win+Shift+S...
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "DisabledHotkeys" /f >nul 2>&1

echo [4/4] إعادة تفعيل PrintScreen...
reg delete "HKCU\Control Panel\Keyboard" /v "PrintScreenKey" /f >nul 2>&1

echo.
echo ============================================================
echo   ✅ تم إعادة تفعيل أدوات التقاط الشاشة
echo ============================================================
echo.
echo   قد تحتاج لتسجيل خروج/دخول أو إعادة تشغيل الجهاز.
echo.
pause
