# -*- coding: utf-8 -*-
"""学习路径：章节可折叠，默认只展开当前章"""
import io

P = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
s = io.open(P, encoding="utf-8").read()

# 1) 计算默认展开的章节
old_head = """  let html = '';
  for (let c = 0; c < chapters; c++) {"""
new_head = """  // 默认只展开"当前进度所在"的那一章
  const firstUndone = pathInfos.findIndex(i => !i.done);
  const curChapter = firstUndone < 0 ? chapters - 1 : Math.floor(firstUndone / NODES_PER_CHAPTER);
  if (!openChapters.size) openChapters.add(curChapter);

  let html = '';
  for (let c = 0; c < chapters; c++) {"""
if old_head in s:
    s = s.replace(old_head, new_head, 1)
    print("default chapter ok")
else:
    print("WARN head")

# 2) section 加开合状态 + 头部改成可点击
old_sec = """    html += `<section class="chapter">
      <header class="chapter-head" style="--sky1:${country.sky[0]};--sky2:${country.sky[1]};background-image:${country.img ? `url('data/countries/${country.img}.jpg')` : sceneURL(country, c)}">
        <h3>${countryFlag(country.name)}${country.name}</h3>
        <p>${country.tag} · 第 ${c + 1} 章 · ${lc}/${sc} 词</p>
        <div class="ch-emoji">${country.emoji}</div>
        <div class="ch-progress"><i style="width:${pct.toFixed(1)}%"></i></div>
      </header>
      <div class="chapter-body" style="height:${(e - s) * 92}px">`;"""
new_sec = """    const isOpen = openChapters.has(c);
    const doneNodes = pathInfos.slice(s, e).filter(i => i.done).length;
    html += `<section class="chapter ${isOpen ? 'is-open' : ''}" data-ch="${c}">
      <header class="chapter-head" role="button" tabindex="0" style="--sky1:${country.sky[0]};--sky2:${country.sky[1]};background-image:${country.img ? `url('data/countries/${country.img}.jpg')` : sceneURL(country, c)}">
        <h3>${countryFlag(country.name)}${country.name}</h3>
        <p>${country.tag} · 第 ${c + 1} 章 · ${lc}/${sc} 词</p>
        <div class="ch-emoji">${country.emoji}</div>
        <div class="ch-progress"><i style="width:${pct.toFixed(1)}%"></i></div>
        <span class="ch-meta">${doneNodes}/${e - s} 关</span>
        <span class="ch-caret" aria-hidden="true">›</span>
      </header>
      <div class="chapter-body" style="height:${(e - s) * 92}px">`;"""
if old_sec in s:
    s = s.replace(old_sec, new_sec, 1)
    print("section ok")
else:
    print("WARN section")

# 3) 渲染后绑定折叠
old_tail = """    html += '</div></section>';
  }
  wrap.innerHTML = html;
}"""
new_tail = """    html += '</div></section>';
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll('.chapter-head').forEach(h => {
    h.onclick = () => {
      const sec = h.parentElement;
      const c = Number(sec.dataset.ch);
      const open = !sec.classList.contains('is-open');
      sec.classList.toggle('is-open', open);
      if (open) openChapters.add(c); else openChapters.delete(c);
    };
  });

  // 当前章滚动到视野内
  const cur = wrap.querySelector('.chapter.is-open');
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
}"""
if old_tail in s:
    s = s.replace(old_tail, new_tail, 1)
    print("bind ok")
else:
    print("WARN tail")

# 4) 全局状态
if "let openChapters" not in s:
    s = s.replace("function renderPath() {", "let openChapters = new Set();\n\nfunction renderPath() {", 1)
    print("state added")

io.open(P, "w", encoding="utf-8").write(s)
