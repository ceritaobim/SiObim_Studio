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
echo.
echo     [Q] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu [1/2/3/4/5/Q] (Default: 1): "
if "%PILIHAN%"=="" set PILIHAN=1

if "%PILIHAN%"=="1" goto RUN_FULL
if "%PILIHAN%"=="2" goto RUN_GENERATE_ONLY
if "%PILIHAN%"=="3" goto RUN_DOWNLOAD_ONLY
if "%PILIHAN%"=="4" goto RUN_MIGRATION
if "%PILIHAN%"=="5" goto CHECK_SUPABASE
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

:EXIT
exit
