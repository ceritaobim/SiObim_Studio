@echo off
title CeritaObim Studio - Perekam Aksi Modular Google Flow
color 0B

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\record_modular_flow.ps1"

pause
