@echo off
title CeritaObim Studio - Makro Otomasi Produksi Video
color 0B

:MENU
cls
echo ===============================================================================
echo                CERITAOBIM STUDIO - MAKRO OTOMASI PRODUKSI VIDEO
echo ===============================================================================
echo.
echo   [1] START ALL (Pipeline Penuh: Generate - Download - Migrasi - Cek Kredit)
echo   [2] Generate Video (Batch Prompting 10 Profil Google Flow)
echo   [3] Download Video (Auto-Download Aset 720p Berdasar Rekaman Klik Kanan)
echo   [4] Migrasi (Pindahkan Downloads pzxc_*, Bersihkan Nama, dan Auto-Rakit FFmpeg)
echo   [5] Cek Kredit (100%% Otomatis 10 Akun via Histori Google One)
echo   [6] Test Download 1 Profil (Auto Masuk Project + Unduh Aset)
echo   [7] Rekam Aksi Modular (Perekam Per-Menu: Open Project, Display, Close Panel, Download Aset 1-4)
echo   [8] Jalankan Bot Telegram (Chat Copilot & Review Video via HP)
echo   [9] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu [1-9]: "

if "%PILIHAN%"=="1" goto START_ALL
if "%PILIHAN%"=="2" goto GENERATE_VIDEO
if "%PILIHAN%"=="3" goto DOWNLOAD_VIDEO
if "%PILIHAN%"=="4" goto MIGRASI
if "%PILIHAN%"=="5" goto CHECK_CREDITS
if "%PILIHAN%"=="6" goto TEST_EXTENSION
if "%PILIHAN%"=="7" goto REKAM_MODULAR
if "%PILIHAN%"=="8" goto TELEGRAM_BOT
if "%PILIHAN%"=="9" goto EXIT

echo Pilihan tidak valid! Silakan tekan angka 1 sampai 9.
timeout /t 2 >nul
goto MENU

:START_ALL
cls
cd /d "%~dp0"
node scripts\start_all_pipeline.js
echo.
pause
goto MENU

:GENERATE_VIDEO
cls
cd /d "%~dp0"
node scripts\gflow-windows-macro.js
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

:TEST_EXTENSION
cls
cd /d "%~dp0"
node scripts\test_flow_extension.js
echo.
pause
goto MENU

:REKAM_MODULAR
cls
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\record_modular_flow.ps1"
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

:EXIT
exit /b 0
