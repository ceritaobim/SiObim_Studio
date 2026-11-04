@echo off
title CeritaObim Studio - Makro V2 (Pengujian Step-by-Step)
color 0A

:MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (PENGUJIAN STEP-BY-STEP)
echo ===============================================================================
echo.
echo   Pengujian modular 1 per 1 langkah untuk verifikasi visual langsung:
echo.
echo     [1] Langkah 1 : Buka Google Flow & Klik "+ New Project" Saja (Uji Awal!)
echo     [2] Langkah 2 : Klik Tombol "Luaskan" (Buka Panel Kanan)
echo     [3] Langkah 3 : Upload Aset Obim (obim.jpg)
echo     [4] Langkah 4 : Tempel Prompt & Kunci Chip @obim.jpg (Tanpa Kirim)
echo     [5] Langkah 5 : Klik Tombol Panah Kirim (Submit Arrow)
echo     [6] Langkah 6 : Klik Tombol Approve (1x Bersih)
echo.
echo     [A] Jalankan Sekaligus Penuh (Full SOP Otomatis 1 Akun)
echo     [Q] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih langkah yang ingin diuji [1/2/3/4/5/6/A/Q] (Default: 1): "
if "%PILIHAN%"=="" set PILIHAN=1

if "%PILIHAN%"=="1" goto STEP_1
if "%PILIHAN%"=="2" goto STEP_2
if "%PILIHAN%"=="3" goto STEP_3
if "%PILIHAN%"=="4" goto STEP_4
if "%PILIHAN%"=="5" goto STEP_5
if "%PILIHAN%"=="6" goto STEP_6
if /i "%PILIHAN%"=="A" goto RUN_ALL
if /i "%PILIHAN%"=="Q" goto EXIT

echo Pilihan tidak valid!
timeout /t 2 >nul
goto MENU

:STEP_1
cls
echo ===============================================================================
echo   [LANGKAH 1] BUKA GOOGLE FLOW & KLIK "+ NEW PROJECT" SAJA
echo ===============================================================================
echo.
set /p PNUM="Masukkan nomor profil Google yang ingin dibuka (Default: 4): "
if "%PNUM%"=="" set PNUM=4
echo.
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=1 --profile=%PNUM%
echo.
pause
goto MENU

:STEP_2
cls
echo ===============================================================================
echo   [LANGKAH 2] KLIK TOMBOL "LUASKAN" (BUKA PANEL KANAN)
echo ===============================================================================
echo Pastikan jendela Google Flow yang sudah terbuka aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=2
echo.
pause
goto MENU

:STEP_3
cls
echo ===============================================================================
echo   [LANGKAH 3] UPLOAD ASET OBIM (obim.jpg)
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=3
echo.
pause
goto MENU

:STEP_4
cls
echo ===============================================================================
echo   [LANGKAH 4] TEMPEL PROMPT & KUNCI CHIP @obim.jpg
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=4
echo.
pause
goto MENU

:STEP_5
cls
echo ===============================================================================
echo   [LANGKAH 5] KLIK TOMBOL PANAH KIRIM (SUBMIT ARROW)
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=5
echo.
pause
goto MENU

:STEP_6
cls
echo ===============================================================================
echo   [LANGKAH 6] KLIK TOMBOL APPROVE (1X BERSIH)
echo ===============================================================================
echo Pastikan jendela Google Flow aktif di layar...
timeout /t 2 >nul
cd /d "%~dp0"
node scripts\step_by_step_v2.js --step=6
echo.
pause
goto MENU

:RUN_ALL
cls
set /p PNUM="Masukkan nomor profil yang ingin dijalankan sekaligus (Default: 4): "
if "%PNUM%"=="" set PNUM=4
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --single=%PNUM%
echo.
pause
goto MENU

:EXIT
exit
