
param(
  [string]$JsonPath = ".\productos.json",
  [string]$OutputDir = ".\imagenesmedimentos\genericas\marcas",
  [int]$MaxBrands = 140
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Text([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return '' }
  $formD = $text.Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $formD.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  return $sb.ToString().ToLowerInvariant().Trim()
}

function Slugify([string]$text) {
  $norm = Normalize-Text $text
  if (-not $norm) { return '' }
  $slug = [regex]::Replace($norm, '[^a-z0-9]+', '-')
  $slug = $slug.Trim('-')
  return $slug
}

function Infer-Brand([object]$item) {
  $props = $item.PSObject.Properties.Name
  if ($props -contains 'fabricante' -and -not [string]::IsNullOrWhiteSpace($item.fabricante)) {
    return [string]$item.fabricante
  }

  $name = ''
  if ($props -contains 'nombre' -and -not [string]::IsNullOrWhiteSpace($item.nombre)) {
    $name = [string]$item.nombre
  }
  if (-not $name) { return '' }

    $parts = @(($name -split '\s+') | Where-Object { $_ })
  if ($parts.Count -eq 0) { return '' }

  $stopWords = @(
    'mg','ml','mcg','gr','g','x','tabletas','capsulas','caps','jarabe','suspension','crema','gel',
    'polvo','solucion','blister','sobre','sobres','ampolla','ampollas','adultos','ninos','ninas'
  )

  foreach ($p in $parts) {
    $clean = Normalize-Text $p
    $clean = [regex]::Replace($clean, '[^a-z0-9]', '')
    if ($clean.Length -lt 3) { continue }
    if ($clean -match '^\d+$') { continue }
    if ($stopWords -contains $clean) { continue }
    return $p
  }

  return $parts[0]
}

function Color-From-Slug([string]$slug) {
  if (-not $slug) { return '#64748b' }
  $sum = 0
  foreach ($c in $slug.ToCharArray()) { $sum += [int][char]$c }
  $palette = @('#0ea5e9','#f97316','#22c55e','#eab308','#ef4444','#8b5cf6','#14b8a6','#ec4899','#64748b','#0f766e')
  return $palette[$sum % $palette.Count]
}

if (-not (Test-Path -LiteralPath $JsonPath)) {
  throw "No se encontro el archivo JSON: $JsonPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$data = Get-Content -Raw -LiteralPath $JsonPath | ConvertFrom-Json
if (-not $data) { throw 'El JSON no tiene registros.' }

$brands = @()
foreach ($item in $data) {
  $b = Infer-Brand $item
  if (-not [string]::IsNullOrWhiteSpace($b)) { $brands += $b.Trim() }
}

$unique = $brands | Sort-Object -Unique
if ($MaxBrands -gt 0 -and $unique.Count -gt $MaxBrands) {
  $unique = $unique | Select-Object -First $MaxBrands
}

$created = 0
foreach ($brand in $unique) {
  $slug = Slugify $brand
  if (-not $slug) { continue }

  $color = Color-From-Slug $slug
  $safeBrand = $brand.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')
  $svg = @"
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)"/>
  <rect x="24" y="24" width="352" height="352" rx="28" fill="#ffffff" stroke="#cbd5e1"/>
  <circle cx="200" cy="146" r="46" fill="$color" opacity="0.16"/>
  <path d="M184 128h32v16h16v24h-16v16h-32v-16h-16v-24h16z" fill="$color"/>
  <text x="200" y="238" text-anchor="middle" fill="#1e293b" font-size="30" font-family="Arial, sans-serif" font-weight="700">FarmaGo</text>
  <text x="200" y="268" text-anchor="middle" fill="#334155" font-size="18" font-family="Arial, sans-serif">$safeBrand</text>
  <text x="200" y="296" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Arial, sans-serif">Imagen generica</text>
</svg>
"@

  $path = Join-Path $OutputDir ("$slug.svg")
  Set-Content -LiteralPath $path -Value $svg -Encoding UTF8
  $created++
}

Write-Output "marcas_detectadas=$($unique.Count)"
Write-Output "svg_generados=$created"
Write-Output "directorio=$OutputDir"
