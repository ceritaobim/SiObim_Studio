<#
.SYNOPSIS
  CeritaObim Studio - Perekam Aksi Modular Google Flow (Per-Menu Recording)
.DESCRIPTION
  Merekam koordinat klik mouse secara terpisah untuk setiap aksi spesifik:
  1. Open Project 1
  2. Display Setting
  3. Close Left Panel
  4. Download Aset 1
  5. Download Aset 2
  6. Download Aset 3
  7. Download Aset 4
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinHookModular {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

try { [WinHookModular]::SetProcessDPIAware() | Out-Null } catch {}

$screenWidth = [WinHookModular]::GetSystemMetrics(0)
$screenHeight = [WinHookModular]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

$VK_LBUTTON = 0x01
$VK_RBUTTON = 0x02
$VK_F = 0x46
$VK_ESC = 0x1B
$VK_RIGHT = 0x27

$macroDir = Join-Path $PSScriptRoot "..\storage\macro"
if (-not (Test-Path $macroDir)) { New-Item -ItemType Directory -Path $macroDir -Force | Out-Null }
$modularJsonPath = Join-Path $macroDir "modular_recorded_actions.json"
$mergedJsonPath  = Join-Path $macroDir "recorded_download_flow.json"

# Inisialisasi data rekaman
$actionData = [ordered]@{}
if (Test-Path $modularJsonPath) {
    try {
        $raw = Get-Content -Path $modularJsonPath -Raw -Encoding UTF8
        $loaded = $raw | ConvertFrom-Json
        foreach ($prop in $loaded.PSObject.Properties) {
            $actionData[$prop.Name] = $prop.Value
        }
    } catch {}
}

$menuItems = @(
    @{ Id = "open_project_1";  Name = "open project 1";  Desc = "Klik kartu project terbaru di kiri bawah beranda" },
    @{ Id = "display_setting"; Name = "display setting"; Desc = "Klik ikon Gerigi -> Grid -> M -> Klik kanvas" },
    @{ Id = "close_left_panel";Name = "close left panel";Desc = "Klik tombol Collapse di kiri bawah panel" },
    @{ Id = "right_panel";     Name = "right panel";     Desc = "Aksi pada panel kanan (misal tutup chat panel kanan)" },
    @{ Id = "download_aset_1"; Name = "download aset 1"; Desc = "Klik Kanan Card 1 -> Download -> 720p" },
    @{ Id = "download_aset_2"; Name = "download aset 2"; Desc = "Klik Kanan Card 2 -> Download -> 720p" },
    @{ Id = "download_aset_3"; Name = "download aset 3"; Desc = "Klik Kanan Card 3 -> Download -> 720p" },
    @{ Id = "download_aset_4"; Name = "download aset 4"; Desc = "Klik Kanan Card 4 -> Download -> 720p" }
)

# Urutan eksekusi otomatis sesuai alur yang diinginkan:
# 1 (open_project_1) > 2 (display_setting) > 4 (right_panel) > 3 (close_left_panel) > 5..8 (download_aset_1..4)
$executionOrder = @(
    "open_project_1",
    "display_setting",
    "right_panel",
    "close_left_panel",
    "download_aset_1",
    "download_aset_2",
    "download_aset_3",
    "download_aset_4"
)

function Save-Data {
    $actionData | ConvertTo-Json -Depth 6 | Set-Content -Path $modularJsonPath -Encoding UTF8
    
    # Gabungkan semua aksi yang ada ke format recorded_download_flow.json sesuai $executionOrder
    $combined = [System.Collections.Generic.List[PSCustomObject]]::new()
    $stepIdx = 1
    foreach ($key in $executionOrder) {
        if ($actionData.Contains($key) -and $actionData[$key]) {
            foreach ($c in $actionData[$key]) {
                $combined.Add([PSCustomObject]@{
                    Step    = $stepIdx
                    Action  = $key
                    Type    = $c.Type
                    X       = $c.X
                    Y       = $c.Y
                    RatioX  = $c.RatioX
                    RatioY  = $c.RatioY
                    DelayMs = $c.DelayMs
                })
                $stepIdx++
            }
        }
    }
    if ($combined.Count -gt 0) {
        $combined | ConvertTo-Json -Depth 6 | Set-Content -Path $mergedJsonPath -Encoding UTF8
    }
}

function Record-SingleAction($item) {
    Clear-Host
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ("  [REC] MEREKAM AKSI: [{0}]" -f $item.Name.ToUpper()) -ForegroundColor Yellow
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ("  Deskripsi : {0}" -f $item.Desc) -ForegroundColor Gray
    Write-Host "  Resolusi  : ${screenWidth} x ${screenHeight} (DPI Aware)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  INSTRUKSI:" -ForegroundColor White
    Write-Host "  1. Arahkan kursor / fokuskan jendela Google Flow Anda." -ForegroundColor Gray
    Write-Host "  2. Tekan tombol [ F ] di keyboard Anda untuk MULAI merekam aksi ini." -ForegroundColor Green
    Write-Host "  3. Lakukan klik yang diperlukan (Klik Kiri / Klik Kanan / Panah Kanan)." -ForegroundColor Yellow
    Write-Host "  4. Tekan tombol [ F ] lagi (atau [ ESC ]) jika aksi ini sudah SELESAI." -ForegroundColor Red
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [TUNGGU] Menunggu Anda menekan tombol [ F ] di keyboard untuk mulai merekam..." -ForegroundColor Yellow

    # Tunggu tombol F ditekan untuk mulai
    $recStarted = $false
    while (-not $recStarted) {
        Start-Sleep -Milliseconds 25
        $fState = [WinHookModular]::GetAsyncKeyState($VK_F)
        if (($fState -band 0x8000) -ne 0) {
            $recStarted = $true
            while (([WinHookModular]::GetAsyncKeyState($VK_F) -band 0x8000) -ne 0) {
                Start-Sleep -Milliseconds 20
            }
        }
    }

    try { [Console]::Beep(1200, 200) } catch {}
    Write-Host ""
    Write-Host "  [REC] REKAMAN AKTIF! Silakan lakukan klik mouse untuk aksi ini..." -ForegroundColor Green
    Write-Host "  (Tekan [ F ] atau [ ESC ] jika sudah selesai)" -ForegroundColor Gray
    Write-Host "-------------------------------------------------------------------------------" -ForegroundColor DarkGray

    $recordedClicks = [System.Collections.Generic.List[PSCustomObject]]::new()
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $lastActionTime = 0
    $localStep = 0

    $wasLeftDown = $false
    $wasRightDown = $false
    $wasArrowDown = $false
    $isRecording = $true

    while ($isRecording) {
        Start-Sleep -Milliseconds 20

        # Cek tombol Stop (F atau ESC)
        $fState = [WinHookModular]::GetAsyncKeyState($VK_F)
        $escState = [WinHookModular]::GetAsyncKeyState($VK_ESC)
        if ((($fState -band 0x8000) -ne 0) -or (($escState -band 0x8000) -ne 0)) {
            while ((([WinHookModular]::GetAsyncKeyState($VK_F) -band 0x8000) -ne 0) -or (([WinHookModular]::GetAsyncKeyState($VK_ESC) -band 0x8000) -ne 0)) {
                Start-Sleep -Milliseconds 20
            }
            $isRecording = $false
            break
        }

        # 1. Klik Kanan (Right Click)
        $rState = [WinHookModular]::GetAsyncKeyState($VK_RBUTTON)
        $isRightDown = (($rState -band 0x8000) -ne 0)
        if ($isRightDown -and -not $wasRightDown) {
            $currentTime = $stopwatch.ElapsedMilliseconds
            $delay = if ($localStep -eq 0) { 0 } else { $currentTime - $lastActionTime }
            $lastActionTime = $currentTime
            $localStep++

            $pos = [System.Windows.Forms.Cursor]::Position
            $ratioX = [Math]::Round(($pos.X / $screenWidth), 4)
            $ratioY = [Math]::Round(($pos.Y / $screenHeight), 4)

            try { [Console]::Beep(1100, 80) } catch {}
            Write-Host ("  [KLIK KANAN] #{0} pada X={1,4}, Y={2,4} ({3,6:P2}, {4,6:P2}) | Jeda: {5,4:F1}s" -f $localStep, $pos.X, $pos.Y, $ratioX, $ratioY, ($delay/1000.0)) -ForegroundColor Yellow

            $recordedClicks.Add([PSCustomObject]@{
                Step    = $localStep
                Type    = "RightClick"
                X       = $pos.X
                Y       = $pos.Y
                RatioX  = $ratioX
                RatioY  = $ratioY
                DelayMs = $delay
            })
        }
        $wasRightDown = $isRightDown

        # 2. Klik Kiri (Left Click)
        $lState = [WinHookModular]::GetAsyncKeyState($VK_LBUTTON)
        $isLeftDown = (($lState -band 0x8000) -ne 0)
        if ($isLeftDown -and -not $wasLeftDown) {
            $currentTime = $stopwatch.ElapsedMilliseconds
            $delay = if ($localStep -eq 0) { 0 } else { $currentTime - $lastActionTime }
            $lastActionTime = $currentTime
            $localStep++

            $pos = [System.Windows.Forms.Cursor]::Position
            $ratioX = [Math]::Round(($pos.X / $screenWidth), 4)
            $ratioY = [Math]::Round(($pos.Y / $screenHeight), 4)

            try { [Console]::Beep(850, 80) } catch {}
            Write-Host ("  [KLIK KIRI]  #{0} pada X={1,4}, Y={2,4} ({3,6:P2}, {4,6:P2}) | Jeda: {5,4:F1}s" -f $localStep, $pos.X, $pos.Y, $ratioX, $ratioY, ($delay/1000.0)) -ForegroundColor Cyan

            $recordedClicks.Add([PSCustomObject]@{
                Step    = $localStep
                Type    = "LeftClick"
                X       = $pos.X
                Y       = $pos.Y
                RatioX  = $ratioX
                RatioY  = $ratioY
                DelayMs = $delay
            })
        }
        $wasLeftDown = $isLeftDown

        # 3. Tombol Panah Kanan (Right Arrow)
        $arrState = [WinHookModular]::GetAsyncKeyState($VK_RIGHT)
        $isArrowDown = (($arrState -band 0x8000) -ne 0)
        if ($isArrowDown -and -not $wasArrowDown) {
            $currentTime = $stopwatch.ElapsedMilliseconds
            $delay = if ($localStep -eq 0) { 0 } else { $currentTime - $lastActionTime }
            $lastActionTime = $currentTime
            $localStep++

            try { [Console]::Beep(1300, 80) } catch {}
            Write-Host ("  [TOMBOL]     #{0} Panah Kanan (Right Arrow) | Jeda: {1,4:F1}s" -f $localStep, ($delay/1000.0)) -ForegroundColor Magenta

            $recordedClicks.Add([PSCustomObject]@{
                Step    = $localStep
                Type    = "RightArrow"
                X       = 0
                Y       = 0
                RatioX  = 0
                RatioY  = 0
                DelayMs = $delay
            })
        }
        $wasArrowDown = $isArrowDown
    }

    $stopwatch.Stop()
    try {
        [Console]::Beep(1400, 150)
        Start-Sleep -Milliseconds 60
        [Console]::Beep(1800, 200)
    } catch {}

    Write-Host ""
    if ($recordedClicks.Count -eq 0) {
        Write-Host "  [!] Tidak ada klik yang terekam. Rekaman aksi ini tidak disimpan." -ForegroundColor Yellow
    } else {
        $actionData[$item.Id] = $recordedClicks
        Save-Data
        Write-Host ("  [OK] BERHASIL: [{0}] terekam {1} klik!" -f $item.Name.ToUpper(), $recordedClicks.Count) -ForegroundColor Green
        Write-Host "     Data tersimpan ke storage/macro/modular_recorded_actions.json" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "Tekan [Enter] untuk kembali ke Menu..." -ForegroundColor Gray
    $null = Read-Host
}

# Loop Menu Utama
while ($true) {
    Clear-Host
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "          CERITAOBIM STUDIO - PEREKAM AKSI MODULAR (GOOGLE FLOW)               " -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "  Pilih aksi yang ingin Anda rekam (rekam satu per satu secara terpisah):" -ForegroundColor White
    Write-Host ""

    for ($i = 0; $i -lt $menuItems.Count; $i++) {
        $item = $menuItems[$i]
        $key = $item.Id
        $statusStr = "[ ] Belum terekam"
        $statusColor = "DarkGray"

        if ($actionData.Contains($key) -and $actionData[$key] -and $actionData[$key].Count -gt 0) {
            $count = $actionData[$key].Count
            $statusStr = "[OK] Terekam ($count klik)"
            $statusColor = "Green"
        }

        Write-Host ("  [{0}] {1,-20}" -f ($i + 1), $item.Name) -NoNewline -ForegroundColor White
        Write-Host (" {0}" -f $statusStr) -ForegroundColor $statusColor
    }

    Write-Host ""
    Write-Host "  -----------------------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [9] Lihat Rangkuman Semua Aksi" -ForegroundColor Yellow
    Write-Host "  [10] Hapus / Reset Semua Rekaman" -ForegroundColor Red
    Write-Host "  [0] Selesai & Keluar" -ForegroundColor Gray
    Write-Host "===============================================================================" -ForegroundColor Cyan

    $choice = Read-Host "Pilih nomor menu [1-8, 9, 10, 0]"
    $choice = $choice.Trim()

    if ($choice -eq "0") {
        Write-Host "`nKeluar dari perekam modular. Sampai jumpa!" -ForegroundColor Green
        Start-Sleep -Milliseconds 800
        break
    }
    elseif ($choice -ge "1" -and $choice -le "8") {
        $idx = [int]$choice - 1
        Record-SingleAction $menuItems[$idx]
    }
    elseif ($choice -eq "9") {
        Clear-Host
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host "                        RANGKUMAN REKAMAN MODULAR                              " -ForegroundColor Cyan
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host ""
        foreach ($m in $menuItems) {
            $key = $m.Id
            Write-Host ("> {0} ({1}):" -f $m.Name.ToUpper(), $key) -ForegroundColor Yellow
            if ($actionData.Contains($key) -and $actionData[$key] -and $actionData[$key].Count -gt 0) {
                foreach ($c in $actionData[$key]) {
                    Write-Host ("   * Langkah {0}: {1,-10} X={2,4}, Y={3,4} (Rasio: {4,6:P2}, {5,6:P2}) | Jeda: {6,4:F1}s" -f $c.Step, $c.Type, $c.X, $c.Y, $c.RatioX, $c.RatioY, ($c.DelayMs/1000.0)) -ForegroundColor Gray
                }
            } else {
                Write-Host "   (Belum ada data rekaman)" -ForegroundColor DarkGray
            }
            Write-Host ""
        }
        Write-Host "File Tersimpan: $modularJsonPath" -ForegroundColor DarkGray
        Write-Host "File Gabungan : $mergedJsonPath" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "Tekan [Enter] untuk kembali..." -ForegroundColor Gray
        $null = Read-Host
    }
    elseif ($choice -eq "10") {
        $confirm = Read-Host "Apakah Anda yakin ingin menghapus semua rekaman modular? (y/n)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            $actionData = [ordered]@{}
            if (Test-Path $modularJsonPath) { Remove-Item $modularJsonPath -Force }
            if (Test-Path $mergedJsonPath) { Remove-Item $mergedJsonPath -Force }
            Write-Host "Semua rekaman berhasil direset!" -ForegroundColor Green
            Start-Sleep -Milliseconds 1200
        }
    }
}
