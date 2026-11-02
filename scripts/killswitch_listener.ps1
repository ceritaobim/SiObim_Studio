# CeritaObim Studio — Global Emergency Killswitch Listener
# Mendeteksi penekanan tombol Shift+X, X, atau Escape di seluruh sistem Windows

Add-Type -MemberDefinition @"
  [DllImport("user32.dll")]
  public static extern short GetAsyncKeyState(int vKey);
"@ -Name WinKillswitch -Namespace WinMacro

$flagFile = Join-Path $PSScriptRoot "..\storage\macro\STOP_MACRO.flag"
$flagDir = Split-Path $flagFile
if (-not (Test-Path $flagDir)) {
  New-Item -ItemType Directory -Path $flagDir -Force | Out-Null
}

# 0x58 = 'X'
# 0x10 = 'Shift'
# 0x1B = 'Escape'

while ($true) {
  $xPressed = ([WinMacro.WinKillswitch]::GetAsyncKeyState(0x58) -band 0x8000) -ne 0
  $shiftPressed = ([WinMacro.WinKillswitch]::GetAsyncKeyState(0x10) -band 0x8000) -ne 0
  $escPressed = ([WinMacro.WinKillswitch]::GetAsyncKeyState(0x1B) -band 0x8000) -ne 0

  if ($xPressed -or $escPressed) {
    # Tulis flag file agar skrip lain juga segera berhenti
    Set-Content -Path $flagFile -Value "STOP" -Force -ErrorAction SilentlyContinue
    
    if ($shiftPressed -and $xPressed) {
      Write-Host "EMERGENCY_STOP:SHIFT_X"
    } elseif ($xPressed) {
      Write-Host "EMERGENCY_STOP:X"
    } else {
      Write-Host "EMERGENCY_STOP:ESC"
    }
    break
  }

  Start-Sleep -Milliseconds 80
}
