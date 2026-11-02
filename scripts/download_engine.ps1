<#
.SYNOPSIS
  CeritaObim Studio - Native Download Engine per Profil Chrome
  Mengeksekusi pembukaan project terakhir dan unduh otomatis aset sesuai urutan rekaman modular user:
  1. open_project_1
  2. display_setting
  3. right_panel
  4. close_left_panel
  5..8. download_aset_1 s/d download_aset_$AssetCount (1 - 4 aset)
#>
param(
  [string]$ProfileDir = "Profile 6",
  [int]$AssetCount = 4,
  [switch]$SkipOpenProject
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinDownloadPlayer {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

try { [WinDownloadPlayer]::SetProcessDPIAware() | Out-Null } catch {}

$screenWidth = [WinDownloadPlayer]::GetSystemMetrics(0)
$screenHeight = [WinDownloadPlayer]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

$jsonPath = Join-Path $PSScriptRoot "..\storage\macro\recorded_download_flow.json"
if (-not (Test-Path $jsonPath)) {
    Write-Host "[ERROR] File rekaman tidak ditemukan di: $jsonPath" -ForegroundColor Red
    exit 1
}

$raw = Get-Content $jsonPath -Raw -Encoding UTF8
$allSteps = $raw | ConvertFrom-Json

$targetAssetCount = [Math]::Max(1, [Math]::Min(4, $AssetCount))

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "   [DOWNLOAD ENGINE] $ProfileDir - Mengunduh $targetAssetCount Aset Video" -ForegroundColor Cyan
Write-Host "   Urutan Skenario: Open Project > Display Setting > Right Panel > Close Left > Download 1..$targetAssetCount" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan

# 1. Buka Chrome langsung ke beranda Google Flow untuk profil ini
$chromeCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$chromeExe = "chrome.exe"
foreach ($c in $chromeCandidates) {
    if (Test-Path $c) { $chromeExe = $c; break }
}

$ws = New-Object -ComObject WScript.Shell

function Activate-ChromeWindow {
    $null = $ws.AppActivate('Google Flow')
    $null = $ws.AppActivate('Flow')
    $null = $ws.AppActivate('Chrome')
}

function Execute-ClickList($steps, $stageLabel) {
    if (-not $steps -or $steps.Count -eq 0) { return }
    Write-Host "   [$stageLabel] Menjalankan $($steps.Count) langkah klik..." -ForegroundColor Cyan
    foreach ($s in $steps) {
        $targetX = [int]($s.X)
        $targetY = [int]($s.Y)

        $waitMs = [Math]::Max(1000, [Math]::Min(3000, [int]($s.DelayMs)))
        Start-Sleep -Milliseconds $waitMs

        Activate-ChromeWindow

        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($targetX, $targetY)
        Start-Sleep -Milliseconds 120

        if ($s.Type -eq "RightClick") {
            # Right Click: Down (0x08) & Up (0x10)
            [WinDownloadPlayer]::mouse_event(0x08, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 80
            [WinDownloadPlayer]::mouse_event(0x10, 0, 0, 0, 0)
            Write-Host ("      * [KLIK KANAN] di ($targetX, $targetY)") -ForegroundColor Yellow
        } else {
            # Left Click: Down (0x02) & Up (0x04)
            [WinDownloadPlayer]::mouse_event(0x02, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 80
            [WinDownloadPlayer]::mouse_event(0x04, 0, 0, 0, 0)
            Write-Host ("      * [KLIK KIRI]  di ($targetX, $targetY)") -ForegroundColor Gray
        }
    }
}

if (-not $SkipOpenProject) {
    Write-Host "[FLOW] Membuka Google Flow untuk $ProfileDir..." -ForegroundColor Yellow
    Start-Process $chromeExe -ArgumentList "--profile-directory=`"$ProfileDir`"", "https://flow.google.com"

    # Tunggu 11 detik agar beranda Google Flow termuat
    Write-Host "[WAIT] Menunggu 11 detik agar beranda Flow dan kartu project terbaru termuat..." -ForegroundColor Gray
    for ($w = 11; $w -gt 0; $w--) {
        Write-Host -NoNewline "`r   Sisa waktu tunggu beranda: $w detik... "
        Start-Sleep -Seconds 1
    }
    Write-Host ""

    Activate-ChromeWindow
    Start-Sleep -Milliseconds 500

    # Eksekusi open_project_1
    $openSteps = $allSteps | Where-Object { $_.Action -eq "open_project_1" }
    if ($openSteps) {
        $first = $openSteps | Select-Object -First 1
        $targetX = [int]($first.X)
        $targetY = [int]($first.Y)

        Write-Host "[1/4 SETUP] Mengklik kartu project terbaru di ($targetX, $targetY)..." -ForegroundColor Green
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($targetX, $targetY)
        Start-Sleep -Milliseconds 150
        [WinDownloadPlayer]::mouse_event(0x02, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 80
        [WinDownloadPlayer]::mouse_event(0x04, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 120
        # Dobel klik cadangan
        [WinDownloadPlayer]::mouse_event(0x02, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 80
        [WinDownloadPlayer]::mouse_event(0x04, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 200
        $ws.SendKeys('{ENTER}')

        Write-Host "[WAIT] Menunggu 8 detik agar kanvas editor project dan video selesai dimuat..." -ForegroundColor Yellow
        for ($w = 8; $w -gt 0; $w--) {
            Write-Host -NoNewline "`r   Membuka kanvas project: $w detik... "
            Start-Sleep -Seconds 1
        }
        Write-Host ""
    }
} else {
    Write-Host "[FLOW] Mode langsung di dalam kanvas project..." -ForegroundColor Cyan
    Activate-ChromeWindow
    Start-Sleep -Milliseconds 500
}

# 2. Eksekusi display_setting
$displaySteps = $allSteps | Where-Object { $_.Action -eq "display_setting" }
if ($displaySteps) {
    Execute-ClickList $displaySteps "2/4 SETUP: DISPLAY SETTING"
    Start-Sleep -Milliseconds 1000
}

# 3. Eksekusi right_panel (Collapse panel kanan)
$rightSteps = $allSteps | Where-Object { $_.Action -eq "right_panel" }
if ($rightSteps) {
    Execute-ClickList $rightSteps "3/4 SETUP: RIGHT PANEL"
    Start-Sleep -Milliseconds 1000
}

# 4. Eksekusi close_left_panel (Collapse panel kiri)
$leftSteps = $allSteps | Where-Object { $_.Action -eq "close_left_panel" }
if ($leftSteps) {
    Execute-ClickList $leftSteps "4/4 SETUP: CLOSE LEFT PANEL"
    Start-Sleep -Milliseconds 1200
}

Write-Host "`n[SETUP SELESAI] Kanvas dan panel telah siap. Memulai pengunduhan $targetAssetCount aset video..." -ForegroundColor Green

# 5. Eksekusi Unduh Aset Video (download_aset_1 s/d download_aset_$targetAssetCount)
for ($a = 1; $a -le $targetAssetCount; $a++) {
    $actionName = "download_aset_$a"
    $assetSteps = $allSteps | Where-Object { $_.Action -eq $actionName }

    if (-not $assetSteps -or $assetSteps.Count -eq 0) {
        Write-Host "   [PERINGATAN] Aksi '$actionName' tidak ditemukan dalam file rekaman. Melewati..." -ForegroundColor Yellow
        continue
    }

    Write-Host "`n   [UNDUH ASET $a/$targetAssetCount] Memproses '$actionName'..." -ForegroundColor Cyan
    Execute-ClickList $assetSteps "ASET $a"

    # Beri jeda 2.5 detik agar browser memicu unduhan file 720p
    Write-Host "      [DOWNLOAD] Video #$a berhasil dipicu! Menunggu respons browser..." -ForegroundColor Green
    Start-Sleep -Milliseconds 2500

    # Tekan ESC untuk menutup context menu yang mungkin masih terbuka
    Activate-ChromeWindow
    $ws.SendKeys('{ESC}')
    Start-Sleep -Milliseconds 800
}

Write-Host ""
Write-Host "[SELESAI] $targetAssetCount video pada $ProfileDir berhasil dipicu untuk diunduh!" -ForegroundColor Green
Write-Host "[INFO] Jendela $ProfileDir tetap dibiarkan aktif terbuka di taskbar Anda." -ForegroundColor Cyan
Start-Sleep -Seconds 2

exit 0
