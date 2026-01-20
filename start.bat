@echo off
title Mon Discord Server - Node.js Console

REM --- 1. Affiche un message de démarrage ---
echo.
echo ===================================================
echo   Demarrage du serveur Node.js
echo   Ctrl+C pour arreter le serveur.
echo ===================================================
echo.

REM --- 2. Change le repertoire (au cas ou le script est lance depuis un autre endroit) ---
cd /d "%~dp0"

REM --- 3. Execute le serveur Node.js ---
npm start

REM --- 4. Garde la fenetre ouverte en cas d'erreur ---
pause