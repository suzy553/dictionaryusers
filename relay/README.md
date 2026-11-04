# 讯飞签名服务（腾讯云函数）

浏览器直连讯飞，密钥只放在云函数的环境变量里，**录音不经过国外任何服务器**。

```
浏览器 ──GET /sign?svc=ise|tts|iat──▶ 云函数（HMAC 签名）──▶ 返回 5 分钟有效的 wss 地址
   └──────────────── wss 直连 ────────────────▶ 讯飞（国内）
```

支持三个服务：

| svc | 用途 | 讯飞地址 |
|---|---|---|
| `ise`（默认） | 语音评测 | `ise-api.xfyun.cn/v2/open-ise` |
| `tts` | 语音合成（朗读、听写素材） | `tts-api.xfyun.cn/v2/tts` |
| `iat` | 语音听写（口语转文字） | `iat-api.xfyun.cn/v2/iat` |

> ⚠️ 腾讯云 API 网关已于 2025-06-30 下线，这里用的是 **函数 URL**（免费）。

---

## 一、部署（腾讯云 SCF + 函数 URL）

### 1. 准备

- 腾讯云完成实名认证
- 讯飞的 `APPID` / `APIKey` / `APISecret`

### 2. 打包

双击 **`打包上传.bat`**，生成 `relay.zip`（`sign.js` + `package.json`）。

### 3. 新建函数

<https://console.cloud.tencent.com/scf> → 函数服务 → 新建

1. 选 **「从头开始」**（不要选模板）
2. 函数类型：**事件函数**
3. 名称：`ise-sign`；地域：上海 / 广州 / 北京
4. 运行环境：**Node.js 18**
5. 提交方法：**本地上传 zip 包** → `relay.zip`
6. **执行方法**：`sign.main_handler`
7. 高级配置：内存 128MB、超时 10 秒
8. 环境变量：

| 变量 | 值 |
|---|---|
| `XF_APPID` | 讯飞 APPID |
| `XF_APIKEY` | 讯飞 APIKey |
| `XF_APISECRET` | 讯飞 APISecret |
| `ALLOW_ORIGIN` | `https://suzy553.github.io` |
| `RATE_LIMIT` | `60` |

### 4. 开启函数 URL

函数详情 → 左侧 **「函数 URL」** → 新建：

- 版本：`$LATEST`
- 公网访问：开启
- 授权类型：**开放**
- CORS：**关闭**

得到 `https://xxxx.sh.tencentscf.com`。

### 5. 更新代码（改了 sign.js 之后）

函数详情 → **函数代码** → 「上传 zip 包」→ 选新的 `relay.zip` → 保存。
**不需要**改函数 URL，地址不变。

### 6. 验证

浏览器打开：

```
https://你的函数地址/?svc=ise
https://你的函数地址/?svc=tts
https://你的函数地址/?svc=iat
```

每个都应返回 `{"url":"wss://...", "app_id":"...", "svc":"..."}`。

- 400 `不支持的服务` → 函数代码还是旧版，重新上传 zip
- 403 / 鉴权失败 → 函数 URL 授权类型不是「开放」
- 500 → 环境变量没配好

---

## 二、本地自测

```powershell
cd relay
copy .env.example .env      # 填入真实密钥
node sign.js                # http://127.0.0.1:8787/sign
```

```powershell
node test/check.js          # 11 个用例，不需要真实密钥
```

---

## 三、费用与安全

- 函数 URL：不收费；SCF：每月 100 万次调用免费额度
- 这个接口是「签名发放机」，已被调用方消耗你的讯飞额度
  - 内置按 IP 限流（`RATE_LIMIT`）
  - 只签白名单里的三个服务，不能当万能签名用
  - `ALLOW_ORIGIN` 只能挡浏览器，挡不住 curl

## 四、常见错误

| 现象 | 原因 |
|---|---|
| 浏览器 CORS 报错 | `ALLOW_ORIGIN` 和网页地址不一致，或函数 URL 开了 CORS |
| 打开 URL 403 | 函数 URL 授权类型不是「开放」 |
| `TTS 11200` | 发音人 `xiaoyan` 未开通，去控制台添加发音人 |
| `IAT 11200` | 语音听写服务未开通，或 `en_us` 语种未授权 |
| `签名服务 429` | 触发限流 |
