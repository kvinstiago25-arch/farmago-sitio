param(
  [string]$JsonPath = ".\productos.json",
  [string]$CsvPath = ".\plantilla-imagenes-reales.csv",
  [string]$ImageBaseDir = ".\imagenesmedimentos\reales"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $JsonPath)) {
  throw "No existe el JSON: $JsonPath"
}
if (-not (Test-Path -LiteralPath $CsvPath)) {
  throw "No existe la plantilla CSV: $CsvPath"
}
if (-not (Test-Path -LiteralPath $ImageBaseDir)) {
  New-Item -ItemType Directory -Force -Path $ImageBaseDir | Out-Null
}

$data = Get-Content -Raw -LiteralPath $JsonPath | ConvertFrom-Json
$rows = Import-Csv -LiteralPath $CsvPath

$byId = @{}
foreach ($r in $rows) {
  if ([string]::IsNullOrWhiteSpace($r.id)) { continue }
  $byId[[string]$r.id] = $r
}

$updated = 0
$notFound = 0
$skipped = 0

foreach ($p in $data) {
  $id = [string]$p.id
  if (-not $byId.ContainsKey($id)) { $skipped++; continue }

  $r = $byId[$id]
  $real = ""
  if ($r.PSObject.Properties.Name -contains 'imagen_real') {
    $real = [string]$r.imagen_real
  }

  if ([string]::IsNullOrWhiteSpace($real)) { $skipped++; continue }

  # Normaliza separadores para web
  $realNorm = $real.Replace('\\', '/')

  # Si la plantilla trae una URL remota, se aplica directamente.
  if ($realNorm -match '^https?://') {
    $p.imagen = $realNorm
    $updated++
    continue
  }

  # Soporta ruta absoluta o relativa (desde la raíz del proyecto).
  if ([System.IO.Path]::IsPathRooted($realNorm)) {
    $abs = $realNorm
  } else {
    $abs = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $JsonPath)) $realNorm
  }

  if (Test-Path -LiteralPath $abs) {
    $p.imagen = $realNorm
    $updated++
  } else {
    $notFound++
  }
}

$data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $JsonPath -Encoding UTF8

Write-Output "actualizados=$updated"
Write-Output "omitidos=$skipped"
Write-Output "no_encontrados=$notFound"
Write-Output "json=$JsonPath"
