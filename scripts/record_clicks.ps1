<#
.SYNOPSIS
  CeritaObim Studio - Perekam Klik Mouse Presisi Tinggi (Google Flow Recorder)
.DESCRIPTION
  Merekam koordinat fisik (X, Y) dan rasio layar monitor secara real-time.
  - Tekan tombol [X] di keyboard (atau 'xx') untuk MULAI merekam.
  - Lakukan klik mouse di layar Google Flow Anda.
  - Tekan tombol [X] lagi (atau [ESC]) untuk SELESAI merekam.
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinHookRecorder {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

try { [WinHookRecorder]::SetProcessDPIAware() | Out-Null } catch {}

$screenWidth = [WinHookRecorder]::GetSystemMetrics(0)
$screenHeight = [WinHookRecorder]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

Clear-Host
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "          CERITAOBIM STUDIO - PEREKAM KLIK MOUSE OTOMATIS (GOOGLE FLOW)        " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Resolusi Layar Terdeteksi : ${screenWidth} x ${screenHeight} (DPI Aware)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  CARA MENGGUNAKAN:" -ForegroundColor White
Write-Host "  1. Buka browser Chrome dan arahkan ke Google Flow di jendela yang aktif." -ForegroundColor Gray
Write-Host "  2. Tekan tombol [ F ] di keyboard Anda untuk MULAI merekam." -ForegroundColor Green
Write-Host "  3. Lakukan klik mouse secara normal pada tahapan download yang diinginkan:" -ForegroundColor Gray
Write-Host "     - Klik Gear Settings -> Grid -> M -> Klik kanvas kosong" -ForegroundColor Gray
Write-Host "     - Klik Videos di panel kiri" -ForegroundColor Gray
Write-Host "     - Dobel klik Card 1 (masuk Media Player)" -ForegroundColor Gray
Write-Host "     - Klik Download icon -> Klik 720p Ukuran asli" -ForegroundColor Gray
Write-Host "     - Klik kanvas -> Tekan Panah Kanan" -ForegroundColor Gray
Write-Host "     (Setiap kali Anda klik mouse, akan terdengar bunyi BEEP konfirmasi)" -ForegroundColor Yellow
Write-Host "  4. Tekan tombol [ F ] lagi (atau tombol [ ESC ]) untuk SELESAI merekam." -ForegroundColor Red
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[TUNGGU] Menunggu Anda menekan tombol [ F ] di keyboard untuk mulai..." -ForegroundColor Yellow

$VK_LBUTTON = 0x01
$VK_RBUTTON = 0x02
$VK_F = 0x46
$VK_ESC = 0x1B
$VK_RIGHT = 0x27

# Tunggu tombol F ditekan untuk mulai
$recording = $false
while (-not $recording) {
    Start-Sleep -Milliseconds 25
    $fState = [WinHookRecorder]::GetAsyncKeyState($VK_F)
    if (($fState -band 0x8000) -ne 0) {
        $recording = $true
        # Tunggu sampai tombol F dilepas
        while (([WinHookRecorder]::GetAsyncKeyState($VK_F) -band 0x8000) -ne 0) {
            Start-Sleep -Milliseconds 20
        }
    }
}

try { [Console]::Beep(1200, 200) } catch {}
Write-Host ""
Write-Host "[REC] [REKAMAN AKTIF] Silakan klik mouse pada elemen-elemen Google Flow..." -ForegroundColor Green
Write-Host "   (Klik Kiri, Klik Kanan, dan tombol Panah Kanan akan terekam otomatis)" -ForegroundColor Yellow
Write-Host "   (Tekan [ F ] atau [ ESC ] jika sudah selesai merekam)" -ForegroundColor Gray
Write-Host "-------------------------------------------------------------------------------" -ForegroundColor DarkGray

$clicks = [System.Collections.Generic.List[PSCustomObject]]::new()
$startTime = [System.Diagnostics.Stopwatch]::StartNew()
$lastActionTime = 0
$clickCount = 0

$wasLeftDown = $false
$wasRightDown = $false
$wasArrowDown = $false

while ($recording) {
    Start-Sleep -Milliseconds 20

    # Cek tombol Stop (F atau ESC)
    $fState = [WinHookRecorder]::GetAsyncKeyState($VK_F)
    $escState = [WinHookRecorder]::GetAsyncKeyState($VK_ESC)
    if ((($fState -band 0x8000) -ne 0) -or (($escState -band 0x8000) -ne 0)) {
        # Tunggu pelepasan tombol
        while ((([WinHookRecorder]::GetAsyncKeyState($VK_F) -band 0x8000) -ne 0) -or (([WinHookRecorder]::GetAsyncKeyState($VK_ESC) -band 0x8000) -ne 0)) {
            Start-Sleep -Milliseconds 20
        }
        $recording = $false
        break
    }

    # 1. Cek Klik Kanan Mouse (Right Click)
    $rState = [WinHookRecorder]::GetAsyncKeyState($VK_RBUTTON)
    $isRightDown = (($rState -band 0x8000) -ne 0)
    if ($isRightDown -and -not $wasRightDown) {
        $currentTime = $startTime.ElapsedMilliseconds
        $elapsedSinceLast = if ($clickCount -eq 0) { 0 } else { $currentTime - $lastActionTime }
        $lastActionTime = $currentTime
        $clickCount++

        $pos = [System.Windows.Forms.Cursor]::Position
        $posX = $pos.X
        $posY = $pos.Y

        $ratioX = [Math]::Round(($posX / $screenWidth), 4)
        $ratioY = [Math]::Round(($posY / $screenHeight), 4)

        try { [Console]::Beep(1100, 80) } catch {}

        Write-Host ("[KLIK KANAN] [AKSI #{0,2}] X = {1,4}, Y = {2,4}  ({3,6:P2}, {4,6:P2})  |  Jeda: {5,5:F1}s" -f $clickCount, $posX, $posY, $ratioX, $ratioY, ($elapsedSinceLast / 1000.0)) -ForegroundColor Yellow

        $clicks.Add([PSCustomObject]@{
            Step = $clickCount
            Type = "RightClick"
            X = $posX
            Y = $posY
            RatioX = $ratioX
            RatioY = $ratioY
            DelayMs = $elapsedSinceLast
        })
    }
    $wasRightDown = $isRightDown

    # 2. Cek Klik Kiri Mouse (Left Click)
    $lState = [WinHookRecorder]::GetAsyncKeyState($VK_LBUTTON)
    $isLeftDown = (($lState -band 0x8000) -ne 0)

    if ($isLeftDown -and -not $wasLeftDown) {
        $currentTime = $startTime.ElapsedMilliseconds
        $elapsedSinceLast = if ($clickCount -eq 0) { 0 } else { $currentTime - $lastActionTime }
        $lastActionTime = $currentTime
        $clickCount++

        $pos = [System.Windows.Forms.Cursor]::Position
        $posX = $pos.X
        $posY = $pos.Y

        $ratioX = [Math]::Round(($posX / $screenWidth), 4)
        $ratioY = [Math]::Round(($posY / $screenHeight), 4)

        try { [Console]::Beep(850, 80) } catch {}

        Write-Host ("[KLIK KIRI]  [AKSI #{0,2}] X = {1,4}, Y = {2,4}  ({3,6:P2}, {4,6:P2})  |  Jeda: {5,5:F1}s" -f $clickCount, $posX, $posY, $ratioX, $ratioY, ($elapsedSinceLast / 1000.0)) -ForegroundColor Cyan

        $clicks.Add([PSCustomObject]@{
            Step = $clickCount
            Type = "LeftClick"
            X = $posX
            Y = $posY
            RatioX = $ratioX
            RatioY = $ratioY
            DelayMs = $elapsedSinceLast
        })
    }
    $wasLeftDown = $isLeftDown

    # 3. Cek Tombol Panah Kanan (Right Arrow) jika ditekan
    $arrState = [WinHookRecorder]::GetAsyncKeyState($VK_RIGHT)
    $isArrowDown = (($arrState -band 0x8000) -ne 0)
    if ($isArrowDown -and -not $wasArrowDown) {
        $currentTime = $startTime.ElapsedMilliseconds
        $elapsedSinceLast = if ($clickCount -eq 0) { 0 } else { $currentTime - $lastActionTime }
        $lastActionTime = $currentTime
        $clickCount++

        try { [Console]::Beep(1300, 80) } catch {}

        Write-Host ("[TOMBOL]     [AKSI #{0,2}] Panah Kanan (Right Arrow)  |  Jeda: {1,5:F1}s" -f $clickCount, ($elapsedSinceLast / 1000.0)) -ForegroundColor Magenta

        $clicks.Add([PSCustomObject]@{
            Step = $clickCount
            Type = "RightArrow"
            X = 0
            Y = 0
            RatioX = 0
            RatioY = 0
            DelayMs = $elapsedSinceLast
        })
    }
    $wasArrowDown = $isArrowDown
}

$startTime.Stop()
try {
    [Console]::Beep(1400, 150)
    Start-Sleep -Milliseconds 50
    [Console]::Beep(1800, 200)
} catch {}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "                  [OK] REKAMAN SELESAI BERHASIL DITANGKAP!                       " -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  Total Aksi Tertangkap : $($clicks.Count) langkah" -ForegroundColor Yellow
Write-Host ""

if ($clicks.Count -eq 0) {
    Write-Host "[PERINGATAN]  Tidak ada klik mouse yang terekam. Silakan jalankan ulang jika ingin mencoba lagi." -ForegroundColor Yellow
    exit 0
}

# Simpan ke file JSON
$macroDir = Join-Path $PSScriptRoot "..\storage\macro"
if (-not (Test-Path $macroDir)) { New-Item -ItemType Directory -Path $macroDir -Force | Out-Null }
$jsonPath = Join-Path $macroDir "recorded_download_flow.json"
$clicks | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding UTF8

Write-Host "[SAVE] Hasil rekaman telah disimpan ke: $jsonPath" -ForegroundColor White
Write-Host ""
Write-Host "RANGKUMAN KOORDINAT TERCATAT:" -ForegroundColor Yellow
Write-Host "-------------------------------------------------------------------------------"
$clicks | ForEach-Object {
    if ($_.Type -eq "Click") {
        Write-Host ("  Langkah {0,2}: Klik pada X = {1,4}, Y = {2,4} (Rasio: {3:P2}, {4:P2})" -f $_.Step, $_.X, $_.Y, $_.RatioX, $_.RatioY)
    } else {
        Write-Host ("  Langkah {0,2}: Tekan Tombol Keyboard Right Arrow" -f $_.Step)
    }
}
Write-Host "-------------------------------------------------------------------------------"
Write-Host ""
Write-Host "[SUKSES] Koordinat ini siap langsung digunakan atau diterapkan ke makro download 10 profil!" -ForegroundColor Green
Write-Host "Tekan Enter untuk menutup..."
$null = Read-Host
