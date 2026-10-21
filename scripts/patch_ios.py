# -*- coding: utf-8 -*-
"""iOS 适配补丁：视口高度、安全区、滚动锁定、语音解锁、前缀、输入缩放"""
import io, re, os

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
CSS = os.path.join(BASE, "css", "theme.css")
JS = os.path.join(BASE, "js", "app.js")
HTML = os.path.join(BASE, "index.html")

# ============ 1. CSS: 给 backdrop-filter 补 -webkit- 前缀 ============
css = io.open(CSS, encoding="utf-8").read()
lines = css.split("\n")
fixed = 0
for i, ln in enumerate(lines):
    if "backdrop-filter" in ln and "-webkit-backdrop-filter" not in ln:
        # 形如 "  backdrop-filter:blur(14px);" -> 前面补一行
        m = re.search(r"(\s*)backdrop-filter\s*:\s*([^;]+);?", ln)
        if m:
            decl = f"{m.group(1)}-webkit-backdrop-filter:{m.group(2).strip().rstrip(';')};"
            lines[i] = ln.replace(m.group(0), decl + " " + m.group(0).strip(), 1)
            fixed += 1
css = "\n".join(lines)
print("backdrop 前缀补齐:", fixed)

# ============ 2. CSS: iOS 专项 ============
IOS = """

/* ==========================================================================
   v68 · iOS Safari 适配
   ========================================================================== */
/* 全局：去掉点击高亮、消 300ms 延迟、禁双击缩放 */
*{ -webkit-tap-highlight-color:transparent; }
html{ -webkit-text-size-adjust:100%; text-size-adjust:100%; }
button,a,[role="button"],.tab,.node,.book-card,.rv-item{
  touch-action:manipulation;
}
/* 拖拽手柄：不让浏览器接管手势 */
#sheetHandle,.sheet-handle,.drag-handle{ touch-action:none; }

/* 浮层/会话用实测高度，避免 iOS 工具栏导致 100vh 溢出 */
#session,.overlay{ height:var(--app-h,100vh) !important; }

/* iOS 弹性滚动 */
#screen-learn,#screen-books,#screen-review,#screen-pet,#screen-settings,
.path-wrap,.rv-detail-list,.sheet,.book-grid{
  -webkit-overflow-scrolling:touch;
}

/* 输入框字号 >=16px，防止聚焦自动放大 */
input,textarea,select{ font-size:16px !important; }

/* 安全区：底部 tab / 悬浮按钮 */
#tabbar{ padding-bottom:calc(env(safe-area-inset-bottom,0px) + 2px) !important; }

/* 刘海/灵动岛：顶部栏不出界 */
#topbar{ padding-top:calc(env(safe-area-inset-top,0px) + 6px) !important; }

/* iOS 单独：修正 100dvh 在老版本上的回退 */
@supports not (height: 100dvh){
  .screen{ height:var(--app-h,100vh) !important; }
}

/* 录音/语音按钮在 iOS 上更稳 */
@supports (-webkit-touch-callout: none){
  .btn,.tab,.node{-webkit-user-select:none;user-select:none}
  /* 让卡片、列表滚动更顺滑 */
  .sess-body{ overscroll-behavior:contain; }
}
"""
if "v68 · iOS Safari 适配" not in css:
    css += IOS
    print("iOS CSS 注入")

io.open(CSS, "w", encoding="utf-8").write(css)

# ============ 3. JS: 视口高度 / 语音解锁 / 滚动锁定 ============
js = io.open(JS, encoding="utf-8").read()

old_sync = """function syncAppHeight() {
  const h = window.innerHeight || document.documentElement.clientHeight || 800;
  document.documentElement.style.setProperty('--app-h', h + 'px');
}"""
new_sync = """function syncAppHeight() {
  // iOS Safari：visualViewport 更准（工具栏收起/展开）
  const vv = window.visualViewport;
  let h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 800;
  // 极小的值通常是键盘弹起，忽略，避免布局塌陷
  if (h < 320) h = window.innerHeight || 800;
  document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  document.documentElement.style.setProperty('--app-hh', (h / 2) + 'px');
}"""
if old_sync in js:
    js = js.replace(old_sync, new_sync, 1)
    print("syncAppHeight 升级")

# 事件监听：visualViewport / orientationchange
old_bind = "  window.addEventListener('resize', function(){ syncAppHeight(); syncScene(); });"
new_bind = """  window.addEventListener('resize', function(){ syncAppHeight(); syncScene(); });
  window.addEventListener('orientationchange', function(){
    setTimeout(function(){ syncAppHeight(); syncScene(); }, 320);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function(){ syncAppHeight(); });
    window.visualViewport.addEventListener('scroll', function(){ syncAppHeight(); });
  }"""
if old_bind in js and 'visualViewport.addEventListener' not in js:
    js = js.replace(old_bind, new_bind, 1)
    print("视口事件绑定")

# iOS 语音解锁：首次触摸时热身一次
if "iOS speech unlock" not in js:
    unlock = """
/* iOS speech unlock：首次触摸时热身，之后 speechSynthesis 才可用 */
(function () {
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      if ('speechSynthesis' in window) {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; u.rate = 10;
        window.speechSynthesis.speak(u);
        window.speechSynthesis.cancel();
      }
    } catch (e) { }
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('touchend', unlock, true);
    document.removeEventListener('click', unlock, true);
  }
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('touchend', unlock, true);
  document.addEventListener('click', unlock, true);
})();
"""
    js = js.rstrip() + "\n" + unlock
    print("语音解锁注入")

io.open(JS, "w", encoding="utf-8").write(js)

# ============ 4. HTML: 防电话识别 + 状态栏 ============
html = io.open(HTML, encoding="utf-8").read()
if 'format-detection' not in html:
    html = html.replace('<meta name="viewport"',
        '<meta name="format-detection" content="telephone=no,email=no,address=no">\n<meta name="viewport"', 1)
    print("format-detection 注入")
if 'apple-mobile-web-app-status-bar-style' in html and 'black-translucent' not in html:
    print("状态栏样式已存在其他值")
io.open(HTML, "w", encoding="utf-8").write(html)

print("done")
