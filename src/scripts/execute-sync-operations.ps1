
#Requires -Version 5.1
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$PrimaryRoot,

    [Parameter(Mandatory=$true)]
    [string]$DRRoot,

    [Parameter(Mandatory=$true)]
    [string]$OperationsJson # JSON string of operations [{path: "rel/path", status: "primary_only|different|dr_only", type: "file|directory"}]
)

# Basic path validation
if ($PrimaryRoot -match "[;&|`$><`n]" -or $DRRoot -match "[;&|`$><`n]") {
    Write-Error "Invalid characters in root paths."
    exit 1
}
if ((($PrimaryRoot -eq "C:\" -or $PrimaryRoot -eq "C:\" -or $PrimaryRoot -eq "/") -and (-not $PrimaryRoot.Contains("filesync_test_area"))) -or (($DRRoot -eq "C:\" -or $DRRoot -eq "C:\" -or $DRRoot -eq "/") -and (-not $DRRoot.Contains("filesync_test_area")))) {
    Write-Error "Error: Sync operations on root directories are too risky for this prototype unless they are in a 'filesync_test_area'."
    exit 1
}


try {
    $operations = $OperationsJson | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse OperationsJson: $($_.Exception.Message)"
    exit 1
}

$results = @()

foreach ($op in $operations) {
    $relativePath = $op.path
    $itemType = $op.type

    # Further path validation for each operation
    if ($relativePath -match "[\.\/\\]{2,}" -or $relativePath -match "[;&|`$><`n]") { # Disallow '..' or other risky chars in relative path
        $results += @{ path = $op.path; status = "failed"; message = "Invalid relative path: $relativePath" }
        continue
    }

    $primaryItemPath = Join-Path $PrimaryRoot $relativePath
    $drItemPath = Join-Path $DRRoot $relativePath
    $operationResult = @{ path = $op.path; status = "failed"; message = "" }

    # Normalize paths just in case
    $primaryItemPath = (Resolve-Path -LiteralPath $primaryItemPath -ErrorAction SilentlyContinue).Path
    $drItemPath = (Resolve-Path -LiteralPath $drItemPath -ErrorAction SilentlyContinue).Path # This might fail if DR path doesn't exist yet for copy
    
    # Re-evaluate $drItemPath for copy operations where it might not exist
    if (($op.status -eq "primary_only" -or $op.status -eq "different") -and (-not $drItemPath)) {
         $drItemPath = Join-Path $DRRoot $relativePath # Reconstruct if Resolve-Path failed due to non-existence
    }


    try {
        if ($op.status -eq "primary_only" -or $op.status -eq "different") {
            if (-not (Test-Path $primaryItemPath)) {
                $operationResult.message = "Primary item not found: $primaryItemPath"
                $results += $operationResult
                continue
            }
            $drParentDir = Split-Path -Path $drItemPath
            if (-not (Test-Path $drParentDir -PathType Container)) {
                New-Item -ItemType Directory -Path $drParentDir -Force -ErrorAction Stop | Out-Null
            }
        }

        switch ($op.status) {
            "primary_only" {
                Copy-Item -Path $primaryItemPath -Destination $drItemPath -Recurse -Force -ErrorAction Stop
                $operationResult.status = "success"
                $operationResult.message = "Copied from Primary to DR."
            }
            "different" {
                if ($itemType -eq "directory") {
                     # For directories, 'different' implies ensuring DR matches Primary. This might mean deeper comparison not done here.
                     # For simplicity, we'll ensure primary content overwrites/is present.
                     # This is complex: could involve removing DR items not in Primary, then copying.
                     # Simple approach: remove DR dir and recopy. CAUTION: DATA LOSS ON DR.
                     # A safer way is a two-way sync tool or more granular diff.
                     # For this prototype, if DR dir exists, remove it first to ensure clean copy.
                    if(Test-Path $drItemPath -PathType Container) {
                        Remove-Item -Path $drItemPath -Recurse -Force -ErrorAction SilentlyContinue # Try to clean up DR first
                    }
                }
                Copy-Item -Path $primaryItemPath -Destination $drItemPath -Recurse -Force -ErrorAction Stop
                $operationResult.status = "success"
                $operationResult.message = "Updated/Copied DR from Primary."
            }
            "dr_only" {
                if (Test-Path $drItemPath) {
                    Remove-Item -Path $drItemPath -Recurse -Force -ErrorAction Stop
                    $operationResult.status = "success"
                    $operationResult.message = "Removed from DR."
                } else {
                    $operationResult.status = "success" # Already gone
                    $operationResult.message = "DR item not found (already removed)."
                }
            }
            default {
                $operationResult.message = "Unknown operation status: $($op.status)"
            }
        }
    } catch {
        $operationResult.message = "Error during $($op.status) for $($op.path): $($_.Exception.Message)"
        # Attempt to get more details from the error record
        if ($_.Exception.ErrorRecord) {
            $operationResult.message += " Details: $($_.Exception.ErrorRecord.ToString())"
        }
    }
    $results += $operationResult
}

Write-Output ($results | ConvertTo-Json -Depth 5 -Compress)
