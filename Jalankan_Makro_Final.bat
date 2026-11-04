@echo off
chcp 65001 >nul
title CeritaObim Studio - Makro Final (11 Profil Google)
color 0A

:MAIN_MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO FINAL (11 PROFIL GOOGLE)
echo ===============================================================================
echo   SUMBER ANTREAN : DATABASE SUPABASE LANGSUNG (ANTI-DUPLIKASI ONLINE)
echo   PROFIL TARGET  : PROFIL 1 S.D. 11 (PROFIL 12 DIKECUALIKAN)
echo ===============================================================================
echo.
echo   PILIH MODE EKSEKUSI:
echo.
echo     [1] Jalankan Penuh (Generate 11 Profil + Download 11 Profil + Migrasi Database)
echo     [2] Jalankan Auto-Generate Saja (11 Profil Berurutan)
echo     [3] Jalankan Auto-Download Saja (11 Profil Berurutan)
echo     [4] Migrasi & Sinkronisasi Database (Downloads -> KLIP_BERSIH -> Supabase)
echo     [5] Cek Antrean Konten Pending di Database Supabase (Live Audit)
echo     [6] Jalankan Studio Watcher Real-Time (Auto-Pilot Background Watcher)
echo     [7] Kirim Video Final Master ke Bot Telegram (Upload Langsung ke Chat HP)
echo.
echo     [Q] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu [1/2/3/4/5/6/7/Q] (Default: 1): "
if "%PILIHAN%"=="" set PILIHAN=1

if "%PILIHAN%"=="1" goto RUN_FULL
if "%PILIHAN%"=="2" goto RUN_GENERATE_ONLY
if "%PILIHAN%"=="3" goto RUN_DOWNLOAD_ONLY
if "%PILIHAN%"=="4" goto RUN_MIGRATION
if "%PILIHAN%"=="5" goto CHECK_SUPABASE
if "%PILIHAN%"=="6" goto RUN_REALTIME_WATCHER
if "%PILIHAN%"=="7" goto RUN_TELEGRAM_DISPATCH
if /i "%PILIHAN%"=="Q" goto EXIT

echo Pilihan tidak valid!
timeout /t 2 >nul
goto MAIN_MENU

:RUN_FULL
cls
echo ===============================================================================
echo   [MODE FULL] AUTO-GENERATE (11) + DOWNLOAD (11) + MIGRASI SUPABASE
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_final_runner.js --full
echo.
pause
goto MAIN_MENU

:RUN_GENERATE_ONLY
cls
echo ===============================================================================
echo   [MODE GENERATE] AUTO-GENERATE SAJA DI 11 PROFIL GOOGLE
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_final_runner.js --generate-only
echo.
pause
goto MAIN_MENU

:RUN_DOWNLOAD_ONLY
cls
echo ===============================================================================
echo   [MODE DOWNLOAD] AUTO-DOWNLOAD SAJA DI 11 PROFIL GOOGLE
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_final_runner.js --download-only
echo.
pause
goto MAIN_MENU

:RUN_MIGRATION
cls
echo ===============================================================================
echo   [MODE MIGRASI] PINDAHKAN DOWNLOADS -> KLIP_BERSIH -> UPDATE SUPABASE
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\sync_supabase_migration.js
echo.
pause
goto MAIN_MENU

:CHECK_SUPABASE
cls
echo ===============================================================================
echo   [AUDIT LIVE] MEMERIKSA ANTREAN KONTEN UNPRODUCED DARI SUPABASE...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\fetch_supabase_batches.js
echo.
pause
goto MAIN_MENU

:RUN_REALTIME_WATCHER
cls
echo ===============================================================================
echo   [REAL-TIME DAEMON] MEMULAI STUDIO WATCHER OTOMATIS (NON-STOP)
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\realtime_studio_watcher.js
echo.
pause
goto MAIN_MENU

:RUN_TELEGRAM_DISPATCH
cls
echo ===============================================================================
echo   [TELEGRAM BOT] DISPATCH VIDEO FINAL MASTER KE BOT TELEGRAM
echo ===============================================================================
echo.
echo   Target pengiriman:
echo   - Ketik kode konten spesifik (misal: CO-2026-036)
echo   - Atau tekan ENTER langsung untuk kirim semua video yang siap tayang
echo.
set /p TG_TARGET="Masukkan kode konten (ENTER untuk kirim semua): "
if "%TG_TARGET%"=="" set TG_TARGET=all

cd /d "%~dp0"
node scripts\sync_supabase_migration.js --send-telegram %TG_TARGET%
echo.
pause
goto MAIN_MENU

:EXIT
exit
