<#
.SYNOPSIS
  CeritaObim Studio - Pemutar Hasil Rekaman Klik (Google Flow Replay Engine)
.DESCRIPTION
  Memutar ulang aksi klik mouse dan tombol yang terekam di storage/macro/recorded_download_flow.json.
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Runtime.InteropServices;

public class WinHookPlayer {
    [DllImport("user32.dll")]
    public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

try { [WinHookPlayer]::SetProcessDPIAware() | Out-Null } catch {}

$screenWidth = [WinHookPlayer]::GetSystemMetrics(0)
$screenHeight = [WinHookPlayer]::GetSystemMetrics(1)
if ($screenWidth -le 0) { $screenWidth = 1920 }
if ($screenHeight -le 0) { $screenHeight = 1080 }

$jsonPath = Join-Path $PSScriptRoot "..\storage\macro\recorded_download_flow.json"
if (-not (Test-Path $jsonPath)) {
    Write-Host "[GAGAL] File rekaman tidak ditemukan di: $jsonPath" -ForegroundColor Red
    Write-Host "Silakan jalankan 'Rekam_Klik_Download.bat' terlebih dahulu untuk merekam." -ForegroundColor Yellow
    exit 1
}

$raw = Get-Content $jsonPath -Raw -Encoding UTF8
$steps = $raw | ConvertFrom-Json

Clear-Host
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "          CERITAOBIM STUDIO - PEMUTAR HASIL REKAMAN KLIK MOUSE                 " -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Ditemukan $($steps.Count) langkah terekam di file rekaman." -ForegroundColor Yellow
Write-Host "  Resolusi Layar Saat Ini : ${screenWidth} x ${screenHeight}" -ForegroundColor Gray
Write-Host ""
Write-Host "[MULAI] Mempersiapkan Google Flow. Pemutaran akan dimulai dalam 3 detik..." -ForegroundColor Green
Write-Host "   (Pastikan jendela Google Flow sudah aktif di layar Anda)" -ForegroundColor White

$ws = New-Object -ComObject WScript.Shell
$null = $ws.AppActivate('Google Flow')
$null = $ws.AppActivate('Chrome')

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "[PLAY]  MEMULAI PEMUTARAN KLIK..." -ForegroundColor Green
Write-Host "-------------------------------------------------------------------------------"

foreach ($s in $steps) {
    if ($s.Type -eq "Click" -or $s.Type -eq "LeftClick" -or $s.Type -eq "RightClick") {
        # Gunakan rasio layar jika tersedia, atau koordinat absolut
        $targetX = [int]($s.X)
        $targetY = [int]($s.Y)
        if ($s.RatioX -gt 0 -and $s.RatioY -gt 0) {
            $targetX = [int]($screenWidth * $s.RatioX)
            $targetY = [int]($screenHeight * $s.RatioY)
        }

        # Jeda sebelum klik (minimal 400ms, maksimal 3000ms)
        $waitMs = [Math]::Max(400, [Math]::Min(3000, [int]($s.DelayMs)))
        Start-Sleep -Milliseconds $waitMs

        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($targetX, $targetY)
        Start-Sleep -Milliseconds 120

        if ($s.Type -eq "RightClick") {
            # Right Click: Down (0x08) & Up (0x10)
            [WinHookPlayer]::mouse_event(0x08, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 80
            [WinHookPlayer]::mouse_event(0x10, 0, 0, 0, 0)
            Write-Host ("[KLIK KANAN] [LANGKAH {0,2}] Klik Kanan pada ({1,4}, {2,4})" -f $s.Step, $targetX, $targetY) -ForegroundColor Yellow
        } else {
            # Left Click: Down (0x02) & Up (0x04)
            [WinHookPlayer]::mouse_event(0x02, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 80
            [WinHookPlayer]::mouse_event(0x04, 0, 0, 0, 0)
            Write-Host ("[KLIK KIRI]  [LANGKAH {0,2}] Klik Kiri pada ({1,4}, {2,4})" -f $s.Step, $targetX, $targetY) -ForegroundColor Cyan
        }
    } elseif ($s.Type -eq "RightArrow") {
        $waitMs = [Math]::Max(500, [Math]::Min(3000, [int]($s.DelayMs)))
        Start-Sleep -Milliseconds $waitMs

        $ws.SendKeys('{RIGHT}')
        Write-Host ("[TOMBOL]     [LANGKAH {0,2}] Tekan Panah Kanan (Right Arrow)" -f $s.Step) -ForegroundColor Magenta
    }
}

Write-Host "-------------------------------------------------------------------------------"
Write-Host "[OK] Seluruh $($steps.Count) langkah rekaman berhasil diputar!" -ForegroundColor Green
Write-Host ""
Write-Host "Tekan Enter untuk menutup..."
$null = Read-Host
