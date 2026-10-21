# 部署到线上（手机随时可用）

目标：拿到一个 `https://` 网址，手机随时随地打开、能装成桌面 App、断网也能背。

> 为什么必须上线：手机浏览器只允许 **https** 页面「添加到主屏幕 / 安装应用」。`http://192.168.x.x` 这种局域网地址只能临时看看，装不成 App，也没法离线。

---

## 先决条件

| 需要 | 说明 |
|---|---|
| 一个 GitHub 账号 | 免费注册 https://github.com/signup |
| 一个空仓库 | 免费账号要选**公开仓库**（私有仓库的 Pages 要付费） |
| git | 你现在电脑上**还没装**，见下面路线一/二 |

⚠️ 仓库里只有代码和开源词库，没有隐私内容；学习进度存在手机本地，不会传上去。

---

## 路线一：GitHub Desktop（推荐，全程点鼠标）

最适合不想碰命令行的情况。

1. 下载安装 **GitHub Desktop**：https://desktop.github.com/
2. 打开它 → `File → Add local repository…` → 选到本文件夹
3. 它会问「这里还不是仓库，要不要新建」→ 点 **create a repository**
4. 左下角写一句提交信息（比如 `feat: 小越背单词`）→ 点 **Commit to main**
5. 点上方 **Publish repository** → **把「Keep this code private」的勾去掉** → Publish
6. 打开 `https://github.com/你的用户名/仓库名/settings/pages`
   → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)` → **Save**
7. 等 1 分钟，手机访问 `https://你的用户名.github.io/仓库名/`

以后再改代码：GitHub Desktop 里点 **Commit** → **Push origin**，1 分钟后线上自动更新。

---

## 路线二：安装 Git，然后跑脚本

1. 装 Git for Windows：https://git-scm.com/download/win （一路下一步即可）
2. **关掉所有 PowerShell 窗口再重新打开**（让 PATH 生效）
3. 在 GitHub 网页建一个**空仓库**（不要勾 README / .gitignore / license）
4. 在项目目录执行：

   ```powershell
   cd "C:\Users\<你>\...\ielts-bookshelf"
   .\deploy.ps1 -Repo https://github.com/你的用户名/vocab-shelf.git
   ```

5. 按脚本最后打印的地址去开 Pages，然后手机访问

> 脚本会自动找 git（包括 GitHub Desktop 自带的那份），并处理初始化、提交、推送。

---

## 路线三：什么都不装，用网页上传

1. GitHub 新建空仓库
2. 进仓库页面 → **Add file → Upload files**
3. 打开本文件夹，**全选里面的内容**（不是拖整个文件夹）一起拖进浏览器
   - `index.html`、`css/`、`js/`、`data/`、`icons/`、`scripts/`、`README.md` 等
   - ⚠️ `.github` 和 `.gitignore` 是隐藏的，拖不进去，需要手动补
4. 提交
5. 补 `.github/workflows/daily.yml`（只影响每日新闻自动更新）：
   仓库页 → Add file → Create new file → 文件名填 `.github/workflows/daily.yml` → 粘贴内容 → Commit
6. 同样去 Settings → Pages 开启

缺点：以后每次改都要重新拖一遍，容易漏文件。

---

## 路线四：完全不用 GitHub（Netlify Drop）

如果不想注册 GitHub，2 分钟也能拿到 https 网址：

1. 打开 https://app.netlify.com/drop
2. 把**整个 `ielts-bookshelf` 文件夹**拖进去
3. 立刻得到一个 `https://随机名字.netlify.app` 的网址，手机直接用
4. 注册登录后可以「Claim site」把它固定下来，之后在面板里重新部署更新

缺点：更新要手动重传；网址一开始是随机名。适合先试用。

---

## 装到手机桌面

打开 https 网址后：

- **iPhone（Safari）**：底部「分享」→「添加到主屏幕」
- **安卓（Chrome）**：右上角菜单 →「安装应用」/「添加到主屏幕」

装好后点图标即全屏运行，且首次打开后缓存到本地，之后断网也能背。

---

## 每天 7 点提醒

网页做不到后台定时通知，用系统日历（唯一 100% 准时且免费的办法）：

1. App 内 **设置 → 每日提醒** 设成 `07:00`
2. 点「添加每日提醒到系统日历」，下载 `.ics`
3. 用手机打开这个文件 → 添加到日历

---

## 以后怎么更新

| 路线 | 更新方式 |
|---|---|
| 一（GitHub Desktop） | Commit → Push origin |
| 二（脚本） | `git add -A; git commit -m "改了什么"; git push` |
| 三（网页上传） | 重新拖一遍改动的文件 |
| 四（Netlify） | 重新拖整个文件夹 |

推上去后等 1 分钟左右生效。手机端如果没变：下拉刷新，或把 App 删掉重新添加一次（Service Worker 缓存）。

---

## 常见问题

**页面白屏 / 样式全丢？**
检查 Pages 是否选了 `/ (root)`；本项目所有路径都是相对的，支持放在 `/仓库名/` 子路径下（已实测）。

**Pages 里提示 404？**
刚开启需要等 1–3 分钟；确认分支名是 `main` 不是 `master`。

**改了代码手机没变化？**
Service Worker 缓存。彻底关闭 App 再打开；或者 `设置 → 清空所有进度` 旁边的强制刷新（桌面浏览器按 `Ctrl+F5`）。

**私有仓库能用 Pages 吗？**
免费账号不行，需要 GitHub Pro。要么把仓库设为公开，要么用 Cloudflare Pages（免费且支持私有仓库）。
