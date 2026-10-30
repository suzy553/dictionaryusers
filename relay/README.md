# 讯飞评测签名服务（国内云函数）

浏览器直连讯飞，密钥只放在云函数的环境变量里。**录音不经过国外任何服务器**。

```
浏览器 ──GET 函数 URL──▶ 云函数（HMAC 签名，几十毫秒）──▶ 返回 5 分钟有效的 wss 地址
   │
   └──────────── wss 直连 ────────────▶ ise-api.xfyun.cn（讯飞，国内）
```

- 云函数只算一个 HMAC，**不需要 WebSocket、不需要备案**，用云厂商的默认域名即可
- 一次评测只调用一次函数，免费额度足够个人用

> ⚠️ 腾讯云的 **API 网关已于 2025-06-30 下线**，云函数也不再支持「API 网关触发器」。
> 现在用 **函数 URL**（免费的 HTTPS 入口），下文就是按这个写的。

---

## 一、部署（腾讯云 SCF + 函数 URL）

### 1. 准备

- 腾讯云完成实名认证
- 讯飞的 `APPID` / `APIKey` / `APISecret`（讯飞控制台 → 我的应用 → 语音评测 → 服务接口认证信息）

### 2. 打包

双击本目录的 **`打包上传.bat`**，生成 `relay.zip`（里面是 `sign.js` + `package.json`，在压缩包根目录）。

### 3. 新建函数

控制台：<https://console.cloud.tencent.com/scf> → 左侧「函数服务」→「新建」

1. 顶部三张卡片选 **「从头开始」**（不要选「模板创建」，那些是 Web 框架模板）
2. 函数类型：**事件函数**
3. 函数名称：`ise-sign`
4. 地域：上海 / 广州 / 北京都行（记一下，URL 里会带地域）
5. 运行环境：**Node.js 18**
6. 提交方法：**本地上传 zip 包** → 选刚生成的 `relay.zip`
7. **执行方法**：改成 `sign.main_handler`
8. 高级配置：
   - 内存：128MB
   - 超时时间：10 秒
   - 环境变量：

| 变量名 | 值 |
|---|---|
| `XF_APPID` | 你的讯飞 APPID |
| `XF_APIKEY` | 你的讯飞 APIKey |
| `XF_APISECRET` | 你的讯飞 APISecret |
| `ALLOW_ORIGIN` | `https://suzy553.github.io` |
| `RATE_LIMIT` | `60`（每个 IP 每分钟最多 60 次，可改） |

9. 点「完成」，等函数创建好

### 4. 开启函数 URL（对外网址）

1. 点进刚建好的函数
2. 左侧菜单 **「函数 URL」** → **「新建函数 URL」**
3. 配置：
   - 版本/别名：`$LATEST`
   - 公网访问：**开启**
   - 授权类型：**开放**（选 CAM 鉴权浏览器会 403）
   - CORS：**关闭**（函数自己会返回跨域头，开了会重复）
4. 确定后得到地址，形如：

```
https://1250000000-abcdefgh.sh.tencentscf.com
```

### 5. 验证

浏览器直接打开这个地址，应该看到：

```json
{"url":"wss://ise-api.xfyun.cn/v2/open-ise?authorization=...","app_id":"...","expires_in":300}
```

- 看到 `url` → 成功
- 返回 403 / 鉴权失败 → 第 4 步授权类型没选「开放」
- `{"error":"服务端未配置环境变量..."}` → 第 3 步环境变量没保存或拼错
- `{"error":"来源不允许..."}` → `ALLOW_ORIGIN` 和网页地址不一致（不要带结尾斜杠）
- 500 且提示 `sign is not defined` → 执行方法没改成 `sign.main_handler`

### 6. 填进 App

App → 设置 → **语音评测服务地址** → 粘贴那个 `https://...tencentscf.com` → 保存 → 去跟读页试一句。

> 地址要以 `https://` 开头。填 `wss://` 会走旧的 Cloudflare 代理模式。

---

## 二、本地自测（可选）

```powershell
cd relay
copy .env.example .env      # 填入真实密钥
node sign.js                # 启动在 http://127.0.0.1:8787/sign
```

另开一个窗口：

```powershell
curl http://127.0.0.1:8787/sign
```

单元测试（不需要真实密钥）：

```powershell
node test/sign.test.js
```

> 本地 http 地址不能直接填进线上网页：GitHub Pages 是 https，浏览器会拦混合内容。
> 本地只用于验证接口本身。

---

## 三、换成阿里云函数计算（FC）

`sign.js` 与平台无关，FC 的 HTTP 函数事件里同样有 `httpMethod`、`headers`、`queryStringParameters`，
入口用 `sign.main_handler` 即可；FC 若要求返回 `isBase64Encoded`，返回值里已经带上了。

---

## 四、费用与安全

- 函数 URL：**不收费**
- SCF：每月 100 万次调用 + 40 万 GBs 免费额度（以官网为准），签名函数每次几十毫秒，个人用不完
- 这个接口相当于「签名发放机」：拿到签名的人可以消耗你的讯飞额度
  - 已内置按 IP 限流（`RATE_LIMIT`）
  - `ALLOW_ORIGIN` 只能挡住浏览器，挡不住 curl
  - 如果担心，可以改小 `RATE_LIMIT`，或定期换函数 URL

## 五、常见错误

| 现象 | 原因 |
|---|---|
| 浏览器控制台 `CORS` 报错 | `ALLOW_ORIGIN` 和网页地址不一致；或函数 URL 里开了 CORS 导致重复头 |
| 打开 URL 返回 403 / 鉴权失败 | 函数 URL 的授权类型不是「开放」 |
| `讯飞返回错误：HMAC signature cannot be verified` | APIKey / APISecret 不配对，或服务器时间偏差超过 5 分钟 |
| `讯飞返回错误：invalid appid` | `XF_APPID` 填错，或和 APIKey 不属于同一个应用 |
| `签名服务 429` | 触发限流，调大 `RATE_LIMIT` 或稍后再试 |
| `签名服务连不上` | 地址写错，或函数 URL 没开启公网访问 |

---

## 六、更新网页 / 回退

这次改动动到了 `index.html`、`js/ise.js`、`sw.js`，要提交并推送后 GitHub Pages 才会更新：

```powershell
git add index.html js/ise.js sw.js .gitignore relay
git commit -m "评测改为国内签名服务直连讯飞"
git push
```

想切回旧的 Cloudflare Worker：设置里把地址改回 `wss://xxx.workers.dev/ise` 即可，旧路径还留着。
