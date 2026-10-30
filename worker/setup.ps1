# 讯飞语音评测 · Worker 一键部署
# 用法：双击 worker\一键部署.bat，或在 PowerShell 里运行：
#   powershell -ExecutionPolicy Bypass -File worker\setup.ps1

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Line { Write-Host ('-' * 56) -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  讯飞语音评测 · Worker 部署向导' -ForegroundColor Cyan
Write-Host '  （密钥只写进 Cloudflare，不会出现在网页里）' -ForegroundColor DarkGray
Line

# ---------- 1. 环境检查 ----------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Host '  ✗ 没找到 Node.js' -ForegroundColor Red
  Write-Host '    请先安装：https://nodejs.org/ （选 LTS 版本）' -ForegroundColor Yellow
  Write-Host ''
  Read-Host '按回车退出'
  exit 1
}
Write-Host ('  ✓ Node.js ' + (& node -v)) -ForegroundColor Green

Set-Location $PSScriptRoot

# ---------- 2. 安装 wrangler ----------
if (-not (Test-Path '.\node_modules\.bin\wrangler.cmd')) {
  Write-Host '  正在安装 wrangler（第一次约需 1 分钟）…' -ForegroundColor Yellow
  & npm install --no-audit --no-fund --silent 2>&1 | Out-Null
}
if (-not (Test-Path '.\node_modules\.bin\wrangler.cmd')) {
  Write-Host '  ✗ wrangler 安装失败，请检查网络' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}
Write-Host '  ✓ wrangler 就绪' -ForegroundColor Green
Line

# ---------- 3. 输入三个密钥 ----------
Write-Host '  请输入讯飞控制台里的三个密钥' -ForegroundColor Cyan
Write-Host '  （控制台 → 我的应用 → 语音评测 → 服务接口认证信息）' -ForegroundColor DarkGray
Write-Host ''

$appid = Read-Host '  APPID'
$apikey = Read-Host '  APIKey'
$apisecret = Read-Host '  APISecret'

if ([string]::IsNullOrWhiteSpace($appid) -or
    [string]::IsNullOrWhiteSpace($apikey) -or
    [string]::IsNullOrWhiteSpace($apisecret)) {
  Write-Host '  ✗ 三个密钥都要填' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}
if ($apikey.Length -ne 32 -or $apisecret.Length -ne 32) {
  Write-Host ('  ! 提示：APIKey/APISecret 一般是 32 位，你填的是 ' + $apikey.Length + ' / ' + $apisecret.Length + ' 位') -ForegroundColor Yellow
  $go = Read-Host '  继续吗？(y/n)'
  if ($go -ne 'y') { exit 1 }
}

Write-Host ''
Write-Host '  ✓ 密钥已读取' -ForegroundColor Green
Line

# ---------- 4. 登录 Cloudflare ----------
Write-Host '  接下来会打开浏览器，请登录 / 注册 Cloudflare（免费）' -ForegroundColor Cyan
Write-Host '  没有账号的话用邮箱注册即可，不需要信用卡' -ForegroundColor DarkGray
Write-Host ''
$cf = Read-Host '  按回车开始登录'
& .\node_modules\.bin\wrangler.cmd login
if ($LASTEXITCODE -ne 0) {
  Write-Host '  ✗ Cloudflare 登录失败' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}
Write-Host '  ✓ 已登录' -ForegroundColor Green
Line

# ---------- 5. 写入密钥 ----------
Write-Host '  正在写入密钥…' -ForegroundColor Yellow

function PutSecret($name, $value) {
  $value | & .\node_modules\.bin\wrangler.cmd secret put $name 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("  ✗ 写入 $name 失败") -ForegroundColor Red
    exit 1
  }
  Write-Host ("  ✓ $name") -ForegroundColor Green
}

PutSecret 'XF_APPID' $appid
PutSecret 'XF_APIKEY' $apikey
PutSecret 'XF_APISECRET' $apisecret
PutSecret 'ALLOW_ORIGIN' 'https://suzy553.github.io'
Line

# ---------- 6. 部署 ----------
Write-Host '  正在部署…' -ForegroundColor Yellow
$out = & .\node_modules\.bin\wrangler.cmd deploy 2>&1 | Out-String
Write-Host $out

$m = [regex]::Match($out, 'https://[a-z0-9\-\.]+\.workers\.dev')
if (-not $m.Success) {
  Write-Host '  ✗ 没拿到部署地址，请把上面的输出截图给开发' -ForegroundColor Red
  Read-Host '按回车退出'
  exit 1
}

$url = $m.Value + '/ise'
$wss = $url -replace '^https://', 'wss://'

Line
Write-Host ''
Write-Host '  ✅ 部署成功！' -ForegroundColor Green
Write-Host ''
Write-Host '  把这个地址填进 App：' -ForegroundColor Cyan
Write-Host '    设置 → 语音评测服务地址' -ForegroundColor DarkGray
Write-Host ''
Write-Host ('    ' + $wss) -ForegroundColor White
Write-Host ''
Write-Host '  已自动复制到剪贴板，直接粘贴即可。' -ForegroundColor DarkGray
Write-Host ''

try { Set-Clipboard -Value $wss } catch { }

Write-Host '  提示：免费额度每天 500 次，够个人练习用。' -ForegroundColor DarkGray
Write-Host ''
Read-Host '按回车退出'
