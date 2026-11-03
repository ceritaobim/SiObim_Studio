param(
  [int]$X = 0,
  [int]$Y = 0,
  [switch]$ClickNewProject,
  [switch]$ClickPlusButton,
  [switch]$ClickUploadMedia,
  [string]$SelectFileDialogFile = "",
  [switch]$ClickIAgree,
  [switch]$ClickEmptySpace,
  [switch]$PasteOnly,
  [switch]$PasteAndTagObim,
  [switch]$PasteTagAndSubmit,
  [switch]$PasteAndSubmit,
  [switch]$ClickApprove,
  [switch]$ClickFlowAvatar,
  [switch]$ReadFlowCredit,
  [switch]$ExtractGoogleOneCredit,
  [switch]$OpenLatestProject,
  [switch]$CloseRightChatPanel,
  [switch]$EnsureVideosGridM,
  [switch]$SelectVideosPanel,
  [switch]$OpenFirstVideoInPlayer,
  [string]$Sidebar = "collapsed",
  [switch]$EnsurePanelCollapsed,
  [switch]$DownloadCardRightClick,
  [switch]$DownloadCurrentPlayerVideo,
  [switch]$NextPlayerVideo,
  [switch]$ClickExpandPrompt,
  [switch]$DownloadFlowCard,
  [int]$CardIndex = 1
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

# Mengaktifkan DPI Awareness agar kursor mouse menggunakan koordinat fisik monitor sebenarnya (1920x1080)
try {
  [WinMouse.U32]::SetProcessDPIAware()
} catch {}

$screenWidth = [WinMouse.U32]::GetSystemMetrics(0)
$screenHeight = [WinMouse.U32]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

# Cek apakah ada sinyal Emergency Stop (Shift+X / X / Esc)
$flagFile = Join-Path $PSScriptRoot "..\storage\macro\STOP_MACRO.flag"
if (Test-Path $flagFile) {
  Write-Host "ABORT: Emergency stop flag detected."
  exit 99
}

$ws = New-Object -ComObject WScript.Shell
$act = $ws.AppActivate('Google Flow')
if (-not $act) {
  $null = $ws.AppActivate('Chrome')
}
Start-Sleep -Milliseconds 400

if ($ClickNewProject) {
  $X = [int]($screenWidth * 0.50)
  $Y = [int]($screenHeight * 0.76)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 250

  # Click 1: Down and Up
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 120

  # Click 2: Down and Up (Double Click)
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)

  # Also trigger Enter
  Start-Sleep -Milliseconds 200
  $ws.SendKeys('{ENTER}')
  
  Write-Host "SUCCESS: Clicked '+ New project' at ($X, $Y) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($ClickPlusButton) {
  # Tombol bulat '+' di bagian bawah-kiri kolom input chat:
  # Pada resolusi 1920x1080: X = 1520 (79.2%), Y = 965 (89.4%)
  $X = [int]($screenWidth * 0.792)
  $Y = [int]($screenHeight * 0.894)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)

  Write-Host "SUCCESS: Clicked '+' button at ($X, $Y) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($ClickUploadMedia) {
  # Tombol 'Upload media' di bagian bawah-kiri flyout aset:
  # Pada resolusi 1920x1080: X = 1040 (54.2%), Y = 830 (76.8%)
  $X = [int]($screenWidth * 0.542)
  $Y = [int]($screenHeight * 0.768)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)

  Write-Host "SUCCESS: Clicked 'Upload media' button at ($X, $Y) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($SelectFileDialogFile -ne "") {
  # Tunggu hingga jendela file picker Windows 'Open' atau 'Buka' aktif
  $hWnd = [IntPtr]::Zero
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 300
    $hWnd = [WinMouse.U32]::FindWindow("#32770", "Open")
    if ($hWnd -eq [IntPtr]::Zero) {
      $hWnd = [WinMouse.U32]::FindWindow("#32770", "Buka")
    }
    if ($hWnd -ne [IntPtr]::Zero) { break }
    if ($ws.AppActivate('Open') -or $ws.AppActivate('Buka')) { break }
  }

  Start-Sleep -Milliseconds 500

  # Aktifkan jendela dialog ke depan
  if ($hWnd -ne [IntPtr]::Zero) {
    [WinMouse.U32]::SetForegroundWindow($hWnd)
  } else {
    $null = $ws.AppActivate('Open')
    $null = $ws.AppActivate('Buka')
  }
  Start-Sleep -Milliseconds 400

  # Ambil koordinat jendela dialog untuk memastikan klik tepat di bilah alamat (Address Bar)
  $rect = New-Object WinMouse.U32+RECT
  $hasRect = $false
  if ($hWnd -ne [IntPtr]::Zero) {
    $hasRect = [WinMouse.U32]::GetWindowRect($hWnd, [ref]$rect)
  }

  # 1) Klik langsung pada area Address Bar jika koordinat window diketahui
  if ($hasRect -and ($rect.Right -gt $rect.Left) -and ($rect.Bottom -gt $rect.Top)) {
    $addrX = $rect.Left + 250
    $addrY = $rect.Top + 68
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($addrX, $addrY)
    Start-Sleep -Milliseconds 150
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 80
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 200
  }

  # 2) Kirim shortcut universal Windows Alt+D untuk memastikan address bar aktif & teks terpilih semua
  $ws.SendKeys('%d')
  Start-Sleep -Milliseconds 250
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 150

  # Pisahkan folder path dan nama file
  $folderPath = [System.IO.Path]::GetDirectoryName($SelectFileDialogFile)
  if (-not $folderPath.EndsWith('\')) {
    $folderPath += '\'
  }
  $fileName = [System.IO.Path]::GetFileName($SelectFileDialogFile)

  # Simpan folder path ke clipboard (misal C:\...\00.FolderOwner\assets\)
  [System.Windows.Forms.Clipboard]::SetText($folderPath)
  Start-Sleep -Milliseconds 200

  # Tempel folder path ke Address Bar lalu tekan Enter untuk berpindah folder
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 350
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 900

  # Perbarui koordinat jendela dialog
  if ($hWnd -ne [IntPtr]::Zero) {
    $null = [WinMouse.U32]::GetWindowRect($hWnd, [ref]$rect)
  }

  # Klik salah satu file di area daftar file (tengah jendela dialog) untuk memfokuskan daftar file
  if ($hasRect -and ($rect.Right -gt $rect.Left)) {
    $fileListX = $rect.Left + [int](($rect.Right - $rect.Left) * 0.50)
    $fileListY = $rect.Top + [int](($rect.Bottom - $rect.Top) * 0.40)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($fileListX, $fileListY)
    Start-Sleep -Milliseconds 200
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 80
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 350
  }

  # Ketikkan nama file pada keyboard (obim.jpg) untuk memilih file di folder tersebut
  $ws.SendKeys($fileName)
  Start-Sleep -Milliseconds 450

  # Tekan Enter untuk mengonfirmasi dan membuka file yang dipilih
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 700

  # Cadangan: jika dialog masih terbuka, kirim Alt+N untuk memastikan kolom File name terisi dan Enter
  $checkHwnd = [WinMouse.U32]::FindWindow("#32770", "Open")
  if ($checkHwnd -eq [IntPtr]::Zero) {
    $checkHwnd = [WinMouse.U32]::FindWindow("#32770", "Buka")
  }
  if ($checkHwnd -ne [IntPtr]::Zero) {
    $ws.SendKeys('%n')
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.Clipboard]::SetText($fileName)
    Start-Sleep -Milliseconds 100
    $ws.SendKeys('^a')
    Start-Sleep -Milliseconds 100
    $ws.SendKeys('^v')
    Start-Sleep -Milliseconds 250
    $ws.SendKeys('{ENTER}')
    Start-Sleep -Milliseconds 500
  }

  Write-Host "SUCCESS: Navigated to folder '$folderPath' and selected file '$fileName'"
  exit 0
}

if ($ClickIAgree) {
  # Tombol 'I agree' pada modal "Rights to use this image":
  # Pada resolusi 1920x1080: X = 1236 (64.4%), Y = 659 (61.0%)
  $agreeX = [int]($screenWidth * 0.644)
  $agreeY = [int]($screenHeight * 0.610)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($agreeX, $agreeY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  Write-Host "SUCCESS: Clicked 'I agree' button at ($agreeX, $agreeY) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($ClickEmptySpace) {
  # Klik kanvas kosong di sebelah kiri (area bebas dari panel flyout dan sidebar)
  $X = [int]($screenWidth * 0.30)
  $Y = [int]($screenHeight * 0.40)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  Write-Host "SUCCESS: Clicked empty screen space at ($X, $Y) to dismiss panel"
  exit 0
}

if ($PasteOnly) {
  # Koordinat kolom input teks chat 'Apa yang ingin Anda buat?':
  $promptX = [int]($screenWidth * 0.860)
  $promptY = [int]($screenHeight * 0.850)

  # Klik langsung ke kolom input chat untuk memfokuskan kursor ketik
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  # Bersihkan teks lama jika ada
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 150

  # Tempelkan teks prompt dari clipboard (Ctrl+V)
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 300

  # HANYA PASTE! DILARANG MENGIRIM ENTER ATAU KLIK PANAH!
  Write-Host "SUCCESS: Focused chat box and pasted prompt WITHOUT submitting on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($PasteAndTagObim) {
  # Koordinat kolom input teks chat:
  $promptX = [int]($screenWidth * 0.860)
  $promptY = [int]($screenHeight * 0.800)

  # Klik langsung ke kolom input chat untuk memfokuskan kursor ketik
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 300
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 350

  # Bersihkan teks lama jika ada
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 200

  # Tempelkan teks prompt dari clipboard (Ctrl+V)
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 700

  # Pastikan kursor berada di paling akhir teks prompt
  $ws.SendKeys('^{END}')
  Start-Sleep -Milliseconds 300

  # Tambahkan spasi di akhir
  $ws.SendKeys(' ')
  Start-Sleep -Milliseconds 250

  # Ketikkan '@' untuk memicu popup mention aset di Google Flow
  $ws.SendKeys('@')
  Start-Sleep -Milliseconds 800

  # Ketikkan nama file 'obim.jpg'
  $ws.SendKeys('obim.jpg')
  Start-Sleep -Milliseconds 600

  # Tekan Enter untuk mengonfirmasi pilihan chip mention @obim.jpg
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 500

  # BERHENTI DI SINI — TIDAK MENGIRIM ENTER LAGI / TIDAK KLIK PANAH!
  Write-Host "SUCCESS: Pasted prompt and tagged @obim.jpg chip WITHOUT submitting on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($PasteTagAndSubmit) {
  # Koordinat kolom input teks chat:
  $promptX = [int]($screenWidth * 0.860)
  $promptY = [int]($screenHeight * 0.800)

  # Klik langsung ke kolom input chat untuk memfokuskan kursor ketik
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 300
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 350

  # Bersihkan teks lama jika ada
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 200

  # Tempelkan teks prompt dari clipboard (Ctrl+V)
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 700

  # Pastikan kursor berada di paling akhir teks prompt
  $ws.SendKeys('^{END}')
  Start-Sleep -Milliseconds 300

  # Tambahkan spasi di akhir
  $ws.SendKeys(' ')
  Start-Sleep -Milliseconds 250

  # Ketikkan '@' untuk memicu popup mention aset di Google Flow
  $ws.SendKeys('@')
  Start-Sleep -Milliseconds 800

  # Ketikkan nama file 'obim.jpg'
  $ws.SendKeys('obim.jpg')
  Start-Sleep -Milliseconds 600

  # Tekan Enter untuk mengonfirmasi pilihan chip mention @obim.jpg
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 500

  # Klik tombol panah kirim (Submit Arrow ->) di pojok kanan bawah kolom chat
  # Posisi fisik terukur: X = 94.4%, Y = 88.8%
  $btnX = [int]($screenWidth * 0.944)
  $btnY = [int]($screenHeight * 0.888)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $btnY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  # Cadangan tombol submit via keyboard Enter
  $ws.SendKeys('{ENTER}')

  Write-Host "SUCCESS: Pasted prompt, tagged @obim.jpg chip, and submitted prompt at ($btnX, $btnY) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($PasteAndSubmit) {
  # Koordinat kolom chat 'What do you want to create?' di panel kanan Google Flow:
  $promptX = [int]($screenWidth * 0.880)
  $promptY = [int]($screenHeight * 0.845)

  # Klik langsung ke kolom input chat untuk memfokuskan kursor ketik
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($promptX, $promptY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  # Bersihkan teks lama jika ada
  $ws.SendKeys('^a')
  Start-Sleep -Milliseconds 150

  # Tempelkan teks prompt dari clipboard (Ctrl+V)
  $ws.SendKeys('^v')
  Start-Sleep -Milliseconds 500

  # Kirim Enter untuk generate
  $ws.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 300

  # Klik tombol panah kirim (Submit Arrow ->) di ujung kanan kolom chat
  $btnX = [int]($screenWidth * 0.970)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($btnX, $promptY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)

  Write-Host "SUCCESS: Focused chat box at ($promptX, $promptY), pasted prompt & clicked submit arrow at ($btnX, $promptY) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($ClickApprove) {
  # Koordinat tombol Approve & Always approve di panel kanan Google Flow.
  # Pada resolusi fisik 1920x1080:
  # Tombol X berpusat di X = 1690 (88% lebar monitor).
  # Tombol 'Always approve' berpusat di Y = 700 (64.8% tinggi monitor).
  # Tombol 'Approve' berpusat di Y = 642 (59.5% tinggi monitor).
  # Tombol 'Reject' berada di bawah pada Y = 758 (70.2% tinggi monitor).
  $approveX = [int]($screenWidth * 0.880)

  # Rentang sapuan titik klik aman di zona Always approve & Approve:
  $targetsY = @(
    [int]($screenHeight * 0.648), # 'Always approve' center (~700px pada 1080p)
    [int]($screenHeight * 0.595), # 'Approve' center (~642px pada 1080p)
    [int]($screenHeight * 0.622), # Transisi tengah
    [int]($screenHeight * 0.575), # Variasi jika teks prompt 1 baris lebih pendek (~621px)
    [int]($screenHeight * 0.665)  # Variasi jika teks prompt 1 baris lebih panjang (~718px, aman di atas Reject)
  )

  foreach ($tY in $targetsY) {
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($approveX, $tY)
    Start-Sleep -Milliseconds 120
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 60
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 120
  }

  Write-Host "SUCCESS: Clicked Approve/Always Approve zone at ($approveX) on ${screenWidth}x${screenHeight}"
  exit 0
}

if ($ClickFlowAvatar) {
  # Avatar profil Google Flow di navbar kanan atas (1920x1080: X = 1848 (96.2%), Y = 156 (14.5%))
  $avatarX = [int]($screenWidth * 0.962)
  $avatarY = [int]($screenHeight * 0.145)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($avatarX, $avatarY)
  Start-Sleep -Milliseconds 250
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)

  Write-Host "SUCCESS: Clicked Flow profile avatar at ($avatarX, $avatarY)"
  exit 0
}

if ($ReadFlowCredit) {
  # Koordinat teks kartu kredit di dalam popup Flow (1920x1080: X = 1640 (85.4%), Y = 280 (25.9%))
  $cardX = [int]($screenWidth * 0.854)
  $cardY = [int]($screenHeight * 0.260)

  # Bersihkan clipboard lama
  try { [System.Windows.Forms.Clipboard]::Clear() } catch {}

  # Arahkan kursor ke kartu kredit dan triple click untuk memilih teks baris
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($cardX, $cardY)
  Start-Sleep -Milliseconds 200

  # Click 1
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80

  # Click 2
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80

  # Click 3
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  # Salin dengan Ctrl+C
  $ws.SendKeys('^c')
  Start-Sleep -Milliseconds 250

  $clip = ""
  try {
    $clip = [System.Windows.Forms.Clipboard]::GetText()
  } catch {}

  # Jika belum terbaca, coba teknik drag select
  if ($clip -notmatch '\d+\s*kredit') {
    $startX = [int]($screenWidth * 0.780)
    $endX = [int]($screenWidth * 0.920)

    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($startX, $cardY)
    Start-Sleep -Milliseconds 100
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($endX, $cardY)
    Start-Sleep -Milliseconds 100
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 150
    $ws.SendKeys('^c')
    Start-Sleep -Milliseconds 200
    try {
      $clip = [System.Windows.Forms.Clipboard]::GetText()
    } catch {}
  }

  if ($clip -match '(\d+)\s*kredit') {
    Write-Host "FOUND_CREDIT:$($matches[1])"
  } else {
    Write-Host "CLIP_TEXT:$clip"
  }

  # Tutup popup dengan tombol Escape
  Start-Sleep -Milliseconds 150
  $ws.SendKeys('{ESC}')

  exit 0
}

if ($ExtractGoogleOneCredit) {
  # Aktifkan jendela browser (Credit History / Histori Kredit / Google One / Google Flow / Chrome)
  $null = $ws.AppActivate('Credit History')
  $null = $ws.AppActivate('Histori Kredit')
  $null = $ws.AppActivate('Google One')
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 500

  $foundCredit = $null
  $lastClip = ""

  # Coba hingga 3 kali membaca halaman (mengantisipasi jeda render komponen DOM kartu Google One)
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try { [System.Windows.Forms.Clipboard]::Clear() } catch {}

    # Klik di area tengah halaman agar fokus keyboard aktif pada dokumen web
    $midX = [int]($screenWidth * 0.500)
    $midY = [int]($screenHeight * 0.400)
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($midX, $midY)
    Start-Sleep -Milliseconds 150
    [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 60
    [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
    Start-Sleep -Milliseconds 250

    # Tekan Ctrl+A untuk menyeleksi seluruh teks halaman
    $ws.SendKeys('^a')
    Start-Sleep -Milliseconds 250

    # Tekan Ctrl+C untuk menyalin teks
    $ws.SendKeys('^c')
    Start-Sleep -Milliseconds 300

    $clip = ""
    try {
      $clip = [System.Windows.Forms.Clipboard]::GetText()
    } catch {}

    $lastClip = $clip

    # Pola 1: Kartu utama Google One - Angka Flow Credit diikuti status perpanjangan (Refreshes/Direset)
    # Contoh: "Google Flow credits\n50\nRefreshes tomorrow" atau "Kredit Google Flow\n50\nDireset besok"
    if ($clip -match '(?i)(?:Google Flow credits|Kredit Google Flow)[\r\n\s]+(\d{1,2})[\r\n\s]+(?:Refreshes|Direset)') {
      $val = [int]$matches[1]
      if ($val -ge 0 -and $val -le 50) { $foundCredit = $val; break }
    }

    # Pola 2: Angka tepat sebelum status perpanjangan (Refreshes/Direset)
    if ($clip -match '(?i)\b(\d{1,2})\b[\r\n\s]+(?:Refreshes|Direset)') {
      $val = [int]$matches[1]
      if ($val -ge 0 -and $val -le 50) { $foundCredit = $val; break }
    }

    # Pola 3: Judul kredit langsung diikuti angka 0-50
    if ($clip -match '(?i)(?:Google Flow credits|Kredit Google Flow)[\r\n\s]+(\d{1,2})\b') {
      $val = [int]$matches[1]
      if ($val -ge 0 -and $val -le 50) { $foundCredit = $val; break }
    }

    # Pola 4: Format teks inline (misal "Sisa 50 kredit Flow" atau "50 kredit")
    if ($clip -match '(?i)\b([0-5]?\d)\s*kredit\b') {
      $val = [int]$matches[1]
      if ($val -ge 0 -and $val -le 50) { $foundCredit = $val; break }
    }

    # Jika belum ditemukan dan masih ada percobaan berikutnya, tunggu 1.5 detik
    if ($attempt -lt 3) {
      Start-Sleep -Milliseconds 1500
    }
  }

  if ($foundCredit -ne $null) {
    Write-Host "FOUND_CREDIT:$foundCredit"
  } else {
    Write-Host "CLIP_NOT_FOUND"
    if ($lastClip.Length -gt 0) {
      $shortClip = $lastClip.Substring(0, [Math]::Min(200, $lastClip.Length)).Replace("`r", " ").Replace("`n", " ")
      Write-Host "CLIP_SNIPPET:$shortClip"
    }
  }

  # Deselect seleksi teks dengan Escape lalu tutup tab dengan Ctrl+W
  Start-Sleep -Milliseconds 150
  $ws.SendKeys('{ESC}')
  Start-Sleep -Milliseconds 150
  $ws.SendKeys('^w')
  Start-Sleep -Milliseconds 300

  exit 0
}

if ($OpenLatestProject) {
  # Buka project terbaru di beranda flow.google.com (kartu di kiri bawah)
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Flow')
  $null = $ws.AppActivate('Chrome')
  # Aktifkan jendela tanpa mengirim Alt+Space (menghilangkan context menu pojok kiri atas)
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 400

  # Koordinat kartu project terbaru hasil rekaman user: RatioX: 0.149, RatioY: 0.8657 (286, 935 pada 1920x1080)
  $projX = [int]($screenWidth * 0.149)
  $projY = [int]($screenHeight * 0.8657)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($projX, $projY)
  Start-Sleep -Milliseconds 200

  # Klik 1
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 120

  # Double-click
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 200

  # Kirim Enter sebagai pemicu pasti
  $ws.SendKeys('{ENTER}')

  Write-Host "SUCCESS: Clicked latest project at ($projX, $projY)"
  exit 0
}

if ($CloseRightChatPanel) {
  # Tutup panel chat prompt di sebelah kanan (tombol 'X' di kanan atas panel)
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  # Koordinat tombol 'X': X = 1873 (97.55%), Y = 232 (21.48%) pada 1920x1080
  $closeX = [int]($screenWidth * 0.9755)
  $closeY = [int]($screenHeight * 0.2148)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($closeX, $closeY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 600

  Write-Host "SUCCESS: Closed right chat prompt panel at ($closeX, $closeY)"
  exit 0
}

if ($EnsureVideosGridM) {
  # Aktifkan jendela Google Flow
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 400

  # 1. Klik ikon Gerigi (Settings) di pojok kanan atas (1920x1080: X = 1690, Y = 149)
  $gearX = [int]($screenWidth * 0.8802)
  $gearY = [int]($screenHeight * 0.1380)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($gearX, $gearY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 500

  # 2. Klik tombol 'Grid' di popup View mode (1920x1080: X = 1485, Y = 240)
  $gridX = [int]($screenWidth * 0.7734)
  $gridY = [int]($screenHeight * 0.2222)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($gridX, $gridY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  # 3. Klik tombol ukuran 'M' di popup Grid size (1920x1080: X = 1562, Y = 330)
  $mSizeX = [int]($screenWidth * 0.8135)
  $mSizeY = [int]($screenHeight * 0.3055)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($mSizeX, $mSizeY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  # 4. Klik di ruang kosong (area kanvas gelap) untuk menutup menu popup pengaturan
  $blankX = [int]($screenWidth * 0.5208)
  $blankY = [int]($screenHeight * 0.4630)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($blankX, $blankY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 300

  Write-Host "SUCCESS: Configured view to Grid M and closed settings"
  exit 0
}

if ($SelectVideosPanel) {
  # Klik menu 'Videos' di panel kiri (1920x1080: X = 80, Y = 338)
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  $vidX = [int]($screenWidth * 0.0416)
  $vidY = [int]($screenHeight * 0.3130)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($vidX, $vidY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 600

  Write-Host "SUCCESS: Clicked Videos in left panel"
  exit 0
}

if ($EnsurePanelCollapsed) {
  # 1. Pastikan jendela Google Flow aktif
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  # Periksa Stop Flag
  if (Test-Path $flagFile) {
    Write-Host "ABORT: Emergency stop flag detected."
    exit 99
  }

  # Titik Smart Collapse di teks 'Collapse' (pada 1920x1080: X = 105, Y = 933)
  # - Jika EXPANDED: Tombol Collapse membentang X=39 s.d. X=154 -> Titik X=105 tepat di tombol -> Panel COLLAPSE!
  # - Jika COLLAPSED: Sidebar sempit hanya sampai X=65 -> Titik X=105 berada di luar sidebar (ruang kosong) -> AMAN!
  $smartCollapseX = [int]($screenWidth * 0.0547)
  $smartCollapseY = [int]($screenHeight * 0.864)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($smartCollapseX, $smartCollapseY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 800

  Write-Host "SUCCESS: Smart collapse executed at ($smartCollapseX, $smartCollapseY)"
  exit 0
}

if ($DownloadCardRightClick) {
  # Aktifkan jendela Google Flow
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  # Periksa Stop Flag
  if (Test-Path $flagFile) {
    Write-Host "ABORT: Emergency stop flag detected."
    exit 99
  }

  # Hitung koordinat Kartu ke-$CardIndex pada kanvas (Card 1: X=180, Y=470; step tiap kartu +230px pada 1920x1080)
  $baseCard1X = [int]($screenWidth * 0.09375) # 180 pada 1920
  $cardY      = [int]($screenHeight * 0.4352)  # 470 pada 1080
  $stepX      = [int]($screenWidth * 0.1198)  # 230 pada 1920

  $idx = [math]::Max(1, $CardIndex) - 1
  $cardX = $baseCard1X + ($idx * $stepX)

  # 1. Right-Click pada kartu video di kanvas (MOUSEEVENTF_RIGHTDOWN = 0x08, MOUSEEVENTF_RIGHTUP = 0x10)
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($cardX, $cardY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x08, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x10, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 800

  # 2. Left-Click pada opsi 'Download' di context menu (Offset: +155 X, +100 Y)
  $dlX = $cardX + [int]($screenWidth * 0.0807) # +155 pada 1920
  $dlY = $cardY + [int]($screenHeight * 0.0926) # +100 pada 1080
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($dlX, $dlY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 600

  # 3. Left-Click pada opsi '720p' di submenu resolusi (Offset: +380 X, +195 Y)
  $p720X = $cardX + [int]($screenWidth * 0.1979) # +380 pada 1920
  $p720Y = $cardY + [int]($screenHeight * 0.1805) # +195 pada 1080
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($p720X, $p720Y)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 1200

  Write-Host "SUCCESS: Right-clicked Card $CardIndex at ($cardX, $cardY), selected Download at ($dlX, $dlY), and clicked 720p at ($p720X, $p720Y)"
  exit 0
}

if ($OpenFirstVideoInPlayer) {
  # 1. Pastikan jendela Google Flow aktif
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 400

  # 2. Ide Cerdas User: Klik titik 'Smart Collapse' di teks 'Collapse' (pada 1920x1080: X = 105, Y = 933)
  $smartCollapseX = [int]($screenWidth * 0.0547)
  $smartCollapseY = [int]($screenHeight * 0.864)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($smartCollapseX, $smartCollapseY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 500

  # 3. Klik Card 1 (karena panel sudah pasti COLLAPSED, posisi Card 1 selalu stabil di X = 201, Y = 360)
  $firstCardX = [int]($screenWidth * 0.1047)
  $firstCardY = [int]($screenHeight * 0.3343)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($firstCardX, $firstCardY)
  Start-Sleep -Milliseconds 200

  # Klik pertama
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 100

  # Klik kedua (dobel klik untuk memastikan masuk ke media player)
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 60
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 2500

  Write-Host "SUCCESS: Smart collapse executed at ($smartCollapseX, $smartCollapseY) and opened first video at ($firstCardX, $firstCardY)"
  exit 0
}

if ($DownloadCurrentPlayerVideo) {
  # Pada tampilan Media Player: klik tombol download di kanan atas, lalu pilih 720p
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  # 1. Tombol Download icon (panah bawah ke baki) di kanan atas:
  # Pada 1920x1080: X = 1457 (75.88%), Y = 154 (14.26%)
  $dlBtnX = [int]($screenWidth * 0.7588)
  $dlBtnY = [int]($screenHeight * 0.1426)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($dlBtnX, $dlBtnY)
  Start-Sleep -Milliseconds 150
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  # Tunggu 700ms agar animasi dropdown menu terbuka sempurna
  Start-Sleep -Milliseconds 700

  # 2. Opsi '720p (Ukuran asli)' di dropdown:
  # Rentang vertikal kartu 720p: Y = 256 s.d. 315 (Center: 288, 26.67%)
  # Catatan: 270p GIF berakhir di Y = 252. Klik di Y = 288 tepat di tengah kartu 720p.
  # Rentang horizontal: X = 1448 s.d. 1721 (Center: 1585, 82.55%)
  $opt720X = [int]($screenWidth * 0.8255)
  $opt720Y = [int]($screenHeight * 0.2667)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($opt720X, $opt720Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 600

  Write-Host "SUCCESS: Clicked Download 720p in media player at ($opt720X, $opt720Y)"
  exit 0
}

if ($NextPlayerVideo) {
  # Klik area kosong kanvas lalu tekan panah kanan (Arrow Right) untuk berpindah ke video berikutnya
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 250

  # 1. Klik area kosong di sebelah kiri player: X ~ 500 (26.04%), Y ~ 300 (27.78%)
  $emptyX = [int]($screenWidth * 0.2604)
  $emptyY = [int]($screenHeight * 0.2778)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($emptyX, $emptyY)
  Start-Sleep -Milliseconds 100
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 50
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 250

  # 2. Tekan tombol Arrow Kanan
  $ws.SendKeys('{RIGHT}')
  Start-Sleep -Milliseconds 2500

  Write-Host "SUCCESS: Navigated to next video via Right Arrow"
  exit 0
}

if ($ClickExpandPrompt) {
  # Tombol luaskan (expand) di kanan-atas kolom input 'Apa yang ingin Anda buat?':
  # Terletak tepat di pojok kanan atas kolom input teks:
  # Pada 1920x1080: X = 1298 (67.58%), Y = 887 (82.17%)
  $null = $ws.AppActivate('Google Flow')
  $null = $ws.AppActivate('Chrome')
  Start-Sleep -Milliseconds 300

  $expX = [int]($screenWidth * 0.6758)
  $expY = [int]($screenHeight * 0.8217)

  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($expX, $expY)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 80
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 800

  Write-Host "SUCCESS: Clicked expand button (luaskan) at ($expX, $expY)"
  exit 0
}

if ($X -ne 0 -or $Y -ne 0) {
  [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
  Start-Sleep -Milliseconds 200
  [WinMouse.U32]::mouse_event(0x02, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 100
  [WinMouse.U32]::mouse_event(0x04, 0, 0, 0, 0)
  Write-Host "SUCCESS: Clicked at ($X, $Y)"
  exit 0
}
