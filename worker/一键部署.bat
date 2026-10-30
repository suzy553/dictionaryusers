@echo off
chcp 65001 >nul
title ISE Worker Deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
