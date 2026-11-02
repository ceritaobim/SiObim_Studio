@echo off
chcp 65001 >nul
title CeritaObim Studio - Uji Coba Makro Flow (3 Profil)
color 0A

echo ================================================================
echo    CERITAOBIM STUDIO - UJI COBA MAKRO FLOW (3 PROFIL)
echo ================================================================
echo.
echo Sedang mendeteksi profil Chrome dan menjalankan pengujian...
echo.

cd /d "c:\Users\iqbalandimuh\Documents\AI Workspaces\CeritaObim_Studio_Starter_Kit"
node scripts\gflow-test-3profiles.js

pause
