# Firmador de Mi Despacho — envía los registros VERI*FACTU a la AEAT con el certificado digital instalado en Windows.
# - Escucha solo en este ordenador (localhost:8771). Nadie de fuera puede conectarse.
# - Solo atiende a la web de Mi Despacho (comprueba el origen de cada petición).
# - Solo envía a las dos direcciones oficiales de la AEAT (pruebas y producción). No guarda nada.
# - El certificado nunca sale del ordenador: Windows lo usa para identificarse ante Hacienda.
$ErrorActionPreference = 'Stop'
$VERSION = '1.0'
$PUERTO = 8771
$ORIGENES = @('https://midespacho.vercel.app', 'https://midespacho.beatrizinversiones.com', 'https://mi-despacho-nine.vercel.app', 'http://localhost:5173')
$AEAT = @{
  pruebas    = 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
  produccion = 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP'
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = 50MB

# Solo una copia a la vez
$m = New-Object System.Threading.Mutex($false, 'Global\MiDespachoFirmador')
if (-not $m.WaitOne(0)) { exit }

function Certificados {
  $ahora = Get-Date
  Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt $ahora -and $_.Issuer -notmatch '^CN=trust_|^CN=[0-9a-f-]{36}$' } | ForEach-Object {
    $cn = if ($_.Subject -match 'CN=([^,]+)') { $Matches[1] } else { $_.Subject }
    $sn = if ($_.Subject -match 'SERIALNUMBER=([^,]+)') { $Matches[1] -replace '^IDCES-|^IDCES', '' } else { '' }
    $rep = if ($cn -match '\(R:\s*([A-Z0-9]+)\)') { $Matches[1] } else { '' }
    $org = if ($_.Subject -match 'OID\.2\.5\.4\.97=VAT(?:ES)?-([A-Z0-9]+)') { $Matches[1] } else { '' }
    @{ huella = $_.Thumbprint; titular = $cn; nif = $sn; representaA = ($(if ($rep) { $rep } else { $org })); emisor = ($(if ($_.Issuer -match 'CN=([^,]+)') { $Matches[1] } else { $_.Issuer })); caduca = $_.NotAfter.ToString('dd/MM/yyyy') }
  }
}

function Responder($stream, $codigo, $cuerpo, $origen) {
  $bytes = [Text.Encoding]::UTF8.GetBytes($cuerpo)
  $cab = "HTTP/1.1 $codigo`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n"
  if ($origen) { $cab += "Access-Control-Allow-Origin: $origen`r`nVary: Origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: content-type`r`nAccess-Control-Allow-Private-Network: true`r`n" }
  $h = [Text.Encoding]::ASCII.GetBytes($cab + "`r`n")
  $stream.Write($h, 0, $h.Length); $stream.Write($bytes, 0, $bytes.Length); $stream.Flush()
}

$escucha = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $PUERTO)
$escucha.Start()
while ($true) {
  $cliente = $escucha.AcceptTcpClient()
  try {
    $cliente.ReceiveTimeout = 15000
    $stream = $cliente.GetStream()
    $lector = New-Object System.IO.StreamReader($stream, [Text.Encoding]::UTF8, $false, 65536, $true)
    $linea = $lector.ReadLine(); if (-not $linea) { continue }
    $metodo, $ruta = $linea.Split(' ')[0..1]
    $cabeceras = @{}
    while (($l = $lector.ReadLine()) -ne '') { if ($l -match '^([^:]+):\s*(.*)$') { $cabeceras[$Matches[1].ToLower()] = $Matches[2] } }
    $origen = $cabeceras['origin']
    if ($origen -and ($ORIGENES -notcontains $origen)) { Responder $stream '403 Forbidden' '{"error":"origen no permitido"}' $null; continue }
    if ($metodo -eq 'OPTIONS') { Responder $stream '204 No Content' '' $origen; continue }
    $cuerpo = ''
    if ($cabeceras['content-length']) {
      # Content-Length va en bytes: se lee hasta completar esos bytes (el texto puede llevar tildes de 2 bytes)
      $n = [int]$cabeceras['content-length']; $sb = New-Object System.Text.StringBuilder; $buf = New-Object char[] 8192; $bytesLeidos = 0
      while ($bytesLeidos -lt $n) { $r = $lector.Read($buf, 0, $buf.Length); if ($r -le 0) { break }; [void]$sb.Append($buf, 0, $r); $bytesLeidos += [Text.Encoding]::UTF8.GetByteCount($buf, 0, $r) }
      $cuerpo = $sb.ToString()
    }
    switch -Regex ($ruta) {
      '^/estado' { Responder $stream '200 OK' ($json.Serialize(@{ ok = $true; version = $VERSION })) $origen }
      '^/certificados' { Responder $stream '200 OK' ($json.Serialize(@(Certificados))) $origen }
      '^/enviar' {
        if ($metodo -ne 'POST' -or -not $origen) { Responder $stream '400 Bad Request' '{"error":"petición no válida"}' $origen; break }
        $p = $json.DeserializeObject($cuerpo)
        $url = $AEAT[[string]$p['entorno']]
        if (-not $url) { Responder $stream '400 Bad Request' '{"error":"entorno no válido"}' $origen; break }
        $soap = [string]$p['soap']
        if ($soap -notmatch '<sum:RegFactuSistemaFacturacion>' -or $soap.Length -gt 2MB) { Responder $stream '400 Bad Request' '{"error":"no es un registro VERI*FACTU"}' $origen; break }
        $cert = Get-Item ("Cert:\CurrentUser\My\" + ([string]$p['certificado'] -replace '[^A-Fa-f0-9]', '')) -ErrorAction SilentlyContinue
        if (-not $cert -or -not $cert.HasPrivateKey) { Responder $stream '400 Bad Request' '{"error":"certificado no encontrado en este ordenador"}' $origen; break }
        try {
          $res = Invoke-WebRequest -Uri $url -Method Post -Body ([Text.Encoding]::UTF8.GetBytes($soap)) -ContentType 'text/xml; charset=utf-8' -Certificate $cert -UseBasicParsing -TimeoutSec 60
          Responder $stream '200 OK' ($json.Serialize(@{ status = [int]$res.StatusCode; body = $res.Content })) $origen
        } catch {
          $txt = ''; $cod = 0
          if ($_.Exception.Response) { $cod = [int]$_.Exception.Response.StatusCode; try { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $txt = $sr.ReadToEnd() } catch {} }
          if ($txt) { Responder $stream '200 OK' ($json.Serialize(@{ status = $cod; body = $txt })) $origen }
          else { Responder $stream '502 Bad Gateway' ($json.Serialize(@{ error = 'No se pudo conectar con la AEAT: ' + $_.Exception.Message })) $origen }
        }
      }
      default { Responder $stream '404 Not Found' '{"error":"no existe"}' $origen }
    }
  } catch { } finally { $cliente.Close() }
}
