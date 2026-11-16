!include LogicLib.nsh
!include WinMessages.nsh

; Ensure a full reset even if an older installer left the per-user profile
; behind. This removes settings/API key, article cache, translations and the
; last-opened article marker.
!macro customUnInstall
  RMDir /r "$APPDATA\ASBA"
  RMDir /r "$LOCALAPPDATA\ASBA"
!macroend

!macro ASBA_ALIGN_HEADER_BODY
  GetDlgItem $2 $HWNDPARENT 1037
  GetDlgItem $3 $HWNDPARENT 1038
  ${If} $2 != 0
  ${AndIf} $3 != 0
    System::Store "S"

    StrCpy $0 $2
    System::Call 'USER32::GetWindowRect(p r0, @r1)'
    System::Call 'USER32::MapWindowPoints(p0, p$HWNDPARENT, pr1, i2)'
    System::Call '*$1(i.r5, i.r6, i.r7, i.r8)'

    StrCpy $0 $3
    System::Call 'USER32::GetWindowRect(p r0, @r1)'
    System::Call 'USER32::MapWindowPoints(p0, p$HWNDPARENT, pr1, i2)'
    System::Call '*$1(i.r9, i.r2, i.r3, i.r4)'

    System::Call 'USER32::SetWindowPos(p r0, p0, i r5, i r2, i, i, i0x15)'
    System::Store "L"
  ${EndIf}
!macroend

; 把副标题（1038）的左边缘对齐到标题（1037）。
!ifdef BUILD_UNINSTALLER
Function un.AsbaAlignHeader
  !insertmacro ASBA_ALIGN_HEADER_BODY
FunctionEnd
!else
Function AsbaAlignHeader
  !insertmacro ASBA_ALIGN_HEADER_BODY
FunctionEnd
!endif

; 许可协议页：隐藏顶部的 PgDn 提示，并对齐副标题。
!ifndef BUILD_UNINSTALLER
Function LicensePageShow
  FindWindow $0 "#32770" "" $HWNDPARENT
  ${If} $0 != 0
    GetDlgItem $1 $0 1040
    ${If} $1 != 0
      ShowWindow $1 ${SW_HIDE}
    ${EndIf}
  ${EndIf}
  Call AsbaAlignHeader
FunctionEnd
!endif
