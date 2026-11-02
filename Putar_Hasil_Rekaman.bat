@echo off
title CeritaObim Studio - Pemutar Hasil Rekaman Klik Mouse Google Flow
color 0A
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\play_recorded_clicks.ps1"
