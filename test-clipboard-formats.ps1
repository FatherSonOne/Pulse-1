# PowerShell Script to Inspect Windows Clipboard Image Formats
# This helps diagnose why Claude Code can't display pasted images

Write-Host "=== Windows Clipboard Image Format Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Load Windows Forms assembly
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Get clipboard data
$clipboard = [System.Windows.Forms.Clipboard]::GetDataObject()

if (-not $clipboard) {
    Write-Host "ERROR: Clipboard is empty" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instructions:" -ForegroundColor Yellow
    Write-Host "1. Copy an image to clipboard (e.g., take a screenshot with Win+Shift+S)"
    Write-Host "2. Run this script again"
    exit
}

Write-Host "Clipboard contains data!" -ForegroundColor Green
Write-Host ""

# List all available formats
Write-Host "Available Clipboard Formats:" -ForegroundColor Cyan
Write-Host "-----------------------------"
$formats = $clipboard.GetFormats()
foreach ($format in $formats) {
    Write-Host "  ✓ $format" -ForegroundColor Yellow
}
Write-Host ""

# Check for image formats
$hasImage = $false
$imageFormats = @("Bitmap", "PNG", "JFIF", "GIF", "DeviceIndependentBitmap")

Write-Host "Image Format Analysis:" -ForegroundColor Cyan
Write-Host "----------------------"

foreach ($format in $imageFormats) {
    if ($clipboard.GetDataPresent($format)) {
        Write-Host "  ✓ $format format available" -ForegroundColor Green
        $hasImage = $true

        try {
            $data = $clipboard.GetData($format)
            if ($data) {
                $typeName = $data.GetType().FullName
                Write-Host "    Type: $typeName" -ForegroundColor Gray

                if ($data -is [System.Drawing.Image]) {
                    Write-Host "    Dimensions: $($data.Width) x $($data.Height)" -ForegroundColor Gray
                    Write-Host "    PixelFormat: $($data.PixelFormat)" -ForegroundColor Gray
                    Write-Host "    RawFormat: $($data.RawFormat)" -ForegroundColor Gray
                }
            }
        }
        catch {
            Write-Host "    Error reading format: $_" -ForegroundColor Red
        }
    }
}

if (-not $hasImage) {
    Write-Host "  ✗ No standard image formats found" -ForegroundColor Red
}

Write-Host ""

# Try to extract and analyze the image
Write-Host "Attempting to Extract Image:" -ForegroundColor Cyan
Write-Host "----------------------------"

try {
    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
        Write-Host "  ✓ Clipboard contains extractable image" -ForegroundColor Green

        $image = [System.Windows.Forms.Clipboard]::GetImage()

        Write-Host "  Image Details:" -ForegroundColor Yellow
        Write-Host "    - Width: $($image.Width) px"
        Write-Host "    - Height: $($image.Height) px"
        Write-Host "    - Pixel Format: $($image.PixelFormat)"
        Write-Host "    - Raw Format: $($image.RawFormat.Guid)"
        Write-Host "    - Horizontal Resolution: $($image.HorizontalResolution) dpi"
        Write-Host "    - Vertical Resolution: $($image.VerticalResolution) dpi"

        # Estimate size
        $ms = New-Object System.IO.MemoryStream
        $image.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $sizeKB = [math]::Round($ms.Length / 1024, 2)
        $sizeMB = [math]::Round($ms.Length / 1024 / 1024, 2)
        $ms.Dispose()

        Write-Host "    - Estimated PNG Size: $sizeKB KB ($sizeMB MB)" -ForegroundColor $(if ($sizeMB -gt 5) { "Red" } elseif ($sizeMB -gt 2) { "Yellow" } else { "Green" })

        if ($sizeMB -gt 5) {
            Write-Host ""
            Write-Host "  ⚠️  WARNING: Image is very large (>5MB)" -ForegroundColor Red
            Write-Host "     This may cause issues with Claude Code API limits" -ForegroundColor Red
            Write-Host "     Recommendation: Resize image before pasting" -ForegroundColor Yellow
        }
        elseif ($sizeMB -gt 2) {
            Write-Host ""
            Write-Host "  ⚠️  CAUTION: Image is moderately large (>2MB)" -ForegroundColor Yellow
            Write-Host "     May cause performance issues" -ForegroundColor Yellow
        }

        # Try to save as base64 data URI
        Write-Host ""
        Write-Host "  Testing Base64 Conversion:" -ForegroundColor Yellow
        $ms2 = New-Object System.IO.MemoryStream
        $image.Save($ms2, [System.Drawing.Imaging.ImageFormat]::Png)
        $bytes = $ms2.ToArray()
        $base64 = [Convert]::ToBase64String($bytes)
        $dataUri = "data:image/png;base64,$base64"
        $ms2.Dispose()

        Write-Host "    - Base64 Length: $($base64.Length) characters"
        Write-Host "    - Data URI Length: $($dataUri.Length) characters"
        Write-Host "    - Data URI Size: $([math]::Round($dataUri.Length / 1024, 2)) KB"

        if ($dataUri.Length -gt 1000000) {
            Write-Host "    ⚠️  Data URI is very large and may exceed limits" -ForegroundColor Red
        }

        # Save sample to file for testing
        $testPath = Join-Path $PSScriptRoot "clipboard-test-image.png"
        $image.Save($testPath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host ""
        Write-Host "  ✓ Test image saved to: $testPath" -ForegroundColor Green
        Write-Host "    You can drag this file into Claude Code to test file-based upload" -ForegroundColor Gray

        $image.Dispose()
    }
    else {
        Write-Host "  ✗ Clipboard does not contain an image in standard format" -ForegroundColor Red
    }
}
catch {
    Write-Host "  ✗ Error extracting image: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Diagnostic Complete ===" -ForegroundColor Cyan
Write-Host ""

# Check for HTML fragments (some tools copy images as HTML)
if ($clipboard.GetDataPresent("HTML Format")) {
    Write-Host "NOTE: Clipboard contains HTML format" -ForegroundColor Yellow
    Write-Host "Some screenshot tools embed images in HTML, which may not work with Claude Code" -ForegroundColor Gray
}

# Check for file drops
if ($clipboard.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    Write-Host "NOTE: Clipboard contains file paths" -ForegroundColor Yellow
    $files = $clipboard.GetData([System.Windows.Forms.DataFormats]::FileDrop)
    Write-Host "Files:" -ForegroundColor Gray
    foreach ($file in $files) {
        Write-Host "  - $file" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Cyan
Write-Host "----------------"
Write-Host "1. If image is >2MB, resize before pasting" -ForegroundColor White
Write-Host "2. Try dragging the saved test file into Claude Code instead of pasting" -ForegroundColor White
Write-Host "3. Use Windows Snipping Tool (Win+Shift+S) for most compatible screenshots" -ForegroundColor White
Write-Host "4. Clear Claude Code extension cache if thumbnails are still broken" -ForegroundColor White
Write-Host ""
