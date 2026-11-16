@echo off
chcp 65001 >nul
rem Sincroniza os personagens do Silhueta do Dia com a pasta SILHUETA.
rem Veja JOGOS-README.md.
cd /d "%~dp0.."
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts\sincronizar-personagens.mjs
echo.
pause
