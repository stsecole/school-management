@echo off
chcp 65001 >nul 2>&1
title تعطيل أداة Snipping Tool لحماية البيانات

echo ============================================================
echo   تعطيل أداة Snipping Tool لحماية البيانات
echo ============================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠ يرجى تشغيل كمسؤول!
    pause
    exit /b 1
)

echo [1/4] تعطيل Snipping Tool (SnippingTool.exe)...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\SnippingTool.exe" /v "Block" /t REG_SZ /d "1" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\TabletPC" /v "DisableSnippingTool" /t REG_DWORD /d 1 /f >nul 2>&1

echo [2/4] تعطيل Snip & Sketch (ScreenClippingHost.exe)...
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "DisabledHotkeys" /t REG_SZ /d "S" /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\TabletPC" /v "DisableSnippingTool" /t REG_DWORD /d 1 /f >nul 2>&1

echo [3/4] تعطيل اختصار Win+Shift+S...
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" /v "DisabledHotkeys" /t REG_SZ /d "S" /f >nul 2>&1

echo [4/4] تعطيل PrintScreen shortcut to Snipping Tool...
reg add "HKCU\Control Panel\Keyboard" /v "PrintScreenKey" /t REG_SZ /d "0" /f >nul 2>&1

echo.
echo ============================================================
echo   ✅ تم تعطيل أدوات التقاط الشاشة
echo ============================================================
echo.
echo   المعطّلة:
echo   - Snipping Tool (SnippingTool.exe)
echo   - Snip & Sketch (ScreenClippingHost.exe)
echo   - اختصار Win+Shift+S
echo   - اختصار PrintScreen → Snipping Tool
echo.
echo   ⚠ ملاحظات:
echo   - يحتاج إعادة تشغيل الجهاز أو تسجيل خروج/دخول
echo   - لإعادة التفعيل، شغّل enable-screenshot-tools.bat
echo.
pause
