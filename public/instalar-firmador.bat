@echo off
chcp 65001 >nul
title Instalar el Firmador de Mi Despacho (VERI*FACTU)
echo.
echo  Firmador de Mi Despacho
echo  -----------------------
echo  Envia tus facturas a Hacienda (VERI*FACTU) con el certificado digital
echo  instalado en este ordenador. El certificado no sale de tu PC.
echo.
set "DEST=%LOCALAPPDATA%\MiDespacho"
if not exist "%DEST%" mkdir "%DEST%"
echo  Descargando el firmador desde Mi Despacho...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -UseBasicParsing -Uri 'https://midespacho.vercel.app/firmador/firmador.ps1' -OutFile '%DEST%\firmador.ps1'"
if not exist "%DEST%\firmador.ps1" (
  echo  No se ha podido descargar. Comprueba la conexion y vuelve a probar.
  pause & exit /b 1
)
rem Arranque oculto al iniciar Windows
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Firmador Mi Despacho.lnk'); $s.TargetPath='powershell.exe'; $s.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DEST%\firmador.ps1\"'; $s.WindowStyle=7; $s.Save()"
rem Enlace midespacho-firma:// para que la web pueda encenderlo
reg add "HKCU\Software\Classes\midespacho-firma" /ve /d "URL:Firmador Mi Despacho" /f >nul
reg add "HKCU\Software\Classes\midespacho-firma" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\midespacho-firma\shell\open\command" /ve /d "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DEST%\firmador.ps1\"" /f >nul
echo  Encendiendo el firmador...
start "" powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%DEST%\firmador.ps1"
echo.
echo  Listo. El firmador queda encendido y se enciende solo al arrancar Windows.
echo  Vuelve a Mi Despacho: ya puedes emitir facturas VERI*FACTU.
echo.
pause
