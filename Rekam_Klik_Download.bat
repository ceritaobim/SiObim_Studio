@echo off
title CeritaObim Studio - Perekam Klik Mouse Google Flow
color 0B
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\record_clicks.ps1"
