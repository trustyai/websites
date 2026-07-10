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
          return '<li><a href="#" onclick="openChat();return false;">' + esc(l.label) + '</a></li>';
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
      '<button class="nav-btn" onclick="openChat()">' + esc(cta) + '</button>' +
      '<div class="lang-switcher"><select onchange="location.href=this.value">' + opts + '</select></div>';
  }

  function renderFooter() {
    const el = document.getElementById('siteFooter');
    if (!el) return;
    const brand = VG.content.brand || {};
    el.innerHTML =
      '<div class="logo">' + (brand.logo ? '<img src="' + esc(brand.logo) + '" alt="">' : '') + '</div>' +
      '<p>' + esc((VG.L.footer && VG.L.footer.copyright) || '') + '</p>';
  }

  // ---------- 在线客服 ----------
  function renderChat() {
    const chat = VG.L.chat || {};
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('cwAva', chat.avatar || '客');
    set('cwName', chat.agentName || '');
    set('cwStatus', chat.status || '');
    const msgs = document.getElementById('chatMsgs');
    if (msgs) msgs.innerHTML = '<div class="cm a"><div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble">' + esc(chat.greeting || '') + '</div></div>';
    const chips = document.getElementById('chatChips');
    if (chips) {
      chips.innerHTML = (chat.quickChips || []).map((c) => '<div class="cq" data-q="' + esc(c) + '">' + esc(c) + '</div>').join('');
      chips.querySelectorAll('.cq').forEach((el) => el.addEventListener('click', () => cqSend(el.dataset.q)));
    }
  }
  function autoReply(text) {
    const chat = VG.L.chat || {};
    const t = String(text).toLowerCase();
    const hit = (chat.replies || []).find((r) => (r.keywords || []).some((k) => t.indexOf(String(k).toLowerCase()) > -1));
    return hit ? hit.text : (chat.fallback || chat.greeting || '');
  }
  global.openChat = function () {
    const win = document.getElementById('chatWindow');
    const fab = document.getElementById('chatFab');
    if (!win || !fab) return;
    win.classList.toggle('open');
    if (win.classList.contains('open')) {
      fab.textContent = '🛑'; fab.style.background = '#E60012';
      setTimeout(() => { const i = document.getElementById('cInp'); if (i) i.focus(); }, 200);
    } else { fab.textContent = '💬'; fab.style.background = ''; }
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
    const u = document.createElement('div');
    u.className = 'cm u';
    u.innerHTML = '<div class="cm-av">🧑</div><div class="cm-bubble">' + esc(text) + '</div>';
    msgs.appendChild(u); msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => {
      const a = document.createElement('div');
      a.className = 'cm a';
      a.innerHTML = '<div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble">' + esc(autoReply(text)) + '</div>';
      msgs.appendChild(a); msgs.scrollTop = msgs.scrollHeight;
    }, 600 + Math.random() * 500);
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
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); global.cSend(); } });
    document.addEventListener('click', (e) => {
      const win = document.getElementById('chatWindow'); const fab = document.getElementById('chatFab');
      if (win && fab && win.classList.contains('open') && !win.contains(e.target) && !fab.contains(e.target)) { win.classList.remove('open'); fab.textContent = '💬'; fab.style.background = ''; }
    });
    const nav = document.querySelector('nav');
    if (nav) window.addEventListener('scroll', () => { nav.style.boxShadow = window.scrollY > 80 ? '0 2px 20px rgba(0,0,0,0.15)' : ''; }, { passive: true });
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
