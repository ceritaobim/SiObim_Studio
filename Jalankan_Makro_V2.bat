@echo off
title CeritaObim Studio - Makro V2 (Pengujian Step-by-Step)
color 0A

:SELECT_ACCOUNT
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (PENGUJIAN STEP-BY-STEP)
echo ===============================================================================
echo.
echo   PILIH AKUN GOOGLE PROFIL YANG INGIN DIGUNAKAN:
echo     • Profil 4  : allowmeow1@gmail.com (Rekomendasi - Kredit 50/50 Segar)
echo     • Profil 5  : allowmeow2@gmail.com (Kredit 50/50 Segar)
echo     • Profil 6  : muhammadiqbal3616@gmail.com (Kredit 50/50 Segar)
echo     • Profil 1  : andimuhammadiqbal361@gmail.com
echo.
set /p PNUM="Masukkan nomor profil Google [1-12] (Default: 4): "
if "%PNUM%"=="" set PNUM=4
goto SCENARIO_MENU

:SCENARIO_MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (PENGUJIAN STEP-BY-STEP)
echo ===============================================================================
echo   AKUN AKTIF SAAT INI : PROFIL %PNUM%
echo ===============================================================================
echo.
echo   PILIH SKENARIO YANG INGIN DIJALANKAN DI PROFIL %PNUM%:
echo.
echo     [1] Langkah 1 : Buka Google Flow dan Klik "+ New Project" Saja (Uji Awal!)
echo     [2] Langkah 2 : Klik Tombol "Luaskan" (Buka Panel Kanan)
echo     [3] Langkah 3 : Upload Aset Obim (obim.jpg)
echo     [4] Langkah 4 : Tempel Prompt dan Kunci Chip @obim.jpg (Tanpa Kirim)
echo     [5] Langkah 5 : Klik Tombol Panah Kirim (Submit Arrow)
echo     [6] Langkah 6 : Klik Tombol Approve (1x Bersih)
echo.
echo     [A] Jalankan Sekaligus Penuh (Full SOP Otomatis di Profil %PNUM%)
echo     [C] Ganti Akun Profil Lain
echo     [Q] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih skenario [1/2/3/4/5/6/A/C/Q] (Default: 1): "
if "%PILIHAN%"=="" set PILIHAN=1

if "%PILIHAN%"=="1" goto STEP_1
if "%PILIHAN%"=="2" goto STEP_2
if "%PILIHAN%"=="3" goto STEP_3
if "%PILIHAN%"=="4" goto STEP_4
if "%PILIHAN%"=="5" goto STEP_5
if "%PILIHAN%"=="6" goto STEP_6
if /i "%PILIHAN%"=="A" goto RUN_ALL
if /i "%PILIHAN%"=="C" goto SELECT_ACCOUNT
if /i "%PILIHAN%"=="Q" goto EXIT

echo Pilihan tidak valid!
timeout /t 2 >nul
goto SCENARIO_MENU

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
echo Pastikan jendela Google Flow yang sudah terbuka aktif di layar...
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

:RUN_ALL
cls
echo ===============================================================================
echo   [FULL SOP] MENJALANKAN ALUR PENUH DI PROFIL %PNUM%...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --single=%PNUM%
echo.
pause
goto SCENARIO_MENU

:EXIT
exit
