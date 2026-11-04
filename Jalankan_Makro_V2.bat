@echo off
title CeritaObim Studio - Makro V2 (Generate 1 Akun Terpilih)
color 0A

:MENU
cls
echo ===============================================================================
echo            CERITAOBIM STUDIO - MAKRO V2 (GENERATE 1 AKUN TERPILIH)
echo ===============================================================================
echo.
echo   Makro V2 ini berfokus pada eksekusi generate video otomatis yang bersih,
echo   presisi (anti miss-click pada tombol submit panah), dan tanpa membabi-buta.
echo.
echo   Alur SOP yang dijalankan:
echo     1. Membuka Google Flow di profil terpilih
echo     2. Klik "+ New project"
echo     3. Klik tombol "Luaskan" (buka panel kanan)
echo     4. Upload aset obim.jpg ke project
echo     5. Tempel teks prompt batch ke chatbox
echo     6. Ketik @obim.jpg dan kunci chip aset via Enter
echo     7. Klik lingkaran tombol panah kirim (Submit Arrow)
echo     8. Tunggu dialog Approve muncul dan klik Approve 1x saja
echo.
echo ===============================================================================
echo.
echo   [1] Jalankan Generate Otomatis (Pilih 1 Akun Profil, misal: Profil 4)
echo   [2] Keluar
echo.
echo ===============================================================================
set /p PILIHAN="Pilih menu [1/2]: "

if "%PILIHAN%"=="1" goto RUN_SINGLE
if "%PILIHAN%"=="2" goto EXIT

echo Pilihan tidak valid! Silakan ketik 1 atau 2.
timeout /t 2 >nul
goto MENU

:RUN_SINGLE
cls
echo ===============================================================================
echo            PILIH NOMOR PROFIL GOOGLE UNTUK DIJALANKAN (1 AKUN)
echo ===============================================================================
echo.
echo   Pilihan umum profil:
echo     • Profil 4  : allowmeow1@gmail.com (Kredit 50/50 - Segar)
echo     • Profil 5  : allowmeow2@gmail.com (Kredit 50/50 - Segar)
echo     • Profil 6  : muhammadiqbal3616@gmail.com (Kredit 50/50 - Segar)
echo     • Profil 1  : andimuhammadiqbal361@gmail.com
echo.
set /p PNUM="Masukkan nomor profil yang ingin dijalankan (Default: 4): "
if "%PNUM%"=="" set PNUM=4

cls
echo ===============================================================================
echo   🚀 MEMULAI MAKRO V2 UNTUK PROFIL %PNUM%...
echo ===============================================================================
echo.
cd /d "%~dp0"
node scripts\gflow_v2_runner.js --single=%PNUM%
echo.
echo ===============================================================================
echo   Eksekusi selesai. Silakan periksa jendela Chrome Profil %PNUM% di layar Anda!
echo ===============================================================================
echo.
pause
goto MENU

:EXIT
exit
