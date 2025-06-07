# VS Code Augment 清理工具

这是一个用于清理VS Code中Augment相关信息和修改遥测ID的PowerShell脚本工具集。

## 功能特点

- 清理VS Code数据库中的Augment相关条目
- 修改VS Code的遥测ID（machineId、deviceId、sqmId）
- 自动创建备份文件
- 支持标准版和Insiders版本的VS Code
- 支持便携版VS Code

## 系统要求

- Windows 10或更高版本
- PowerShell 5.1或更高版本
- 以下依赖项：
  - SQLite3
  - curl
  - jq

## 安装步骤

1. 首先安装Chocolatey包管理器（如果尚未安装）：
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
   iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

2. 使用Chocolatey安装所需依赖：
   ```powershell
   choco install sqlite curl jq -y
   ```

3. 下载脚本文件：
   - `install.ps1`
   - `clean_code_db.ps1`
   - `id_modifier.ps1`

## 使用方法

1. 打开PowerShell，切换到脚本所在目录

2. 运行安装脚本（选择以下任一选项）：
   ```powershell
   # 运行所有清理和修改操作
   .\install.ps1 --all

   # 仅运行数据库清理
   .\install.ps1 --clean

   # 仅修改遥测ID
   .\install.ps1 --modify-ids

   # 显示帮助信息
   .\install.ps1 --help
   ```

## 注意事项

1. 运行脚本前请确保已关闭所有VS Code实例
2. 脚本会自动创建备份文件（.backup后缀）
3. 如果遇到权限问题，请以管理员身份运行PowerShell
4. 建议在运行脚本后重启VS Code

## 故障排除

1. 如果遇到"无法识别choco命令"错误：
   - 确保已正确安装Chocolatey
   - 重新打开PowerShell窗口
   - 检查系统环境变量是否正确设置

2. 如果脚本执行失败：
   - 检查是否以管理员身份运行
   - 确认所有依赖项已正确安装
   - 查看错误信息并确保VS Code已完全关闭

## 文件说明

- `install.ps1`: 主安装脚本，用于协调其他脚本的执行
- `clean_code_db.ps1`: 负责清理VS Code数据库中的Augment相关条目
- `id_modifier.ps1`: 负责修改VS Code的遥测ID

## 安全提示

- 脚本会自动创建备份文件，建议保留这些备份
- 如果清理后出现问题，可以使用备份文件恢复
- 建议在运行脚本前备份重要的VS Code设置

## 许可证

MIT License
