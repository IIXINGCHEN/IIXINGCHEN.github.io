# clean_code_db.ps1
#
# Description: Script to clean VS Code databases by removing Augment-related entries
# This script will:
# 1. Find VS Code database files
# 2. Create backups
# 3. Remove entries containing "augment"
# 4. Report results

# 设置错误处理
$ErrorActionPreference = "Stop"

# 文本格式化
$BOLD = "`e[1m"
$RED = "`e[31m"
$GREEN = "`e[32m"
$YELLOW = "`e[33m"
$BLUE = "`e[34m"
$RESET = "`e[0m"

# 日志函数
function Write-LogInfo {
    param([string]$Message)
    Write-Host "${BLUE}[INFO]${RESET} $Message"
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Host "${GREEN}[SUCCESS]${RESET} $Message"
}

function Write-LogWarning {
    param([string]$Message)
    Write-Host "${YELLOW}[WARNING]${RESET} $Message"
}

function Write-LogError {
    param([string]$Message)
    Write-Host "${RED}[ERROR]${RESET} $Message"
}

# 获取VS Code数据库文件路径
function Get-VSCodeDatabasePaths {
    $paths = @()
    
    # Windows路径
    $appData = $env:APPDATA
    $localAppData = $env:LOCALAPPDATA
    
    # 检查AppData路径
    $codePath = Join-Path $appData "Code"
    if (Test-Path $codePath) {
        $paths += @(
            # 工作区存储
            (Join-Path $codePath "User\workspaceStorage\*\state.vscdb"),
            (Join-Path $codePath "User\globalStorage\*\state.vscdb"),
            # 缓存
            (Join-Path $codePath "Cache\*\*.vscdb"),
            (Join-Path $codePath "CachedData\*\*.vscdb"),
            # 日志
            (Join-Path $codePath "logs\*\*.vscdb"),
            # 其他数据库文件
            (Join-Path $codePath "User\*\*.vscdb"),
            (Join-Path $codePath "User\workspaceStorage\*\*.vscdb"),
            (Join-Path $codePath "User\globalStorage\*\*.vscdb")
        )
    }
    
    # 检查LocalAppData路径
    $codePath = Join-Path $localAppData "Programs\Microsoft VS Code"
    if (Test-Path $codePath) {
        $paths += @(
            (Join-Path $codePath "resources\app\out\vs\workbench\workbench.desktop.main.js"),
            (Join-Path $codePath "resources\app\out\vs\workbench\workbench.desktop.main.js.map")
        )
    }
    
    # 检查Insiders版本
    $codeInsidersPath = Join-Path $appData "Code - Insiders"
    if (Test-Path $codeInsidersPath) {
        $paths += @(
            (Join-Path $codeInsidersPath "User\workspaceStorage\*\state.vscdb"),
            (Join-Path $codeInsidersPath "User\globalStorage\*\state.vscdb"),
            (Join-Path $codeInsidersPath "Cache\*\*.vscdb"),
            (Join-Path $codeInsidersPath "CachedData\*\*.vscdb"),
            (Join-Path $codeInsidersPath "logs\*\*.vscdb"),
            (Join-Path $codeInsidersPath "User\*\*.vscdb"),
            (Join-Path $codeInsidersPath "User\workspaceStorage\*\*.vscdb"),
            (Join-Path $codeInsidersPath "User\globalStorage\*\*.vscdb")
        )
    }
    
    return $paths
}

# 创建备份
function Backup-File {
    param(
        [string]$FilePath
    )
    
    $backupPath = "$FilePath.backup"
    try {
        Copy-Item -Path $FilePath -Destination $backupPath -Force
        Write-LogSuccess "Created backup: $backupPath"
        return $true
    } catch {
        Write-LogError "Failed to create backup for: $FilePath"
        return $false
    }
}

# 清理数据库
function Clean-Database {
    param(
        [string]$DatabasePath
    )
    
    try {
        # 检查文件是否存在
        if (-not (Test-Path $DatabasePath)) {
            Write-LogWarning "Database file not found: $DatabasePath"
            return $false
        }
        
        # 创建备份
        if (-not (Backup-File -FilePath $DatabasePath)) {
            return $false
        }
        
        # 使用SQLite清理数据库
        $tempFile = [System.IO.Path]::GetTempFileName()
        $query = @"
DELETE FROM ItemTable WHERE key LIKE '%augment%';
DELETE FROM ItemTable WHERE key LIKE '%telemetry%';
DELETE FROM ItemTable WHERE key LIKE '%machineId%';
DELETE FROM ItemTable WHERE key LIKE '%deviceId%';
DELETE FROM ItemTable WHERE key LIKE '%sqmId%';
DELETE FROM ItemTable WHERE key LIKE '%uuid%';
DELETE FROM ItemTable WHERE key LIKE '%session%';
DELETE FROM ItemTable WHERE key LIKE '%lastSessionDate%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncDate%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncMachineId%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncDeviceId%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncSqmId%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncUuid%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncSession%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncLastSessionDate%';
DELETE FROM ItemTable WHERE key LIKE '%lastSyncLastSyncDate%';
VACUUM;
"@
        
        # 执行SQLite命令
        sqlite3 $DatabasePath $query
        
        Write-LogSuccess "Cleaned database: $DatabasePath"
        return $true
    } catch {
        Write-LogError "Failed to clean database: $DatabasePath"
        Write-LogError $_.Exception.Message
        return $false
    }
}

# 主函数
function Main {
    Write-LogInfo "Starting VS Code database cleaning process"
    
    # 获取数据库路径
    $databasePaths = Get-VSCodeDatabasePaths
    if ($databasePaths.Count -eq 0) {
        Write-LogWarning "No VS Code database files found"
        return
    }
    
    $successCount = 0
    $failCount = 0
    
    # 处理每个数据库文件
    foreach ($path in $databasePaths) {
        $files = Get-ChildItem -Path $path -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            if (Clean-Database -DatabasePath $file.FullName) {
                $successCount++
            } else {
                $failCount++
            }
        }
    }
    
    # 报告结果
    Write-LogInfo "Cleaning process completed"
    Write-LogInfo "Successfully cleaned: $successCount databases"
    if ($failCount -gt 0) {
        Write-LogWarning "Failed to clean: $failCount databases"
    }
}

# 运行主函数
Main 