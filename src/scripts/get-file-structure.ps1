
#Requires -Version 5.1
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$RootPath,

    [string]$RelativePathBase = "" # Used for recursive calls
)

# Basic path validation (rudimentary, needs enhancement for production)
if ($RootPath -match "[;&|`$><`n]") {
    Write-Error "Invalid characters in RootPath."
    exit 1
}
if (($RootPath -eq "C:\" -or $RootPath -eq "C:\" -or $RootPath -eq "/" ) -and (-not $RootPath.Contains("filesync_test_area"))) {
     Write-Warning "Warning: Accessing a root directory. Proceed with caution."
     # Potentially exit here in a stricter environment unless a specific flag is passed
}

if (-not (Test-Path $RootPath)) {
    # If path doesn't exist, return empty array to avoid script erroring out completely
    Write-Output (@() | ConvertTo-Json -Depth 10)
    exit 0
}
if (-not (Test-Path $RootPath -PathType Container)) {
    Write-Error "RootPath '$RootPath' is not a directory."
    # To allow the API to return a "not a directory" error, we can output empty or specific error JSON
    Write-Output (@() | ConvertTo-Json -Depth 10) # Or a specific error structure
    exit 1 # Or exit 0 if API handles this as empty list
}


$items = Get-ChildItem -Path $RootPath -Force # -Force to include hidden items
$output = @()

foreach ($item in $items) {
    $currentRelativePath = ""
    if ($RelativePathBase) {
        $currentRelativePath = Join-Path $RelativePathBase $item.Name
    } else {
        $currentRelativePath = $item.Name
    }
    $currentRelativePath = $currentRelativePath.Replace('\', '/')

    $fileSize = ""
    if (-not $item.PSIsContainer) {
        try {
            $fileSize = $item.Length # Attempt to get length
        } catch {
            $fileSize = 0 # Default to 0 if Length property is not accessible (e.g. some system files)
        }
    }


    $node = @{
        id             = "$($item.Name)-$(Get-Random)"
        name           = $item.Name
        type           = if ($item.PSIsContainer) { "directory" } else { "file" }
        path           = $item.FullName.Replace('\', '/')
        relativePath   = $currentRelativePath
        lastModified   = $item.LastWriteTime.ToUniversalTime().ToString("o") # ISO 8601
        size           = if (-not $item.PSIsContainer) { "$($fileSize)" } else { "" } # Raw bytes as string for now
        status         = "unknown"
        isOpen         = $false
        content        = $null # Content not fetched for list view
        children       = @()
    }

    if ($item.PSIsContainer) {
        $node.children = (& $PSCommandPath -RootPath $item.FullName -RelativePathBase $currentRelativePath)
    }
    $output += $node
}

Write-Output ($output | ConvertTo-Json -Depth 10 -Compress)
