Add-Type -AssemblyName System.Drawing

function New-AppIcon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  # Скруглённый квадрат-фон
  $radius = [int]($size * 0.24)
  $d = $radius * 2
  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $bgPath.AddArc(0, 0, $d, $d, 180, 90)
  $bgPath.AddArc($size - $d, 0, $d, $d, 270, 90)
  $bgPath.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $bgPath.AddArc(0, $size - $d, $d, $d, 90, 90)
  $bgPath.CloseFigure()

  # Современный градиент: синий -> фиолетовый, по диагонали
  $colorA = [System.Drawing.Color]::FromArgb(255, 66, 113, 246)
  $colorB = [System.Drawing.Color]::FromArgb(255, 124, 58, 237)
  $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    $colorA, $colorB
  )
  $g.FillPath($gradBrush, $bgPath)

  # Мягкий блик сверху для глубины
  $glowRect = New-Object System.Drawing.Rectangle(0, 0, $size, [int]($size * 0.55))
  $glowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $glowRect, [System.Drawing.Color]::FromArgb(40, 255, 255, 255), [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
  )
  $oldClip = $g.Clip
  $g.SetClip($bgPath)
  $g.FillRectangle($glowBrush, $glowRect)
  $g.Clip = $oldClip

  # Иконка-смысл: восходящий график (рост денег) + точка на пике
  $m = $size * 0.24
  $pts = @(
    (New-Object System.Drawing.PointF(($m), ($size - $m - $size*0.06))),
    (New-Object System.Drawing.PointF(($size*0.42), ($size*0.56))),
    (New-Object System.Drawing.PointF(($size*0.58), ($size*0.68))),
    (New-Object System.Drawing.PointF(($size - $m), ($m)))
  )
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2, $size * 0.055))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawLines($pen, $pts)

  # Стрелка на конце графика
  $arrowSize = $size * 0.13
  $tip = $pts[3]
  $dirX = $pts[3].X - $pts[2].X
  $dirY = $pts[3].Y - $pts[2].Y
  $len = [Math]::Sqrt($dirX*$dirX + $dirY*$dirY)
  $ux = $dirX / $len; $uy = $dirY / $len
  $perpX = -$uy; $perpY = $ux
  $a1 = New-Object System.Drawing.PointF(($tip.X - $ux*$arrowSize + $perpX*$arrowSize*0.6), ($tip.Y - $uy*$arrowSize + $perpY*$arrowSize*0.6))
  $a2 = New-Object System.Drawing.PointF(($tip.X - $ux*$arrowSize - $perpX*$arrowSize*0.6), ($tip.Y - $uy*$arrowSize - $perpY*$arrowSize*0.6))
  $arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPolygon($arrowBrush, @($tip, $a1, $a2))

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

New-AppIcon 192 (Join-Path $iconsDir "icon-192.png")
New-AppIcon 512 (Join-Path $iconsDir "icon-512.png")
New-AppIcon 32 (Join-Path $iconsDir "favicon-32.png")

Write-Output "Icons created in $iconsDir"
