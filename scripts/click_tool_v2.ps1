param(
  [int]$X = 0,
  [int]$Y = 0,
  [switch]$ClickNewProject,
  [switch]$DismissFlowModal,
  [switch]$ClickExpandPrompt,
  [switch]$ClickPlusButton,
  [switch]$ClickUploadMedia,
  [string]$SelectFileDialogFile = "",
  [switch]$ClickIAgree,
  [switch]$ClickEmptySpace,
  [switch]$PasteAndTagObim,
  [switch]$PasteTagAndSubmit,
  [switch]$ClickSubmitArrow,
  [switch]$ClickApprove,
  [switch]$ExtractGoogleOneCredit
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
  Add-Type -MemberDefinition @"
    [DllImport("user32.dll")]
    public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
      public int Left;
      public int Top;
      public int Right;
      public int Bottom;
    }
"@ -Name U32 -Namespace WinMouse -ErrorAction SilentlyContinue
} catch {}

# Mengaktifkan DPI Awareness agar koordinat fisik layar selalu tepat
try { [WinMouse.U32]::SetProcessDPIAware() } catch {}

$screenWidth = [WinMouse.U32]::GetSystemMetrics(0)
$screenHeight = [WinMouse.U32]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

# Cek Emergency Stop flag
$flagFile = Join-Path $PSScriptRoot "..\storage\macro\STOP_MACRO.flag"
if (Test-Path $flagFile) {
  Write-Host "ABORT: Emergency stop flag detected."
  exit 99
}

$ws = New-Object -ComObject WScript.Shell
$act = $ws.AppActivate('Google Flow')
if (-not $act) { $null = $ws.AppActivate('Chrome') }
Start-Sleep -Milliseconds 350

# 1. Klik "+ New project"
if ($ClickNewProject) {
  $X = [int]($screenWidth * 0.50)
  $Y = [int]($screenHeight * 0.76)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 120
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('{ENTER}')
  Write-Host "SUCCESS: Clicked '+ New project' at ($X, $Y)"
  exit 0
}

# 1b. Menutup modal pengumuman / changelog Flow ("Easier asset management") jika muncul
if ($DismissFlowModal) {
  # 1. Kirim Escape
  $ws.SendKeys('{ESC}')
  Start-Sleep -Milliseconds 250

  # 2. Klik tombol 'Get started' (posisi terkalibrasi: X = 61.8%, Y = 78.9%)
  $modalBtnX = [int]($screenWidth * 0.618)
  $modalBtnY = [int]($screenHeight * 0.789)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($modalBtnX, $modalBtnY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 250

  # 3. Kirim Escape sekali lagi
  $ws.SendKeys('{ESC}')

  Write-Host "SUCCESS: Dismissed announcement modal via Get started & Escape"
  exit 0
}

# 2. Klik "Luaskan" (Expand Prompt Panel)
if ($ClickExpandPrompt) {
  $expX = [int]($screenWidth * 0.6758)
  $expY = [int]($screenHeight * 0.8217)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($expX, $expY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 600
  Write-Host "SUCCESS: Clicked expand button (luaskan) at ($expX, $expY)"
  exit 0
}

# 3. Klik '+' di kolom chat
if ($ClickPlusButton) {
  $X = [int]($screenWidth * 0.792)
  $Y = [int]($screenHeight * 0.894)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Write-Host "SUCCESS: Clicked '+' button at ($X, $Y)"
  exit 0
}

# 4. Klik 'Upload media'
if ($ClickUploadMedia) {
  $X = [int]($screenWidth * 0.542)
  $Y = [int]($screenHeight * 0.768)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Write-Host "SUCCESS: Clicked 'Upload media' button at ($X, $Y)"
  exit 0
}

# 5. Navigasi File Picker dan Pilih obim.jpg
if ($SelectFileDialogFile -ne "") {
  $hWnd = [IntPtr]::Zero
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 300
    $hWnd = [WinMouse.U32]::FindWindow("#32770", "Open")
    if ($hWnd -eq [IntPtr]::Zero) { $hWnd = [WinMouse.U32]::FindWindow("#32770", "Buka") }
    if ($hWnd -ne [IntPtr]::Zero) { break }
    if ($ws.AppActivate('Open') -or $ws.AppActivate('Buka')) { break }
  }

  Start-Sleep -Milliseconds 400
  if ($hWnd -ne [IntPtr]::Zero) {
    [WinMouse.U32]::SetForegroundWindow($hWnd)
  } else {
    $null = $ws.AppActivate('Open')
    $null = $ws.AppActivate('Buka')
  }
  Start-Sleep -Milliseconds 300

  $rect = New-Object WinMouse.U32+RECT
  $hasRect = $false
  if ($hWnd -ne [IntPtr]::Zero) {
    $hasRect = [WinMouse.U32]::GetWindowRect($hWnd, [ref]$rect)
  }

  if ($hasRect -and ($rect.Right -gt $rect.Left)) {
    $addrX = $rect.Left + 250
    $addrY = $rect.Top + 68
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($addrX, $addrY)
    Start-Sleep -Milliseconds 150
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 80
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 200
  }

  $ws.SendKeys('%d')
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 150

  $folderPath = [System.IO.Path]::GetDirectoryName($SelectFileDialogFile)
  if (-not $folderPath.EndsWith('\')) { $folderPath += '\' }
  $fileName = [System.IO.Path]::GetFileName($SelectFileDialogFile)

  [System.Windows.Forms.Clipboard]::SetText($folderPath)
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 300
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 800

  if ($hasRect -and ($rect.Right -gt $rect.Left)) {
    $fileListX = $rect.Left + [int](($rect.Right - $rect.Left) * 0.50)
    $fileListY = $rect.Top + [int](($rect.Bottom - $rect.Top) * 0.40)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($fileListX, $fileListY)
    Start-Sleep -Milliseconds 150
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 80
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 250
  }

  $ws.SendKeys($fileName)
  Start-Sleep -Milliseconds 400
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 600

  # Cadangan via Alt+N
  $checkHwnd = [WinMouse.U32]::FindWindow("#32770", "Open")
  if ($checkHwnd -eq [IntPtr]::Zero) { $checkHwnd = [WinMouse.U32]::FindWindow("#32770", "Buka") }
  if ($checkHwnd -ne [IntPtr]::Zero) {
    $ws.SendKeys('%n')
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.Clipboard]::SetText($fileName)
    Start-Sleep -Milliseconds 100
    $ws.SendKeys('^a')
    Start-Sleep -Milliseconds 100
    $ws.SendKeys('^v')
    Start-Sleep -Milliseconds 200
    $ws.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 400
  }

  Write-Host "SUCCESS: Selected file '$fileName'"
  exit 0
}

# 6. Klik 'I agree'
if ($ClickIAgree) {
  $agreeX = [int]($screenWidth * 0.644)
  $agreeY = [int]($screenHeight * 0.610)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($agreeX, $agreeY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200
  Write-Host "SUCCESS: Clicked 'I agree'"
  exit 0
}

# 7. Menutup panel flyout aset via tombol Escape (ESC)
if ($ClickEmptySpace) {
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 200

  # Kirim tombol Escape untuk menutup popup/flyout seketika
  $ws.SendKeys('{ESC}')
  Start-Sleep -Milliseconds 300

  Write-Host "SUCCESS: Dismissed upload popup via Escape (ESC) key"
  exit 0
}

# 7b. Paste Prompt + Ketik @obim.jpg + Kunci Chip (TANPA SUBMIT)
# Menggunakan teknik klik tombol kirim untuk memfokuskan teks area
if ($PasteAndTagObim) {
  # Koordinat terkalibrasi dari screenshot pengguna:
  # Tombol Panah Kirim (Submit Arrow ->): X = 97.2%, Y = 89.6%
  # Kolom Teks Chatbox ("What do you want to create?"): X = 84.5%, Y = 89.6%
  $btnX = [int]($screenWidth * 0.972)
  $btnY = [int]($screenHeight * 0.896)
  $promptX = [int]($screenWidth * 0.845)
  $promptY = [int]($screenHeight * 0.896)

  # 1. Klik tombol panah kirim (Submit Arrow) di ujung kanan untuk mengaktifkan teks area
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $btnY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  # Klik juga langsung di tengah chatbox sebagai pengunci fokus ganda
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 350

  # 2. Select All (Ctrl+A) & Paste Prompt (Ctrl+V)
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 800

  # 3. Kursor berpindah ke huruf paling akhir prompt (Ctrl+End)
  $ws.SendKeys('^{END}')
  Start-Sleep -Milliseconds 300

  # 4. Mengetik spasi, lalu @
  $ws.SendKeys(' ')
  Start-Sleep -Milliseconds 250
  $ws.SendKeys('@')
  Start-Sleep -Milliseconds 800

  # 5. Mengetik obim.jpg, lalu menekan ENTER agar berubah menjadi chip bulat biru @obim.jpg
  $ws.SendKeys('obim.jpg')
  Start-Sleep -Milliseconds 600
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 500

  Write-Host "SUCCESS: Focused via submit button ($btnX, $btnY) & chatbox ($promptX, $promptY), pasted prompt & locked @obim.jpg chip WITHOUT submitting"
  exit 0
}

# 8. Paste Prompt + Ketik @obim.jpg + Kunci Chip + Klik Submit Arrow (FULL SOP)
if ($PasteTagAndSubmit) {
  $btnX = [int]($screenWidth * 0.972)
  $btnY = [int]($screenHeight * 0.896)
  $promptX = [int]($screenWidth * 0.845)
  $promptY = [int]($screenHeight * 0.896)

  # 1. Klik tombol panah kirim (Submit Arrow) di ujung kanan untuk mengaktifkan teks area
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $btnY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  # Klik juga langsung di tengah chatbox sebagai pengunci fokus ganda
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 350

  # 2. Select All (Ctrl+A) & Paste Prompt (Ctrl+V)
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 800

  # 3. Kursor berpindah ke huruf paling akhir prompt (Ctrl+End)
  $ws.SendKeys('^{END}')
  Start-Sleep -Milliseconds 300

  # 4. Mengetik spasi, lalu @
  $ws.SendKeys(' ')
  Start-Sleep -Milliseconds 250
  $ws.SendKeys('@')
  Start-Sleep -Milliseconds 800

  # 5. Mengetik obim.jpg, lalu menekan ENTER agar berubah menjadi chip bulat biru @obim.jpg
  $ws.SendKeys('obim.jpg')
  Start-Sleep -Milliseconds 600
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 600

  # 6. Klik tombol panah kirim (Submit Arrow ->) untuk mulai proses render
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $btnY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  # Cadangan enter submit
  $ws.SendKeys('{ENTER}')

  Write-Host "SUCCESS: Prompt submitted at ($btnX, $btnY)"
  exit 0
}

# 8b. Hanya Klik Tombol Panah Kirim (Submit Arrow)
if ($ClickSubmitArrow) {
  $btnX = [int]($screenWidth * 0.972)
  $btnY = [int]($screenHeight * 0.896)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $btnY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  $ws.SendKeys('{ENTER}')

  Write-Host "SUCCESS: Clicked submit arrow at ($btnX, $btnY)"
  exit 0
}

# 9. Klik Tombol Approve 1 Kali Bersih
if ($ClickApprove) {
  $approveX = [int]($screenWidth * 0.880)
  $targetsY = @(
    [int]($screenHeight * 0.648), # 'Always approve' center
    [int]($screenHeight * 0.595), # 'Approve' center
    [int]($screenHeight * 0.622)  # Titik tengah
  )

  foreach ($tY in $targetsY) {
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($approveX, $tY)
    Start-Sleep -Milliseconds 120
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 60
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 100
  }

  Write-Host "SUCCESS: Clicked Approve zone at ($approveX)"
  exit 0
}

# 10. Cek Kredit Google One
if ($ExtractGoogleOneCredit) {
  $null = $ws.AppActivate('Credit History')
  $null = $ws.AppActivate('Histori Kredit')
  $null = $ws.AppActivate('Google One')
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 500

  $midX = [int]($screenWidth * 0.500)
  $midY = [int]($screenHeight * 0.400)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($midX, $midY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('^c')
  Start-Sleep -Milliseconds 250

  $clip = ""
  try { $clip = [System.Windows.Forms.Clipboard]::GetText() } catch {}
  Write-Host "CLIP_TEXT:$clip"
  exit 0
}
