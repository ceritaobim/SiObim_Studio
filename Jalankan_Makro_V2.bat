@echo off
chcp 65001 >nul
title CeritaObim Studio - Makro V2 (Generate dan Download Otomatis)
color 0A

:SELECT_ACCOUNT
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (GENERATE + DOWNLOAD)
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\show_profiles.js
echo.
echo ===============================================================================
set /p PNUM="Pilih nomor akun profil Google [1-12] (Default: 4): "
if "%PNUM%"=="" set PNUM=4
goto SCENARIO_MENU

:SCENARIO_MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (KENDALI PRODUKSI)
echo ===============================================================================
echo   AKUN AKTIF SAAT INI : PROFIL %PNUM%
echo ===============================================================================
echo.
echo   [SKENARIO 1: PEMBUATAN VIDEO (AUTO-GENERATE)]
echo     [1] Langkah 1 : Buka Google Flow dan Klik "+ New Project"
echo     [2] Langkah 2 : Klik Tombol "Luaskan" (Buka Panel Kanan)
echo     [3] Langkah 3 : Upload Aset Obim (obim.jpg)
echo     [4] Langkah 4 : Tempel Prompt dan Kunci Chip @obim.jpg (Tanpa Kirim)
echo     [5] Langkah 5 : Klik Tombol Panah Kirim (Submit Arrow)
echo     [6] Langkah 6 : Klik Tombol Approve (1x Bersih)
echo     [A] Jalankan Auto-Generate 1 Profil Penuh (Profil %PNUM%)
echo     [B] Jalankan Auto-Generate SEMUA 12 Profil Berurutan (Full Loop)
echo.
echo   [SKENARIO 2: PENGUNDUHAN VIDEO (AUTO-DOWNLOAD / SIDAK KUALITAS)]
echo     [D1] Langkah D1 : Buka Google Flow dan Buka Proyek Terbaru
echo     [D2] Langkah D2 : Rapikan Tampilan Kanvas (Tutup Panel Samping)
echo     [D3] Langkah D3 : Unduh Card 1 (Klik Kanan + Download + 720p)
echo     [D4] Langkah D4 : Unduh Card 2 (Klik Kanan + Download + 720p)
echo     [D5] Langkah D5 : Unduh Card 3 (Klik Kanan + Download + 720p)
echo     [D6] Langkah D6 : Unduh Card 4 (Klik Kanan + Download + 720p)
echo     [DA] Jalankan Auto-Download Penuh di Profil %PNUM% (Semua Card)
echo     [DB] Jalankan Auto-Download SEMUA 12 Profil Berurutan
echo     [DS] Sinkronisasi File Downloads ke KLIP_BERSIH (FFmpeg Ready)
echo.
echo   [PENGATURAN]
echo     [C]  Ganti Akun Profil Lain
echo     [Q]  Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu yang diinginkan (Default: 1): "
if "%PILIHAN%"=="" set PILIHAN=1

if "%PILIHAN%"=="1" goto STEP_1
if "%PILIHAN%"=="2" goto STEP_2
if "%PILIHAN%"=="3" goto STEP_3
if "%PILIHAN%"=="4" goto STEP_4
if "%PILIHAN%"=="5" goto STEP_5
if "%PILIHAN%"=="6" goto STEP_6
if /i "%PILIHAN%"=="A" goto RUN_ALL_SINGLE
if /i "%PILIHAN%"=="B" goto RUN_ALL_PROFILES

if /i "%PILIHAN%"=="D1" goto STEP_D1
if /i "%PILIHAN%"=="D2" goto STEP_D2
if /i "%PILIHAN%"=="D3" goto STEP_D3
if /i "%PILIHAN%"=="D4" goto STEP_D4
if /i "%PILIHAN%"=="D5" goto STEP_D5
if /i "%PILIHAN%"=="D6" goto STEP_D6
if /i "%PILIHAN%"=="DA" goto RUN_DOWNLOAD_SINGLE
if /i "%PILIHAN%"=="DB" goto RUN_DOWNLOAD_ALL
if /i "%PILIHAN%"=="DS" goto RUN_SYNC_DOWNLOADS

if /i "%PILIHAN%"=="C" goto SELECT_ACCOUNT
if /i "%PILIHAN%"=="Q" goto EXIT

echo Pilihan tidak valid!
timeout /t 2 >nul
goto SCENARIO_MENU

:: ============================================================================
:: SKENARIO 1: AUTO-GENERATE STEP-BY-STEP
:: ============================================================================

:STEP_1
cls
echo ===============================================================================
echo   [LANGKAH 1] BUKA GOOGLE FLOW DAN KLIK "+ NEW PROJECT" DI PROFIL %PNUM%
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=1 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_2
cls
echo ===============================================================================
echo   [LANGKAH 2] KLIK TOMBOL "LUASKAN" (BUKA PANEL KANAN) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=2 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_3
cls
echo ===============================================================================
echo   [LANGKAH 3] UPLOAD ASET OBIM (obim.jpg) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=3 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_4
cls
echo ===============================================================================
echo   [LANGKAH 4] TEMPEL PROMPT DAN KUNCI CHIP @obim.jpg DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=4 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_5
cls
echo ===============================================================================
echo   [LANGKAH 5] KLIK TOMBOL PANAH KIRIM (SUBMIT ARROW) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=5 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_6
cls
echo ===============================================================================
echo   [LANGKAH 6] KLIK TOMBOL APPROVE (1X BERSIH) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=6 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:RUN_ALL_SINGLE
cls
echo ===============================================================================
echo   [FULL SOP] MENJALANKAN AUTO-GENERATE PENUH DI PROFIL %PNUM%...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --single=%PNUM%
echo.
pause
goto SCENARIO_MENU

:RUN_ALL_PROFILES
cls
echo ===============================================================================
echo   [FULL LOOP] MENJALANKAN AUTO-GENERATE DI SEMUA 12 PROFIL BERURUTAN...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --all
echo.
pause
goto SCENARIO_MENU

:: ============================================================================
:: SKENARIO 2: AUTO-DOWNLOAD STEP-BY-STEP (SIDAK KUALITAS)
:: ============================================================================

:STEP_D1
cls
echo ===============================================================================
echo   [LANGKAH D1] BUKA GOOGLE FLOW DAN BUKA PROYEK TERBARU DI PROFIL %PNUM%
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d1 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_D2
cls
echo ===============================================================================
echo   [LANGKAH D2] RAPIKAN TAMPILAN KANVAS (TUTUP PANEL) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d2 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_D3
cls
echo ===============================================================================
echo   [LANGKAH D3] UNDUH CARD VIDEO #1 (KLIK KANAN + 720p) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d3 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_D4
cls
echo ===============================================================================
echo   [LANGKAH D4] UNDUH CARD VIDEO #2 (KLIK KANAN + 720p) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d4 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_D5
cls
echo ===============================================================================
echo   [LANGKAH D5] UNDUH CARD VIDEO #3 (KLIK KANAN + 720p) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d5 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:STEP_D6
cls
echo ===============================================================================
echo   [LANGKAH D6] UNDUH CARD VIDEO #4 (KLIK KANAN + 720p) DI PROFIL %PNUM%
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=d6 --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:RUN_DOWNLOAD_SINGLE
cls
echo ===============================================================================
echo   [UNDUH PENUH] MENGUNDUH SEMUA KARTU VIDEO DI PROFIL %PNUM%...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\download_step_by_step.js --step=da --profile=%PNUM%
echo.
pause
goto SCENARIO_MENU

:RUN_DOWNLOAD_ALL
cls
echo ===============================================================================
echo   [FULL DOWNLOAD LOOP] MENGUNDUH SEMUA PROFIL BERURUTAN (12 PROFIL)...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\download_recorded_assets.js
echo.
pause
goto SCENARIO_MENU

:RUN_SYNC_DOWNLOADS
cls
echo ===============================================================================
echo   [SINKRONISASI] MEMINDAHKAN FILE DOWNLOADS KE 00.FolderOwner\KLIP_BERSIH...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\macro-worker.js --sync
echo.
pause
goto SCENARIO_MENU

:EXIT
exit
