Add-Type -AssemblyName System.Drawing

$img1 = [System.Drawing.Bitmap]::FromFile("C:\Users\iqbalandimuh\.gemini\antigravity\brain\891f34f5-cd29-4453-aa77-db92ff4d0feb\.user_uploaded\media_1792860754648_5e9a9bcf.png")
$w = $img1.Width
$h = $img1.Height
$ratioX = 1920.0 / $w
$ratioY = 1080.0 / $h

for ($py = 840; $py -le 1000; $py += 10) {
    for ($px = 1480; $px -le 1900; $px += 20) {
        $imgX = [int]($px / $ratioX)
        $imgY = [int]($py / $ratioY)
        $c = $img1.GetPixel($imgX, $imgY)
        if ($c.R -gt 70) {
            Write-Host "Pixel at phys ($px, $py): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}

$img1.Dispose()
