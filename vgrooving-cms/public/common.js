/* V槽 CMS 多语言前台公共逻辑（首页 / 产品详情 / 联系页 共用） */
(function (global) {
  const VG = { content: {}, lang: 'zh', L: {} };
  global.VG = VG;

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }
  // markup: 换行 -> <br>，*高亮* -> <span>高亮</span>
  function markup(str) {
    let s = esc(str).replace(/\n/g, '<br>');
    s = s.replace(/\*([^*]+)\*/g, '<span>$1</span>');
    return s;
  }

  function langCodes() { return (VG.content.langs || []).map((l) => l.code); }
  function defaultLang() { return VG.content.defaultLang || 'zh'; }

  // 从 URL 解析语言与页面类型
  function parsePath() {
    const segs = location.pathname.split('/').filter(Boolean).map((s) => s.replace(/\.html?$/i, ''));
    let lang = defaultLang();
    let i = 0;
    if (segs[0] && langCodes().includes(segs[0]) && segs[0] !== defaultLang()) { lang = segs[0]; i = 1; }
    let type = 'home', slug = '';
    if (segs[i] === 'products' && segs[i + 1]) { type = 'product'; slug = segs[i + 1]; }
    else if (segs[i] === 'contact') { type = 'contact'; }
    else if (segs[i] === 'index' || segs[i] === undefined) { type = 'home'; }
    return { lang, type, slug };
  }

  function prefix(lang) { return lang === defaultLang() ? '' : '/' + lang; }
  function homeHref(lang) { return prefix(lang) + '/'; }
  function productHref(lang, slug) { return prefix(lang) + '/products/' + encodeURIComponent(slug); }
  function contactHref(lang) { return prefix(lang) + '/contact'; }
  // 页内锚点：非首页时回到当前语言首页再锚定
  function anchorHref(lang, href, isHome) {
    if (href && href.charAt(0) === '#') return isHome ? href : homeHref(lang) + href;
    return href;
  }

  function firstMedia(p) {
    if (p.gallery && p.gallery.length) return p.gallery[0];
    if (p.cardImage) return { type: 'image', src: p.cardImage, alt: p.name };
    return null;
  }
  function cardMedia(p) {
    if (p.cardImage) return { type: 'image', src: p.cardImage, alt: p.name };
    return firstMedia(p);
  }
  function mediaHtml(m) {
    if (!m) return '<img src="/assets/logo.png" alt="" style="object-fit:contain;padding:2rem;opacity:.4">';
    if (m.type === 'video') return '<video src="' + esc(m.src) + '" muted loop playsinline></video><div class="play-icon">▶</div>';
    return '<img src="' + esc(m.src) + '" alt="' + esc(m.alt || '') + '"><div class="play-icon" style="opacity:0">▶</div>';
  }

  function productCard(p, top) {
    const m = cardMedia(p);
    return (
      '<a class="rp-card' + (top ? ' top-pick' : '') + '" href="' + productHref(VG.lang, p.slug || p.id) + '">' +
      '<div class="rp-card-img">' + mediaHtml(m) + '</div>' +
      '<div class="rp-badge">' + esc(p.badge || '') + '</div>' +
      '<div class="rp-name">' + esc(p.name) + '</div>' +
      '<div class="rp-desc">' + esc(p.cardDesc || p.subtitle || '') + '</div>' +
      '<div class="rp-tags">' + (p.cardTags || p.tags || []).map((t) => '<span class="rp-tag">' + esc(t) + '</span>').join('') + '</div>' +
      '<button class="rp-link">' + esc((VG.L.ui && VG.L.ui.viewDetails) || '查看详情 →') + '</button></a>'
    );
  }

  // ---------- 导航 ----------
  function renderNav(isHome) {
    const nav = document.getElementById('siteNav');
    if (!nav) return;
    const L = VG.L;
    const brand = VG.content.brand || {};
    const logo =
      '<a href="' + homeHref(VG.lang) + '" class="logo">' +
      (brand.logo ? '<img src="' + esc(brand.logo) + '" alt="' + esc(L.brandName || '') + '">' : esc(L.brandName || '')) +
      '</a>';
    const links = ((L.nav && L.nav.links) || [])
      .map((l) => {
        if (/在线|inquiry|consulta|문의|استفسار|danışma|online/i.test(l.label) && (l.href === '#' || !l.href)) {
          return '<li><a href="#" data-open-chat="1">' + esc(l.label) + '</a></li>';
        }
        return '<li><a href="' + esc(anchorHref(VG.lang, l.href, isHome)) + '">' + esc(l.label) + '</a></li>';
      })
      .join('');
    const cta = (L.nav && L.nav.cta) || '';
    // 语言切换
    const page = parsePath();
    const opts = (VG.content.langs || [])
      .map((lg) => {
        let url;
        if (page.type === 'product') url = productHref(lg.code, page.slug);
        else if (page.type === 'contact') url = contactHref(lg.code);
        else url = homeHref(lg.code);
        return '<option value="' + url + '"' + (lg.code === VG.lang ? ' selected' : '') + '>' + esc(lg.label) + '</option>';
      })
      .join('');
    nav.innerHTML =
      logo +
      '<ul class="nav-links">' + links + '</ul>' +
      '<button class="nav-search" title="搜索" type="button">🔍</button>' +
      '<button class="nav-btn" type="button" data-open-chat="1">' + esc(cta) + '</button>' +
      '<div class="lang-switcher"><select onchange="location.href=this.value">' + opts + '</select></div>';
    const searchBtn = nav.querySelector('.nav-search');
    if (searchBtn) searchBtn.addEventListener('click', function () { global.VGsearchOpen(); });
    nav.querySelectorAll('[data-open-chat]').forEach(function (el) {
      el.addEventListener('click', function (ev) { global.openChat(ev); });
    });
  }

  // ---------- 前台搜索 ----------
  const SEARCH_PH = { zh: '搜索产品…', en: 'Search products…', es: 'Buscar productos…', ko: '제품 검색…', ar: 'ابحث عن المنتجات…', tr: 'Ürün ara…' };
  function ensureSearch() {
    if (document.getElementById('vgSearch')) return;
    const el = document.createElement('div');
    el.className = 'search-mask'; el.id = 'vgSearch';
    el.innerHTML = '<div class="search-box"><input id="vgSearchInput" placeholder="' + esc(SEARCH_PH[VG.lang] || SEARCH_PH.en) + '"><div class="search-results" id="vgSearchResults"></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.id === 'vgSearch') VGsearchClose(); });
    const inp = el.querySelector('#vgSearchInput');
    inp.addEventListener('input', () => runSearch(inp.value));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') VGsearchClose(); });
  }
  function runSearch(q) {
    const box = document.getElementById('vgSearchResults');
    q = String(q || '').trim().toLowerCase();
    const products = VG.L.products || [];
    if (!q) { box.innerHTML = ''; return; }
    const hay = (p) => [p.name, p.cardDesc, p.subtitle, (p.tags || []).join(' '), (p.cardTags || []).join(' '), (p.specs || []).map((s) => s.k + ' ' + s.v).join(' ')].join(' ').toLowerCase();
    const hits = products.filter((p) => hay(p).indexOf(q) > -1).slice(0, 12);
    if (!hits.length) { box.innerHTML = '<div class="search-empty">未找到相关产品 / No results</div>'; return; }
    box.innerHTML = hits.map((p) => {
      const m = cardMedia(p);
      const img = m ? (m.type === 'video' ? '<video src="' + esc(m.src) + '" muted></video>' : '<img src="' + esc(m.src) + '">') : '';
      return '<a class="search-item" href="' + productHref(VG.lang, p.slug || p.id) + '"><div class="si-thumb">' + img + '</div><div><div class="si-name">' + esc(p.name) + '</div><div class="si-desc">' + esc(p.cardDesc || p.subtitle || '') + '</div></div></a>';
    }).join('');
  }
  global.VGsearchOpen = function () { ensureSearch(); const m = document.getElementById('vgSearch'); m.classList.add('open'); setTimeout(() => { const i = document.getElementById('vgSearchInput'); if (i) i.focus(); }, 50); };
  global.VGsearchClose = function () { const m = document.getElementById('vgSearch'); if (m) m.classList.remove('open'); };

  function renderFooter() {
    const el = document.getElementById('siteFooter');
    if (!el) return;
    const brand = VG.content.brand || {};
    el.innerHTML =
      '<div class="logo">' + (brand.logo ? '<img src="' + esc(brand.logo) + '" alt="">' : '') + '</div>' +
      '<p>' + esc((VG.L.footer && VG.L.footer.copyright) || '') + '</p>';
  }

  // ---------- 在线客服（自动回复 + 上报后台聊天记录） ----------
  let chatSessionId = '';
  let chatLog = []; // { role, text, time }
  function getChatSessionId() {
    try {
      chatSessionId = sessionStorage.getItem('vg_chat_sid') || '';
      if (!chatSessionId) {
        chatSessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem('vg_chat_sid', chatSessionId);
      }
    } catch (e) {
      if (!chatSessionId) chatSessionId = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }
    return chatSessionId;
  }
  function reportChat(extraMsgs) {
    const append = Array.isArray(extraMsgs) ? extraMsgs : [];
    if (!append.length) return;
    const sid = getChatSessionId();
    try {
      fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid, append: true, messages: append,
          lang: VG.lang, page: location.pathname + location.search,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) { /* ignore */ }
  }
  function renderChat() {
    const chat = VG.L.chat || {};
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cwAva', chat.avatar || '客');
    set('cwName', chat.agentName || '');
    set('cwStatus', chat.status || '');
    const msgs = document.getElementById('chatMsgs');
    chatLog = [];
    if (msgs) {
      msgs.innerHTML = '<div class="cm a"><div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble">' + esc(chat.greeting || '') + '</div></div>';
      if (chat.greeting) chatLog.push({ role: 'agent', text: String(chat.greeting), time: Date.now() });
    }
    const chips = document.getElementById('chatChips');
    if (chips) {
      chips.innerHTML = (chat.quickChips || []).map((c) => '<div class="cq" data-q="' + esc(c) + '">' + esc(c) + '</div>').join('');
      chips.querySelectorAll('.cq').forEach((el) => el.addEventListener('click', () => cqSend(el.dataset.q)));
    }
  }
  function autoReplyLocal(text) {
    const chat = VG.L.chat || {};
    const t = String(text).toLowerCase();
    const hit = (chat.replies || []).find((r) => (r.keywords || []).some((k) => k && t.indexOf(String(k).toLowerCase()) > -1));
    return hit ? hit.text : (chat.fallback || chat.greeting || '');
  }
  function fetchReply(text) {
    const history = chatLog.slice(-8).map(function (m) { return { role: m.role, text: m.text }; });
    return fetch('/api/chat/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, lang: VG.lang, page: location.pathname, history: history }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.text) return String(j.text);
      return autoReplyLocal(text);
    }).catch(function () { return autoReplyLocal(text); });
  }
  // 客服开关：点外部关闭必须延后绑定，否则「获取实时报价」等同一次 click 会立刻把窗口关掉
  let outsideCloseHandler = null;
  function closeChat() {
    const win = document.getElementById('chatWindow');
    const fab = document.getElementById('chatFab');
    if (win) win.classList.remove('open');
    if (fab) { fab.textContent = '💬'; fab.style.background = ''; }
    if (outsideCloseHandler) {
      document.removeEventListener('click', outsideCloseHandler, true);
      outsideCloseHandler = null;
    }
  }
  function bindOutsideClose() {
    if (outsideCloseHandler) {
      document.removeEventListener('click', outsideCloseHandler, true);
      outsideCloseHandler = null;
    }
    outsideCloseHandler = function (e) {
      const win = document.getElementById('chatWindow');
      const fab = document.getElementById('chatFab');
      if (!win || !fab || !win.classList.contains('open')) return;
      if (win.contains(e.target) || fab.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('[data-open-chat]')) return;
      closeChat();
    };
    setTimeout(function () {
      if (outsideCloseHandler) document.addEventListener('click', outsideCloseHandler, true);
    }, 0);
  }
  global.closeChat = closeChat;
  global.openChat = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const win = document.getElementById('chatWindow');
    const fab = document.getElementById('chatFab');
    if (!win || !fab) return;
    const isOpen = win.classList.contains('open');
    const fromFab = !!(e && e.target && fab.contains(e.target));
    if (isOpen && fromFab) { closeChat(); return; }
    if (isOpen) return; // CTA 等：已打开则保持
    win.classList.add('open');
    fab.textContent = '🛑'; fab.style.background = '#E60012';
    getChatSessionId();
    bindOutsideClose();
    setTimeout(function () { const i = document.getElementById('cInp'); if (i) i.focus(); }, 200);
  };
  global.cSend = function () {
    const inp = document.getElementById('cInp');
    if (!inp || !inp.value.trim()) return;
    cqSend(inp.value.trim());
    inp.value = ''; inp.style.height = 'auto';
  };
  function cqSend(text) {
    const msgs = document.getElementById('chatMsgs');
    if (!msgs) return;
    const chat = VG.L.chat || {};
    const now = Date.now();
    const u = document.createElement('div');
    u.className = 'cm u';
    u.innerHTML = '<div class="cm-av">🧑</div><div class="cm-bubble">' + esc(text) + '</div>';
    msgs.appendChild(u); msgs.scrollTop = msgs.scrollHeight;
    const userMsg = { role: 'user', text: String(text), time: now };
    // 同一浏览器会话仅首次上报问候语，避免刷新页面后重复追加
    let withGreeting = [];
    try {
      const sid = getChatSessionId();
      if (sessionStorage.getItem('vg_chat_greet') !== sid && chatLog.length === 1 && chatLog[0].role === 'agent') {
        withGreeting = chatLog.slice();
        sessionStorage.setItem('vg_chat_greet', sid);
      }
    } catch (e) {
      if (chatLog.length === 1 && chatLog[0].role === 'agent') withGreeting = chatLog.slice();
    }
    chatLog.push(userMsg);
    const typing = document.createElement('div');
    typing.className = 'cm a';
    typing.dataset.typing = '1';
    typing.innerHTML = '<div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble" style="opacity:.7">正在输入…</div>';
    msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    fetchReply(text).then(function (replyText) {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      const a = document.createElement('div');
      a.className = 'cm a';
      a.innerHTML = '<div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble">' + esc(replyText) + '</div>';
      msgs.appendChild(a); msgs.scrollTop = msgs.scrollHeight;
      const agentMsg = { role: 'agent', text: String(replyText), time: Date.now() };
      chatLog.push(agentMsg);
      reportChat(withGreeting.concat([userMsg, agentMsg]));
    });
  }
  global.cqSend = cqSend;

  // ---------- 页面外框 ----------
  function initChrome(isHome) {
    const langMeta = (VG.content.langs || []).find((l) => l.code === VG.lang) || {};
    document.documentElement.lang = VG.lang === 'zh' ? 'zh-CN' : VG.lang;
    document.documentElement.dir = langMeta.dir || 'ltr';
    renderNav(isHome);
    renderFooter();
    renderChat();
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }), { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
      document.querySelectorAll('.fade-up').forEach((el) => obs.observe(el));
    } else document.querySelectorAll('.fade-up').forEach((el) => el.classList.add('in'));
    const inp = document.getElementById('cInp');
    if (inp && !inp.dataset.vgBound) {
      inp.dataset.vgBound = '1';
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); global.cSend(); } });
    }
    const fab = document.getElementById('chatFab');
    if (fab && !fab.dataset.vgBound) {
      fab.dataset.vgBound = '1';
      fab.removeAttribute('onclick');
      fab.addEventListener('click', function (ev) { global.openChat(ev); });
    }
    const nav = document.querySelector('nav');
    if (nav && !nav.dataset.vgScroll) {
      nav.dataset.vgScroll = '1';
      window.addEventListener('scroll', () => { nav.style.boxShadow = window.scrollY > 80 ? '0 2px 20px rgba(0,0,0,0.15)' : ''; }, { passive: true });
    }
  }

  // 载入内容后设置当前语言
  function boot(cb) {
    fetch('/api/content').then((r) => r.json()).then((content) => {
      VG.content = content || {};
      const info = parsePath();
      VG.lang = info.lang;
      VG.L = (content.i18n && content.i18n[VG.lang]) || {};
      if (VG.L.meta && VG.L.meta.title) document.title = VG.L.meta.title;
      cb(info);
    }).catch((e) => { console.error(e); });
  }

  global.VGCommon = { esc, markup, firstMedia, cardMedia, mediaHtml, productCard, initChrome, boot, parsePath, prefix, homeHref, productHref, contactHref };
})(window);
