@echo off
chcp 65001 >nul
title CeritaObim Studio - Migrasi & Perapian Klip Downloads
color 0B

cd /d "%~dp0"
echo ===============================================================================
echo        CERITAOBIM STUDIO — MIGRASI & PERAPIAN KLIP DOWNLOADS
echo ===============================================================================
echo.
echo Menjalankan pendeteksian cerdas 2-langkah + resolusi duplikat...
echo.

npx tsx scripts\run_migration_tsx.ts

echo.
echo Tekan sembarang tombol untuk kembali...
pause >nul
