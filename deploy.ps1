# 邻答 · GitHub Pages 一键部署脚本
# 双击运行：自动检查/安装 git → 初始化仓库 → 推送到 GitHub Pages
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$GITHUB_USER = "YITIAN-1234"      # 你的 GitHub 用户名
$REPO_NAME   = "linda"            # 仓库名（可改，须先在 GitHub 网页创建空仓库）

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $base

# ---------- 1. 检查 git ----------
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "未检测到 git，尝试通过 winget 安装…" -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "git 安装失败或未生效，请关闭本窗口重新打开后再运行本脚本。"; pause; exit 1
    }
    Write-Host "git 已安装。首次使用请先关闭本窗口，重新双击运行本脚本。"
    pause; exit 0
}
Write-Host "[1/4] git 版本: $(git --version)" -ForegroundColor Green

# ---------- 2. 确认仓库名 ----------
$answer = Read-Host "仓库名（回车用默认 $REPO_NAME）"
if ($answer.Trim()) { $REPO_NAME = $answer.Trim() }
$remote = "https://github.com/$GITHUB_USER/$REPO_NAME.git"

# ---------- 3. 初始化 ----------
Write-Host "[2/4] 初始化仓库…" -ForegroundColor Green
if (Test-Path .git) {
    Write-Host "已存在 .git，跳过初始化。"
} else {
    git init | Out-Host
}
git add .
git -c user.name="$GITHUB_USER" -c user.email="$GITHUB_USER@users.noreply.github.com" commit -m "邻答 社区物业AI问答 GitHub Pages 版" | Out-Host
git branch -M main
$existing = git remote get-url origin 2>$null
if ($existing) { git remote set-url origin $remote } else { git remote add origin $remote }
Write-Host "[3/4] 已就绪，准备推送 → $remote" -ForegroundColor Green

# ---------- 4. 推送 ----------
Write-Host "[4/4] 推送中…" -ForegroundColor Green
Write-Host ""
Write-Host "  ★ 弹出凭据窗口时：" -ForegroundColor Yellow
Write-Host "    用户名填: $GITHUB_USER" -ForegroundColor Yellow
Write-Host "    密码填:   GitHub Personal Access Token（不是登录密码！）" -ForegroundColor Yellow
Write-Host "    Token 生成: github.com → Settings → Developer settings →"
Write-Host "    Personal access tokens → Generate new token(classic) → 勾选 repo → 复制" -ForegroundColor Yellow
Write-Host ""
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "推送失败，请检查：1) 仓库 $REPO_NAME 已在 GitHub 网页创建（空仓库，不加 README）" -ForegroundColor Red
    Write-Host "              2) Token 权限勾选了 repo" -ForegroundColor Red
    pause; exit 1
}

# ---------- 5. 开启 Pages ----------
Write-Host ""
Write-Host "推送成功！最后一步（网页操作，1 分钟）：" -ForegroundColor Green
Write-Host "  1. 打开 https://github.com/$GITHUB_USER/$REPO_NAME/settings/pages"
Write-Host "  2. Source 选 Deploy from a branch → 分支选 main → 目录选 / (root) → Save"
Write-Host "  3. 等 1-2 分钟，访问 https://$GITHUB_USER.github.io/$REPO_NAME/ 即正常运行"
Write-Host ""
pause
