<# :
@echo off
chcp 65001 >nul
title Instalar la IA local de Mi Despacho
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Raw -Encoding UTF8))"
echo.
pause
goto :eof
#>
# ============================================================
#  Instalador de la IA local de Mi Despacho (con PowerShell)
#  - Instala llama.cpp: un programa pequeño, SIN Ollama, sin servicios
#    y sin nada que arranque solo con Windows.
#  - Crea en el escritorio «IA local de Mi Despacho» para encenderla.
#  - Mientras su ventana está abierta, la IA trabaja en este ordenador.
#    Al cerrarla, se apaga y libera toda la memoria.
#  - Los contratos no salen del ordenador y no hace falta ninguna clave.
# ============================================================
$ErrorActionPreference = "Stop"
function Paso($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }
Write-Host "Instalador de la IA local de Mi Despacho" -ForegroundColor Magenta

# 1) llama.cpp
Paso "Comprobando llama.cpp"
function Buscar-Servidor {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User") + ";" + (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links")
  $c = Get-Command llama-server -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $p = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages") -Recurse -Filter "llama-server.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($p) { return $p.FullName }
  return $null
}
$servidor = Buscar-Servidor
if (-not $servidor) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "Este Windows no tiene 'winget' (Instalador de aplicaciones). Instálalo desde Microsoft Store y vuelve a abrir este archivo." -ForegroundColor Yellow
    Start-Process "ms-windows-store://pdp/?productid=9NBLGGH4NNS1"
    return
  }
  Write-Host "Instalando llama.cpp (unos minutos)..."
  winget install --id ggml.llamacpp --exact --source winget --accept-source-agreements --accept-package-agreements
  $servidor = Buscar-Servidor
  if (-not $servidor) { Write-Host "No se encuentra llama-server después de instalar. Reinicia el ordenador y vuelve a abrir este archivo." -ForegroundColor Red; return }
} else {
  Write-Host "llama.cpp ya está instalado."
}

# 2) Modelo según la memoria del ordenador
$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$modelo = if ($ram -ge 15) { "ggml-org/gemma-4-E4B-it-GGUF" } else { "ggml-org/gemma-4-E2B-it-GGUF" }
Paso "Este ordenador tiene $ram GB de memoria: se usará $modelo"

# 3) Archivo para encender la IA y acceso directo en el escritorio
Paso "Creando «IA local de Mi Despacho» en el escritorio"
$carpeta = Join-Path $env:LOCALAPPDATA "MiDespacho"
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
$encender = Join-Path $carpeta "encender-ia-local.bat"
$contenido = @"
@echo off
chcp 65001 >nul
title IA local de Mi Despacho
echo ============================================================
echo   IA local de Mi Despacho
echo   Cuando abajo ponga "server is listening", ya puedes usarla.
echo   NO cierres esta ventana mientras la uses.
echo   Al cerrarla, la IA se apaga y libera toda la memoria.
echo ============================================================
"$servidor" -hf $modelo --host 127.0.0.1 --port 8080 -c 16384
pause
"@
[IO.File]::WriteAllText($encender, ($contenido -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding($false)))

$escritorio = [Environment]::GetFolderPath("Desktop")
$acceso = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $escritorio "IA local de Mi Despacho.lnk"))
$acceso.TargetPath = $encender
$acceso.WorkingDirectory = $carpeta
$acceso.Description = "Enciende la IA local de Mi Despacho (ciérrala para liberar la memoria)"
$acceso.Save()

# 4) Encenderla ya (la primera vez descarga el modelo)
Paso "Encendiendo la IA. La primera vez descarga Gemma 4: puede tardar varios minutos."
Start-Process -FilePath $encender
Write-Host ""
Write-Host "Listo. Se ha abierto una ventana negra: es la IA." -ForegroundColor Green
Write-Host "Cuando en esa ventana ponga 'server is listening', vuelve a Mi Despacho y pulsa 'Comprobar de nuevo'."
Write-Host "Otros días: abre «IA local de Mi Despacho» en el escritorio. Para apagarla, cierra su ventana."
Write-Host "Si el navegador pregunta si permites el acceso a la red local, pulsa 'Permitir'."
