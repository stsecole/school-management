; ============================================================
; installer.nsi — NSIS Installer Script
; ============================================================
; لإنشاء ملف .exe احترافي:
;
; 1. حمّل NSIS من: https://nsis.sourceforge.io/Download
; 2. ثبّت NSIS
; 3. اضغط يميناً على هذا الملف ← "Compile NSIS Script"
;    أو شغّل: makensis installer.nsi
; 4. سيتم إنشاء: SchoolManagement-Setup.exe
;
; المميزات:
; - واجهة تثبيت احترافية بالعربية
; - اختيار مجلد التثبيت
; - اختصار على سطح المكتب
; - تشغيل تلقائي عند بدء Windows
; - تشغيل التطبيق بعد التثبيت
; - إلغاء التثبيت من لوحة التحكم
; ============================================================

!define APP_NAME "نظام إدارة المؤسسة التعليمية"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "School Management"
!define APP_URL "http://localhost:3000"
!define APP_EXE "start-school.bat"
!define INSTALL_DIR "$LOCALAPPDATA\SchoolManagement"

; Include Modern UI
!include "MUI2.nsh"
!include "LogicLib.nsh"

; General
Name "${APP_NAME}"
OutFile "SchoolManagement-Setup.exe"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKCU "Software\${APP_NAME}" "InstallDir"
RequestExecutionLevel admin
Unicode True

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "public\favicon.ico"
!define MUI_UNICON "public\favicon.ico"

; Language - Arabic + English
!insertmacro MUI_LANGUAGE "Arabic"
!insertmacro MUI_LANGUAGE "English"

; Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_RESERVEFILE_LANGDLL

; ===== Install Section =====
Section "Install" SecInstall
    SetOutPath "$INSTDIR"
    
    ; Copy all files from portable directory
    File /r "school-management-portable\*.*"
    
    ; Initialize database if not exists
    ${IfNot} ${FileExists} "$INSTDIR\db\custom.db"
        DetailPrint "إنشاء قاعدة البيانات..."
        nsExec::ExecToLog '"$INSTDIR\node\node.exe" "$INSTDIR\node_modules\prisma\build\index.js" db push --schema="$INSTDIR\prisma\schema.prisma" --accept-data-loss'
    ${EndIf}
    
    ; Create necessary directories
    CreateDirectory "$INSTDIR\public\uploads"
    CreateDirectory "$INSTDIR\download\backups"
    
    ; Create desktop shortcut
    CreateShortCut "$DESKTOP\${APP_NAME}.lnk" \
                   "$INSTDIR\${APP_EXE}" \
                   "" \
                   "$INSTDIR\public\favicon.ico" \
                   0 \
                   "" \
                   "" \
                   "نظام إدارة المؤسسة التعليمية"
    
    ; Create start menu shortcut
    CreateDirectory "$SMPROGRAMS\${APP_NAME}"
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" \
                   "$INSTDIR\${APP_EXE}" \
                   "" \
                   "$INSTDIR\public\favicon.ico" \
                   0
    
    CreateShortCut "$SMPROGRAMS\${APP_NAME}\إلغاء التثبيت.lnk" \
                   "$INSTDIR\uninstall.exe" \
                   "" \
                   "" \
                   0
    
    ; Add to startup
    CreateShortCut "$SMSTARTUP\SchoolManagement.lnk" \
                   "$INSTDIR\${APP_EXE}" \
                   "" \
                   "$INSTDIR\public\favicon.ico" \
                   0 \
                   "" \
                   "SW_SHOWMINIMIZED"
    
    ; Write registry keys
    WriteRegStr HKCU "Software\${APP_NAME}" "InstallDir" "$INSTDIR"
    WriteRegStr HKCU "Software\${APP_NAME}" "Version" "${APP_VERSION}"
    
    ; Write uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Add to Add/Remove Programs
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "DisplayName" "${APP_NAME}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "DisplayIcon" "$INSTDIR\public\favicon.ico"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "Publisher" "${APP_PUBLISHER}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "DisplayVersion" "${APP_VERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}" \
                     "InstallLocation" "$INSTDIR"
    
    DetailPrint "تم التثبيت بنجاح!"
SectionEnd

; ===== Uninstall Section =====
Section "Uninstall"
    ; Backup database before uninstall
    ${If} ${FileExists} "$INSTDIR\db\custom.db"
        CreateDirectory "$DESKTOP\SchoolManagement-Backup"
        CopyFiles "$INSTDIR\db\custom.db" "$DESKTOP\SchoolManagement-Backup\"
    ${EndIf}
    
    ; Kill running node process
    nsExec::Exec 'taskkill /F /IM node.exe'
    
    ; Delete files
    RMDir /r "$INSTDIR"
    
    ; Delete shortcuts
    Delete "$DESKTOP\${APP_NAME}.lnk"
    RMDir /r "$SMPROGRAMS\${APP_NAME}"
    Delete "$SMSTARTUP\SchoolManagement.lnk"
    
    ; Delete registry keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
    DeleteRegKey HKCU "Software\${APP_NAME}"
    
    DetailPrint "تم إلغاء التثبيت بنجاح!"
SectionEnd

; ===== Run after install =====
Function .onInstSuccess
    MessageBox MB_YESNO|MB_ICONQUESTION "تم التثبيت بنجاح! هل تريد تشغيل التطبيق الآن؟" IDNO NoAutoStart
        Exec '"$INSTDIR\${APP_EXE}"'
        ExecShell "open" "http://localhost:3000"
    NoAutoStart:
FunctionEnd
