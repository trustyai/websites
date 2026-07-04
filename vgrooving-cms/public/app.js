/* V槽 CMS 前台渲染 —— 从 /api/content 拉取内容并渲染整站 */
(function () {
  let CONTENT = {};

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  // 标题高亮：第一个空格之后的文字换行并用主题色强调
  function renderTitle(title) {
    const t = String(title || '');
    const i = t.indexOf(' ');
    if (i === -1) return esc(t);
    const head = t.slice(0, i);
    const tail = t.slice(i + 1);
    return esc(head) + '<br><span>' + esc(tail) + '</span>';
  }

  function firstMedia(product) {
    return (product.media && product.media[0]) || null;
  }

  function mediaHtml(m) {
    if (!m) return '<img src="/assets/logo.png" alt="" style="object-fit:contain;padding:2rem;opacity:.4">';
    if (m.type === 'video') {
      return '<video src="' + esc(m.src) + '" muted loop playsinline></video><div class="play-icon">▶</div>';
    }
    return '<img src="' + esc(m.src) + '" alt="' + esc(m.alt || '') + '">';
  }

  // ---------- 渲染各区块 ----------
  function renderBrand(b) {
    const logoHtml =
      (b.logo ? '<img src="' + esc(b.logo) + '" alt="' + esc(b.name) + '">' : '') +
      '<span class="brand-name">' + esc(b.name || '') + '</span>';
    document.getElementById('navLogo').innerHTML = logoHtml;
    document.getElementById('navCta').textContent = b.navCta || '联系我们';
    document.getElementById('navLinks').innerHTML = (b.navLinks || [])
      .map((l) => '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>')
      .join('');
    document.title = (b.name || 'V槽') + ' — 专业开槽设备制造商';
  }

  function renderHero(h) {
    const stats = (h.stats || [])
      .map(
        (s) =>
          '<div class="hstat"><div class="hstat-num">' +
          esc(s.num) +
          '</div><div class="hstat-label">' +
          esc(s.label) +
          '</div></div>'
      )
      .join('');
    document.getElementById('heroContent').innerHTML =
      '<div class="hero-eyebrow">' + esc(h.eyebrow || '') + '</div>' +
      '<h1>' + renderTitle(h.title) + '</h1>' +
      '<p class="hero-sub">' + esc(h.subtitle || '') + '</p>' +
      '<a href="' + esc(h.ctaHref || '#need-section') + '" class="hero-cta">' +
      esc(h.cta || '开始选型') + ' <span class="arrow">→</span></a>' +
      (stats ? '<div class="hero-stat-strip">' + stats + '</div>' : '');
  }

  function renderAdvantages(a) {
    if (!a) return;
    document.getElementById('advHeader').innerHTML =
      '<div class="tag">' + esc(a.tag || '') + '</div>' +
      '<h2>' + renderTitle(a.title) + '</h2>' +
      '<p>' + esc(a.subtitle || '') + '</p>';
    document.getElementById('advGrid').innerHTML = (a.items || [])
      .map(
        (it) =>
          '<div class="adv-card"><div class="adv-ico">' + esc(it.icon || '⭐') + '</div>' +
          '<h3>' + esc(it.title) + '</h3><p>' + esc(it.desc) + '</p></div>'
      )
      .join('');
  }

  function productCard(p, top) {
    const m = firstMedia(p);
    return (
      '<div class="rp-card' + (top ? ' top-pick' : '') + '" data-pid="' + esc(p.id) + '">' +
      '<div class="rp-card-img">' + mediaHtml(m) + '</div>' +
      '<div class="rp-badge">' + esc(p.badge || '') + '</div>' +
      '<div class="rp-name">' + esc(p.name) + '</div>' +
      '<div class="rp-desc">' + esc(p.desc || '') + '</div>' +
      '<div class="rp-tags">' +
      (p.tags || []).map((t) => '<span class="rp-tag">' + esc(t) + '</span>').join('') +
      '</div>' +
      '<button class="rp-link">查看详情 →</button></div>'
    );
  }

  function renderProducts(pr) {
    if (!pr) return;
    document.getElementById('prodHeader').innerHTML =
      '<div class="tag">' + esc(pr.tag || '') + '</div>' +
      '<h2>' + renderTitle(pr.title) + '</h2>' +
      '<p>' + esc(pr.subtitle || '') + '</p>';
    document.getElementById('allProducts').innerHTML = (pr.items || [])
      .map((p) => productCard(p, false))
      .join('');
    bindProductClicks(document.getElementById('allProducts'));
  }

  function renderContact(c) {
    if (!c) return;
    const methods = [];
    if (c.phone) methods.push('<div class="contact-method"><span class="cm-ico">📞</span>' + esc(c.phone) + '</div>');
    if (c.email) methods.push('<div class="contact-method"><span class="cm-ico">✉️</span>' + esc(c.email) + '</div>');
    if (c.wechat) methods.push('<div class="contact-method"><span class="cm-ico">💬</span>微信 ' + esc(c.wechat) + '</div>');
    document.getElementById('contactBox').innerHTML =
      '<div class="contact-inner">' +
      '<div class="tag">' + esc(c.tag || '联系我们') + '</div>' +
      '<h2>' + renderTitle(c.title) + '</h2>' +
      '<p>' + esc(c.subtitle || '') + '</p>' +
      '<div class="contact-methods">' + methods.join('') + '</div>' +
      '<a href="#" class="contact-cta" onclick="openChat();return false;">' +
      esc(c.ctaText || '免费获取报价') + ' →</a>' +
      '</div>';
  }

  function renderFooter(f, b) {
    document.getElementById('siteFooter').innerHTML =
      '<div class="logo">' +
      (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '') +
      '<span class="brand-name">' + esc(b.name || '') + '</span></div>' +
      '<p>' + esc((f && f.copyright) || '') + '</p>';
  }

  // ---------- 产品媒体灯箱 ----------
  function bindProductClicks(container) {
    container.querySelectorAll('.rp-card').forEach((card) => {
      card.addEventListener('click', () => {
        const pid = card.dataset.pid;
        const p = (CONTENT.products && CONTENT.products.items || []).find((x) => x.id === pid);
        if (p) openProductLightbox(p);
      });
    });
  }

  let lbState = { media: [], idx: 0 };
  function openProductLightbox(p) {
    const media = (p.media && p.media.length ? p.media : [firstMedia(p)]).filter(Boolean);
    if (!media.length) return;
    lbState = { media, idx: 0 };
    renderLightbox();
    document.getElementById('lightbox').classList.add('open');
  }
  function renderLightbox() {
    const lb = document.getElementById('lightbox');
    const m = lbState.media[lbState.idx];
    const inner =
      m.type === 'video'
        ? '<video src="' + esc(m.src) + '" controls autoplay></video>'
        : '<img src="' + esc(m.src) + '" alt="' + esc(m.alt || '') + '">';
    const nav =
      lbState.media.length > 1
        ? '<button class="lightbox-close" style="left:20px;right:auto;top:50%;transform:translateY(-50%)" onclick="event.stopPropagation();window.__lbNav(-1)">‹</button>' +
          '<button class="lightbox-close" style="right:20px;top:50%;transform:translateY(-50%)" onclick="event.stopPropagation();window.__lbNav(1)">›</button>'
        : '';
    lb.innerHTML = '<button class="lightbox-close" onclick="window.__lbClose()">✕</button>' + nav + inner;
  }
  window.__lbNav = function (d) {
    lbState.idx = (lbState.idx + d + lbState.media.length) % lbState.media.length;
    renderLightbox();
  };
  window.__lbClose = function () {
    document.getElementById('lightbox').classList.remove('open');
  };
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') window.__lbClose();
  });
  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox');
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') window.__lbClose();
    if (e.key === 'ArrowLeft' && lbState.media.length > 1) window.__lbNav(-1);
    if (e.key === 'ArrowRight' && lbState.media.length > 1) window.__lbNav(1);
  });

  // ---------- 智能选型 ----------
  let sel = { material: null, thickness: null, scale: null, features: [] };

  function bindWizard() {
    document.querySelectorAll('.mat-card').forEach((c) =>
      c.addEventListener('click', () => {
        document.querySelectorAll('.mat-card').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        sel.material = c.dataset.material;
        updateRecommendation();
      })
    );
    document.querySelectorAll('.thick-card').forEach((c) =>
      c.addEventListener('click', () => {
        document.querySelectorAll('.thick-card').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        sel.thickness = c.dataset.thickness;
        updateRecommendation();
      })
    );
    document.querySelectorAll('.scale-card').forEach((c) =>
      c.addEventListener('click', () => {
        document.querySelectorAll('.scale-card').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        sel.scale = c.dataset.scale;
        updateRecommendation();
      })
    );
    document.querySelectorAll('.feat-card').forEach((c) =>
      c.addEventListener('click', () => {
        c.classList.toggle('selected');
        const f = c.dataset.feature;
        if (c.classList.contains('selected')) sel.features.push(f);
        else sel.features = sel.features.filter((x) => x !== f);
        updateRecommendation();
      })
    );
  }

  function updateRecommendation() {
    const box = document.getElementById('resultBox');
    const wrap = document.getElementById('resultProducts');
    const note = document.getElementById('resultNote');
    if (!sel.material || !sel.thickness) {
      box.classList.remove('visible');
      return;
    }
    box.classList.add('visible');
    const products = (CONTENT.products && CONTENT.products.items) || [];
    const notes = [];

    // 依据厚度 / 规模，用产品的 match 标签匹配
    let want = [sel.thickness];
    if (sel.scale) want.push(sel.scale);
    let recs = products.filter((p) => (p.match || []).some((m) => want.includes(m)));

    if (sel.thickness === 'custom') {
      notes.push('您的材料厚度超过 12mm，建议联系我们的技术顾问获取定制方案。');
    }
    if (sel.scale === 'large') {
      notes.push('大批量生产建议选择全自动 / 工业级设备，效率更高。');
    }
    if (!recs.length) recs = products.slice(0, 3);

    // 去重并限制数量
    recs = [...new Map(recs.map((p) => [p.id, p])).values()].slice(0, 4);
    wrap.innerHTML = recs.map((p, i) => productCard(p, i === 0)).join('');
    bindProductClicks(wrap);
    note.innerHTML = notes.map((n) => '<p class="note-text">💡 ' + esc(n) + '</p>').join('');
  }

  // ---------- 聊天 ----------
  function renderChat(chat) {
    if (!chat) return;
    document.getElementById('cwAva').textContent = chat.avatar || '客';
    document.getElementById('cwName').textContent = chat.agentName || '在线客服';
    document.getElementById('cwStatus').textContent = chat.status || '在线';
    document.getElementById('chatMsgs').innerHTML =
      '<div class="cm a"><div class="cm-av">' + esc(chat.avatar || '客') + '</div>' +
      '<div class="cm-bubble">' + esc(chat.greeting || '您好！') + '</div></div>';
    document.getElementById('chatChips').innerHTML = (chat.quickChips || [])
      .map((c) => '<div class="cq" data-q="' + esc(c) + '">' + esc(c) + '</div>')
      .join('');
    document.querySelectorAll('#chatChips .cq').forEach((el) =>
      el.addEventListener('click', () => cqSend(el.dataset.q))
    );
  }

  function autoReply(text) {
    const chat = CONTENT.chat || {};
    const t = String(text).toLowerCase();
    const hit = (chat.replies || []).find((r) => (r.keywords || []).some((k) => t.indexOf(String(k).toLowerCase()) > -1));
    return hit ? hit.text : chat.fallback || '感谢您的咨询，我们会尽快回复您。';
  }

  window.openChat = function () {
    const win = document.getElementById('chatWindow');
    const fab = document.getElementById('chatFab');
    win.classList.toggle('open');
    if (win.classList.contains('open')) {
      fab.textContent = '🛑';
      fab.style.background = 'var(--accent)';
      setTimeout(() => { const i = document.getElementById('cInp'); if (i) i.focus(); }, 200);
    } else {
      fab.textContent = '💬';
      fab.style.background = '';
    }
  };
  window.cSend = function () {
    const inp = document.getElementById('cInp');
    if (!inp || !inp.value.trim()) return;
    cqSend(inp.value.trim());
    inp.value = '';
    inp.style.height = 'auto';
  };
  function cqSend(text) {
    const msgs = document.getElementById('chatMsgs');
    const chat = CONTENT.chat || {};
    const u = document.createElement('div');
    u.className = 'cm u';
    u.innerHTML = '<div class="cm-av">我</div><div class="cm-bubble">' + esc(text) + '</div>';
    msgs.appendChild(u);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => {
      const a = document.createElement('div');
      a.className = 'cm a';
      a.innerHTML = '<div class="cm-av">' + esc(chat.avatar || '客') + '</div><div class="cm-bubble">' + esc(autoReply(text)) + '</div>';
      msgs.appendChild(a);
      msgs.scrollTop = msgs.scrollHeight;
    }, 600 + Math.random() * 500);
  }

  // ---------- 初始化 ----------
  function init(content) {
    CONTENT = content || {};
    if (window.applyTheme) window.applyTheme(CONTENT.theme || 'green');
    renderBrand(CONTENT.brand || {});
    renderHero(CONTENT.hero || {});
    renderAdvantages(CONTENT.advantages);
    renderProducts(CONTENT.products);
    renderContact(CONTENT.contact);
    renderFooter(CONTENT.footer || {}, CONTENT.brand || {});
    renderChat(CONTENT.chat);
    bindWizard();

    // 滚动淡入
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }),
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
      );
      document.querySelectorAll('.fade-up').forEach((el) => obs.observe(el));
    } else {
      document.querySelectorAll('.fade-up').forEach((el) => el.classList.add('in'));
    }

    // Enter 发送
    const inp = document.getElementById('cInp');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.cSend(); } });

    // 点击外部关闭聊天
    document.addEventListener('click', (e) => {
      const win = document.getElementById('chatWindow');
      const fab = document.getElementById('chatFab');
      if (win.classList.contains('open') && !win.contains(e.target) && !fab.contains(e.target)) {
        win.classList.remove('open');
        fab.textContent = '💬';
        fab.style.background = '';
      }
    });

    // 导航滚动阴影
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
      nav.style.boxShadow = window.scrollY > 80 ? '0 2px 20px rgba(0,0,0,0.25)' : '';
    }, { passive: true });
  }

  fetch('/api/content')
    .then((r) => r.json())
    .then(init)
    .catch(() => { document.getElementById('heroContent').innerHTML = '<p style="color:#fff">内容加载失败</p>'; });
})();
