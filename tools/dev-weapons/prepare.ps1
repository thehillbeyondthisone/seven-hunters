# Windows asset preparation: retain the licensed source and expand indexed PNGs to RGBA.
# The headless game image decoder accepts RGB/RGBA PNGs, but not indexed-colour PNGs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourceDir = Join-Path $PSScriptRoot 'source/minigun/textures'
$runtimeDir = Join-Path $PSScriptRoot 'source/runtime-textures'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
foreach ($file in Get-ChildItem -LiteralPath $sourceDir -Filter '*.png') {
    $original = [System.Drawing.Bitmap]::new($file.FullName)
    $rgba = [System.Drawing.Bitmap]::new($original.Width, $original.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($rgba)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.DrawImageUnscaled($original, 0, 0)
        $rgba.Save((Join-Path $runtimeDir $file.Name), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $graphics.Dispose(); $rgba.Dispose(); $original.Dispose() }
}
node (Join-Path $PSScriptRoot 'pack.mjs')
