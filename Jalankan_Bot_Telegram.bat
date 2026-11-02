@echo off
title CeritaObim Studio - Telegram Bot Runner (Mode Uji Coba Laptop)
color 0A

echo ===============================================================================
echo            CERITAOBIM STUDIO — RUNNER BOT TELEGRAM (POLLING LOKAL)
echo ===============================================================================
echo.
echo  Bot ini menghubungkan Telegram di HP Anda dengan Studio CeritaObim.
echo  Pesan Anda akan diteruskan ke API Lokal (http://localhost:3000).
echo.
echo  Pastikan:
echo   1. Localhost Studio sudah menyala (buka Jalankan_Localhost.bat jika belum).
echo   2. Anda sudah klik START di bot Telegram: @ceritaobim_studio_bot
echo.
echo  Tekan Ctrl+C untuk menghentikan runner.
echo ===============================================================================
echo.

cd /d "%~dp0"
node scripts\telegram-bot-runner.js
pause
