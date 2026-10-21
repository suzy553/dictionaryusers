# 一键把小越背单词推到 GitHub（手机能访问的正经办法）
#
# 用法：
#   1) 先在 GitHub 网页上建一个空仓库，名字随意，例如 vocab-shelf
#      —— 免费账号要用「公开」仓库，私有仓库的 Pages 需要付费
#   2) 在本目录打开 PowerShell，执行：
#        .\deploy.ps1 -Repo https://github.com/你的用户名/vocab-shelf.git
#   3) 脚本跑完会打印你的网址；首次还要去仓库 Settings → Pages 选 main + /(root)

param(
    [Parameter(Mandatory = $true)][string]$Repo,
    [string]$Branch = 'main',
    [string]$Message = 'feat: 小越背单词'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# ---- 找 git：PATH 里没有就翻常见安装位置（含 GitHub Desktop 自带的那份）----
function Resolve-Git {
    $c = Get-Command git -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $cands = @(
        "$env:ProgramFiles\Git\cmd\git.exe",
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    $cands += Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" `
        -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
    foreach ($p in $cands) { if ($p -and (Test-Path $p)) { return $p } }
    return $null
}

$git = Resolve-Git
if (-not $git) {
    Write-Host ''
    Write-Host '  没找到 git，需要先装一个（二选一）：' -ForegroundColor Yellow
    Write-Host '    · GitHub Desktop（图形界面，装完就有）  https://desktop.github.com/'
    Write-Host '    · Git for Windows（命令行）            https://git-scm.com/download/win'
    Write-Host ''
    Write-Host '  装完把这个 PowerShell 窗口关掉重开，再跑一次本脚本。'
    exit 1
}
Write-Host "· 使用 git: $git" -ForegroundColor DarkGray

if (-not (Test-Path .git)) {
    & $git init | Out-Null
    Write-Host '· 已初始化仓库' -ForegroundColor DarkGray
}

# 没有配置身份时，给这个仓库设一个占位身份，避免 commit 失败
$name = & $git config user.name
if (-not $name) {
    & $git config user.name 'xiaoyue-vocab'
    & $git config user.email 'xiaoyue-vocab@local'
}

& $git add -A
$pending = & $git status --porcelain
if ($pending) {
    & $git commit -m $Message | Out-Null
    Write-Host '· 已提交本地改动' -ForegroundColor DarkGray
} else {
    Write-Host '· 没有新改动' -ForegroundColor DarkGray
}

& $git branch -M $Branch
$remotes = & $git remote
if ($remotes -contains 'origin') { & $git remote set-url origin $Repo }
else { & $git remote add origin $Repo }

Write-Host '· 正在推送（第一次会弹窗让你登录 GitHub）…' -ForegroundColor DarkGray
& $git push -u origin $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '  推送失败。常见原因：' -ForegroundColor Red
    Write-Host '    · 仓库地址写错，或还没在网页上建好仓库'
    Write-Host '    · 登录失败 —— 重跑一次，或在「凭据管理器」里删掉 github 的旧凭据'
    exit 1
}

if ($Repo -match 'github\.com[:/]+([^/]+)/([^/]+?)(\.git)?/?$') {
    $user = $Matches[1]; $repo = $Matches[2]
    Write-Host ''
    Write-Host '  推送完成！' -ForegroundColor Green
    Write-Host ''
    Write-Host '  最后一步（只做一次）：' -ForegroundColor Yellow
    Write-Host "    打开 https://github.com/$user/$repo/settings/pages"
    Write-Host '    Source 选 Deploy from a branch → 分支 main、目录 / (root) → Save'
    Write-Host ''
    Write-Host '  等 1 分钟后，手机访问：' -ForegroundColor Green
    Write-Host "    https://$user.github.io/$repo/" -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  手机浏览器打开这个网址，用「添加到主屏幕 / 安装应用」装成 App。'
} else {
    Write-Host '  推送完成。去仓库设置里开启 Pages 即可。' -ForegroundColor Green
}
