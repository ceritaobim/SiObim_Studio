@echo off
title CeritaObim Studio - Uji Coba Upload Aset Obim
color 0E

cls
echo ===============================================================================
echo       CERITAOBIM STUDIO — UJI COBA UPLOAD ASET OBIM DAN TEMPEL PROMPT
echo ===============================================================================
echo.
echo   Skenario yang akan dijalankan:
echo   1. Buka Chrome Profil 1 ke Google Flow (flow.google.com)
echo   2. Klik "+ New project"
echo   3. Klik tombol '+' di samping kolom chat
echo   4. Klik "Upload media"
echo   5. Navigasi bilah alamat Windows Explorer ke file obim.jpg
echo   6. Klik 'I agree' jika modal "Rights to use this image" muncul
echo   7. Klik area kanvas kosong untuk menutup panel upload
echo   8. Menempelkan prompt batch dan mention tag @obim.jpg
echo   9. BERHENTI (TIDAK MENGIRIM / TIDAK GENERATE VIDEO, KREDIT AMAN 100%%)
echo.
echo   Pastikan jendela Chrome tidak tertutup aplikasi lain selama pengujian!
echo ===============================================================================
pause

cd /d "%~dp0"
node scripts\test_upload_and_prompt.js

echo.
pause
