@echo off
chcp 65001 >nul
rem Atualiza os preços do site pela Amazon Japão (o mesmo que roda sozinho
rem todo dia às 7h). Veja scripts\atualizar-precos.mts.
cd /d "%~dp0.."
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts\atualizar-precos.mts
echo.
pause
