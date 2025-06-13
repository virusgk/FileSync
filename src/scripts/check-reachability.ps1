
#Requires -Version 5.1

param(
    [Parameter(Mandatory=$true)]
    [string]$TargetHost,

    [Parameter(Mandatory=$true)]
    [int]$TargetPort
)

try {
    # Test-NetConnection can be slow, especially for timeouts.
    # -InformationLevel Quiet suppresses output on success and only shows errors.
    # -ErrorAction Stop ensures that if the cmdlet fails, it throws a terminating error caught by Catch.
    Test-NetConnection -ComputerName $TargetHost -Port $TargetPort -WarningAction SilentlyContinue -ErrorAction Stop -InformationLevel Quiet
    
    # If the above command does not throw an error, the connection is considered successful.
    exit 0
}
catch {
    # Any error during Test-NetConnection (e.g., host not found, port closed, general network issue)
    # Write-Error $_ # Optional: For logging detailed error on the server if needed
    exit 1
}
