@echo off
title CeritaObim Studio - Localhost Server
color 0A

echo ===============================================================================
echo                   CERITAOBIM STUDIO - LOCALHOST DEV SERVER
echo ===============================================================================
echo.
echo   Memulai Next.js Development Server...
echo   Alamat Studio: http://localhost:3000
echo.
echo   [INFO] Halaman login telah dinonaktifkan.
echo          Anda akan langsung masuk ke Dashboard Studio tanpa perlu login!
echo.
echo ===============================================================================
echo.

:: Tunggu 4 detik lalu otomatis membuka browser ke http://localhost:3000
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:3000"

:: Jalankan server Next.js
npm run dev

pause
