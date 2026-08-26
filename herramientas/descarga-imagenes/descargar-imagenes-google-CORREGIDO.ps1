<#
descargar-imagenes-google-CORREGIDO.ps1
-----------------------------------------
Corrige los 2 problemas que causaban imagenes incorrectas (buzo, Peppa Pig, etc.):

  1. Antes: buscaba en TODO Google Imagenes sin restriccion de sitio.
     Ahora: agrega "site:dominio" solo para droguerias/retailers reales
     (mismo criterio que tu script de Playwright).

  2. Antes: descargaba el primer resultado sin revisar nada, y
     sobreescribia productos.json directamente.
     Ahora: filtra candidatos cuyo link/titulo contenga palabras prohibidas
     (ropa, caricaturas, etc.) y en vez de tocar productos.json, escribe un
     CSV de revision (imagenes_candidatas_revision.csv) para que TU apruebes
     antes de que se use en el catalogo. Nada se aplica automaticamente.

USO (ejemplo):
  .\descargar-imagenes-google-CORREGIDO.ps1 -ApiKey "TU_KEY" -SearchEngineId "TU_CX" -MaxProducts 50
#>

param(
  [string]$JsonPath = ".\productos.json",
  [string]$OutputDir = ".\imagenesmedimentos\reales",
  [string]$ApiKey,
  [string]$SearchEngineId,
  [int]$MaxProducts = 0,
  [switch]$OnlyMissing,
  [switch]$DryRun,
  [switch]$Debug2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ApiKey)) { throw "Debes enviar -ApiKey (Google Custom Search API Key)." }
if ([string]::IsNullOrWhiteSpace($SearchEngineId)) { throw "Debes enviar -SearchEngineId (CX)." }
if (-not (Test-Path -LiteralPath $JsonPath)) { throw "No existe el archivo JSON: $JsonPath" }
if (-not (Test-Path -LiteralPath $OutputDir)) { New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null }

# ---- MISMA lista blanca que ya usa tu script de Playwright ----
$ALLOWED_DOMAINS = @(
  "larebajavirtual.com",
  "cruzverde.com.co",
  "farmatodo.com.co",
  "drogueriascafam.com.co"
)

# ---- Palabras que descartan un candidato aunque venga de un dominio permitido ----
$BLOCKED_WORDS = @("logo","icon","favicon","banner","placeholder","avatar","anime","shirt","camiseta","manga","buzo","hoodie","peppa","cartoon","juguete","disfraz")

function Contains-BlockedWord([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $false }
  $t = $text.ToLowerInvariant()
  foreach ($w in $BLOCKED_WORDS) { if ($t.Contains($w)) { return $true } }
  return $false
}

function Build-Query($p, [string]$dominio) {
  $nombre = [string]$p.nombre
  $pieces = @($nombre, "medicamento caja") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  $query = ($pieces -join " ").Trim() + " site:$dominio"
  if ($query.Length -gt 160) { $query = $query.Substring(0, 160) }
  return $query
}

function Get-ExtFromContentType([string]$contentType) {
  if ([string]::IsNullOrWhiteSpace($contentType)) { return ".jpg" }
  $ct = $contentType.ToLowerInvariant()
  if ($ct -match "image/png") { return ".png" }
  if ($ct -match "image/webp") { return ".webp" }
  return ".jpg"
}

function Search-GoogleImageCandidates([string]$query, [string]$apiKey, [string]$cx) {
  $params = @{ key = $apiKey; cx = $cx; q = $query; searchType = "image"; num = "5"; safe = "active"; imgType = "photo" }
  $url = "https://www.googleapis.com/customsearch/v1?" + (($params.GetEnumerator() | ForEach-Object { "{0}={1}" -f $_.Key, [Uri]::EscapeDataString([string]$_.Value) }) -join "&")
  if ($Debug2) { Write-Host "  [debug] query: $query" }
  try {
    $resp = Invoke-RestMethod -Method Get -Uri $url -TimeoutSec 30
    if ($Debug2) { Write-Host "  [debug] items recibidos: $($resp.items.Count)" }
    if (-not $resp.items) { return @() }
    return @($resp.items)
  } catch {
    if ($Debug2) {
      Write-Host "  [debug] ERROR en la llamada a la API (HTTP $($_.Exception.Response.StatusCode.value__)):"
      $body = $null
      try {
        if ($_.Exception.Response) {
          $stream = $_.Exception.Response.GetResponseStream()
          $reader = New-Object System.IO.StreamReader($stream)
          $body = $reader.ReadToEnd()
        }
      } catch {}
      if (-not $body -and $_.ErrorDetails -and $_.ErrorDetails.Message) { $body = $_.ErrorDetails.Message }
      if ($body) {
        Write-Host "  [debug] Respuesta completa de Google (tambien guardada en google_api_debug.log):"
        Write-Host "  $body"
        Add-Content -Path "google_api_debug.log" -Value "`n----- $(Get-Date) -----`n$body"
      } else {
        Write-Host "  [debug]   $($_.Exception.Message)"
      }
    }
    return @()
  }
}

$projectRoot = (Resolve-Path -LiteralPath $JsonPath | Split-Path -Parent)
$data = Get-Content -Raw -LiteralPath $JsonPath | ConvertFrom-Json
if (-not $data -or $data.Count -eq 0) { throw "productos.json no contiene productos." }

$revision = New-Object System.Collections.Generic.List[object]
$processed = 0
$encontrados = 0
$sinResultado = 0

foreach ($p in $data) {
  if ($MaxProducts -gt 0 -and $processed -ge $MaxProducts) { break }

  $id = [string]$p.id
  if ([string]::IsNullOrWhiteSpace($id)) { continue }

  # Solo procesar productos que aun tienen imagen generica (no tocar los que ya tienen foto real)
  $imagenActual = [string]$p.imagen
  if ($OnlyMissing -and $imagenActual -notmatch "genericas/") { continue }

  $processed++
  $candidatoValido = $null

  foreach ($dominio in $ALLOWED_DOMAINS) {
    $query = Build-Query $p $dominio
    if ($DryRun) { Write-Output "[DRY-RUN] $id ($dominio) => $query"; continue }

    $candidatos = @(Search-GoogleImageCandidates -query $query -apiKey $ApiKey -cx $SearchEngineId)
    if ($Debug2 -and $candidatos.Count -gt 0) {
      Write-Host "  [debug] primer candidato crudo:"
      Write-Host ($candidatos[0] | ConvertTo-Json -Depth 5)
    }
    foreach ($item in $candidatos) {
      if ($null -eq $item) { continue }
      $link = ""
      $titulo = ""
      $paginaOrigen = ""
      if ($item.PSObject.Properties.Match('link').Count -gt 0) { $link = [string]$item.link }
      if ($item.PSObject.Properties.Match('title').Count -gt 0) { $titulo = [string]$item.title }
      if ($item.PSObject.Properties.Match('image').Count -gt 0 -and $item.image -and $item.image.PSObject.Properties.Match('contextLink').Count -gt 0) {
        $paginaOrigen = [string]$item.image.contextLink
      }

      if ([string]::IsNullOrWhiteSpace($link)) { continue }
      if (Contains-BlockedWord $link) { continue }
      if (Contains-BlockedWord $titulo) { continue }
      # Verifica que el dominio real del resultado sea el permitido (Google a veces devuelve otro)
      $hostOk = $ALLOWED_DOMAINS | Where-Object { $link -match [regex]::Escape($_) }
      if (-not $hostOk) { continue }

      $candidatoValido = [PSCustomObject]@{ Link = $link; Titulo = $titulo; Pagina = $paginaOrigen; Dominio = $dominio }
      break
    }
    if ($candidatoValido) { break }
    Start-Sleep -Milliseconds 150
  }

  if ($DryRun) { continue }

  if (-not $candidatoValido) {
    $sinResultado++
    continue
  }

  # Descarga a un archivo temporal de REVISION (no reemplaza nada en productos.json)
  try {
    $outBase = Join-Path $OutputDir "$id-candidato"
    $response = Invoke-WebRequest -Uri $candidatoValido.Link -Method Get -TimeoutSec 30 -MaximumRedirection 5
    $ext = Get-ExtFromContentType -contentType ([string]$response.Headers["Content-Type"])
    $finalPath = "$outBase$ext"
    [IO.File]::WriteAllBytes($finalPath, $response.Content)

    $encontrados++
    $revision.Add([PSCustomObject]@{
      id = $id
      nombre = [string]$p.nombre
      imagen_actual = $imagenActual
      candidato_descargado = $finalPath
      fuente = $candidatoValido.Pagina
      dominio = $candidatoValido.Dominio
    })
  } catch {
    $sinResultado++
  }
}

if (-not $DryRun) {
  $revision | Export-Csv -Path "imagenes_candidatas_revision.csv" -NoTypeInformation -Encoding UTF8
}

Write-Output "procesados=$processed"
Write-Output "candidatos_encontrados=$encontrados"
Write-Output "sin_resultado_confiable=$sinResultado"
Write-Output ""
Write-Output "IMPORTANTE: revisa 'imagenes_candidatas_revision.csv' y las fotos en $OutputDir"
Write-Output "antes de aprobar. NINGUNA imagen se aplico automaticamente al catalogo."
