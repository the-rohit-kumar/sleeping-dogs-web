param(
    [Parameter(Mandatory = $true)]
    [string]$GamePath,
    [string]$OutputDirectory = "$env:USERPROFILE\Desktop\SleepingDogs-Audit"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $GamePath -PathType Container)) {
    throw "Game folder not found: $GamePath"
}

$root = (Resolve-Path -LiteralPath $GamePath).Path.TrimEnd('\')
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$out = (Resolve-Path -LiteralPath $OutputDirectory).Path

function Get-RelativePath([string]$Base, [string]$Path) {
    $baseUri = [System.Uri]::new(($Base.TrimEnd('\') + '\'))
    $pathUri = [System.Uri]::new($Path)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('/', '\')
}

function Get-PEInfo([string]$Path) {
    $result = [ordered]@{ IsPE = $false; Machine = ''; OptionalHeader = ''; PEOffset = $null }
    $stream = $null
    $reader = $null
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $reader = [System.IO.BinaryReader]::new($stream)
        if ($stream.Length -lt 256) { return [pscustomobject]$result }
        if ($reader.ReadUInt16() -ne 0x5A4D) { return [pscustomobject]$result }
        $stream.Position = 0x3C
        $peOffset = $reader.ReadInt32()
        if ($peOffset -lt 0 -or ($peOffset + 26) -gt $stream.Length) { return [pscustomobject]$result }
        $stream.Position = $peOffset
        if ($reader.ReadUInt32() -ne 0x00004550) { return [pscustomobject]$result }
        $machine = $reader.ReadUInt16()
        $stream.Position = $peOffset + 24
        $magic = $reader.ReadUInt16()
        $machineName = switch ($machine) {
            0x014c { 'x86 (IMAGE_FILE_MACHINE_I386)' }
            0x8664 { 'x64 (IMAGE_FILE_MACHINE_AMD64)' }
            0xAA64 { 'ARM64 (IMAGE_FILE_MACHINE_ARM64)' }
            default { ('Unknown (0x{0:X4})' -f $machine) }
        }
        $headerName = switch ($magic) {
            0x010b { 'PE32' }
            0x020b { 'PE32+ (64-bit)' }
            default { ('Unknown (0x{0:X4})' -f $magic) }
        }
        $result.IsPE = $true
        $result.Machine = $machineName
        $result.OptionalHeader = $headerName
        $result.PEOffset = $peOffset
        return [pscustomobject]$result
    }
    catch {
        return [pscustomobject]$result
    }
    finally {
        if ($reader) { $reader.Dispose() }
        elseif ($stream) { $stream.Dispose() }
    }
}

function Get-HeaderHex([string]$Path) {
    $stream = $null
    try {
        $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $buffer = New-Object byte[] 32
        $count = $stream.Read($buffer, 0, $buffer.Length)
        if ($count -le 0) { return '' }
        return ([System.BitConverter]::ToString($buffer, 0, $count)).Replace('-', ' ')
    }
    catch { return '' }
    finally { if ($stream) { $stream.Dispose() } }
}

Write-Host "Scanning file metadata under: $root" -ForegroundColor Cyan
$allFiles = Get-ChildItem -LiteralPath $root -File -Recurse -Force -ErrorAction SilentlyContinue
$fileRows = foreach ($file in $allFiles) {
    [pscustomobject]@{
        RelativePath = Get-RelativePath $root $file.FullName
        Extension = $file.Extension.ToLowerInvariant()
        SizeBytes = [int64]$file.Length
        LastWriteTimeUtc = $file.LastWriteTimeUtc.ToString('o')
    }
}

$binaryRows = foreach ($file in $allFiles | Where-Object { $_.Extension -in @('.exe', '.dll') }) {
    $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($file.FullName)
    $pe = Get-PEInfo $file.FullName
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    [pscustomobject]@{
        RelativePath = Get-RelativePath $root $file.FullName
        SizeBytes = [int64]$file.Length
        IsPE = $pe.IsPE
        Machine = $pe.Machine
        OptionalHeader = $pe.OptionalHeader
        PEOffset = $pe.PEOffset
        FileDescription = $version.FileDescription
        ProductName = $version.ProductName
        CompanyName = $version.CompanyName
        FileVersion = $version.FileVersion
        ProductVersion = $version.ProductVersion
        OriginalFilename = $version.OriginalFilename
        SignatureStatus = [string]$signature.Status
    }
}

$archiveRows = foreach ($file in $allFiles | Where-Object { $_.Extension -in @('.big', '.bix', '.pck', '.dat', '.bin', '.bik', '.bk2', '.pdb', '.xml', '.vdf') }) {
    [pscustomobject]@{
        RelativePath = Get-RelativePath $root $file.FullName
        Extension = $file.Extension.ToLowerInvariant()
        SizeBytes = [int64]$file.Length
        First32BytesHex = Get-HeaderHex $file.FullName
    }
}

$summaryByExtension = $fileRows | Group-Object Extension | ForEach-Object {
    [pscustomobject]@{
        Extension = if ($_.Name) { $_.Name } else { '[no extension]' }
        FileCount = $_.Count
        TotalSizeBytes = [int64](($_.Group | Measure-Object -Property SizeBytes -Sum).Sum)
    }
} | Sort-Object TotalSizeBytes -Descending

$summary = [ordered]@{
    GeneratedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    GameFolderName = (Split-Path $root -Leaf)
    TotalFiles = $fileRows.Count
    TotalSizeBytes = [int64](($fileRows | Measure-Object -Property SizeBytes -Sum).Sum)
    ExecutablesAndLibraries = @($binaryRows).Count
    ArchiveAndDataFiles = @($archiveRows).Count
    Notes = @(
        'Read-only inventory. No game files were modified.'
        'Only the first 32 bytes of selected data files were read.'
        'No full game archives were copied, extracted or hashed.'
        'PE architecture is identified from headers; imports and symbols require a deeper binary analysis.'
    )
}

$fileRows | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path $out 'files.csv')
$binaryRows | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path $out 'binaries.csv')
$archiveRows | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path $out 'data-file-signatures.csv')
$summaryByExtension | Export-Csv -NoTypeInformation -Encoding UTF8 -LiteralPath (Join-Path $out 'extension-summary.csv')
$summary | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $out 'summary.json')

$report = @()
$report += 'SLEEPING DOGS - READ-ONLY INVENTORY'
$report += "Generated UTC: $($summary.GeneratedAtUtc)"
$report += "Game folder name: $(Split-Path $root -Leaf)"
$report += "Files: $($summary.TotalFiles)"
$report += "Total size (GiB): $([math]::Round($summary.TotalSizeBytes / 1GB, 2))"
$report += ''
$report += 'EXECUTABLES / DLLS'
$report += ($binaryRows | Format-Table RelativePath, SizeBytes, Machine, OptionalHeader, FileVersion -AutoSize | Out-String -Width 240)
$report += 'LARGEST FILES'
$report += (($fileRows | Sort-Object SizeBytes -Descending | Select-Object -First 30 | Format-Table RelativePath, SizeBytes -AutoSize | Out-String -Width 240))
$report += 'DATA FILE SIGNATURES'
$report += ($archiveRows | Format-Table RelativePath, SizeBytes, First32BytesHex -AutoSize | Out-String -Width 240)
$report | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $out 'report.txt')

$zipPath = Join-Path (Split-Path -Parent $out) 'SleepingDogs-Audit.zip'
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zipPath -Force

Write-Host "`nInventory complete." -ForegroundColor Green
Write-Host "Report folder: $out"
Write-Host "ZIP: $zipPath"
Write-Host 'This script only reads file metadata and small file headers; it does not modify or copy the game.'
