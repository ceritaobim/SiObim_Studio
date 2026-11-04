@echo off
title CeritaObim Studio - Makro Otomasi V2 (Presisi & Bersih)
color 0A

:MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO OTOMASI PRODUKSI V2 (BERSIH)
echo ===============================================================================
echo.
echo   [1] START ALL V2 (Pipeline Penuh: Generate Presisi - Download - Rakit - Kredit)
echo   [2] Generate Video V2 (Batch Prompting 12 Profil Presisi - Anti Miss-Click)
echo   [3] Uji Coba Generate 1 Profil (Pilih profil tertentu, misal Profil 4)
echo   [4] Download Video (Auto-Download Aset 720p)
echo   [5] Migrasi (Pindahkan Downloads pzxc_*, Bersihkan Nama, & Auto-Rakit FFmpeg)
echo   [6] Cek Sisa Kredit (100%% Otomatis 12 Akun via Histori Google One)
echo   [7] Jalankan Bot Telegram (Copilot & Notifikasi Video HP)
echo   [8] Buka Dashboard Studio (Web Localhost)
echo   [9] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu [1-9]: "

if "%PILIHAN%"=="1" goto START_ALL_V2
if "%PILIHAN%"=="2" goto GENERATE_V2
if "%PILIHAN%"=="3" goto TEST_SINGLE_PROFILE
if "%PILIHAN%"=="4" goto DOWNLOAD_VIDEO
if "%PILIHAN%"=="5" goto MIGRASI
if "%PILIHAN%"=="6" goto CHECK_CREDITS
if "%PILIHAN%"=="7" goto TELEGRAM_BOT
if "%PILIHAN%"=="8" goto OPEN_STUDIO
if "%PILIHAN%"=="9" goto EXIT

echo Pilihan tidak valid! Silakan tekan angka 1 sampai 9.
timeout /t 2 >nul
goto MENU

:START_ALL_V2
cls
cd /d "%~dp0"
node scripts\start_all_pipeline_v2.js
echo.
pause
goto MENU

:GENERATE_V2
cls
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --all
echo.
pause
goto MENU

:TEST_SINGLE_PROFILE
cls
cd /d "%~dp0"
set /p PNUM="Masukkan nomor profil yang ingin diuji coba (misal: 4): "
if "%PNUM%"=="" set PNUM=4
node scripts\gflow_v2_runner.js --single=%PNUM%
echo.
pause
goto MENU

:DOWNLOAD_VIDEO
cls
cd /d "%~dp0"
node scripts\download_recorded_assets.js
echo.
pause
goto MENU

:MIGRASI
cls
cd /d "%~dp0"
node scripts\macro-worker.js --sync
echo.
pause
goto MENU

:CHECK_CREDITS
cls
cd /d "%~dp0"
node scripts\check_flow_credits.js
echo.
pause
goto MENU

:TELEGRAM_BOT
cls
cd /d "%~dp0"
node scripts\telegram-bot-runner.js
echo.
pause
goto MENU

:OPEN_STUDIO
cls
start http://localhost:3000
goto MENU

:EXIT
exit
