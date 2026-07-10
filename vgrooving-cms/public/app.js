/* V槽 CMS 首页渲染（多语言） */
(function () {
  const C = window.VGCommon;
  const esc = C.esc;

  function renderHero(h) {
    h = h || {};
    const stats = (h.stats || []).map((s) => '<div class="hstat"><div class="hstat-num">' + esc(s.num) + '</div><div class="hstat-label">' + esc(s.label) + '</div></div>').join('');
    document.getElementById('heroContent').innerHTML =
      '<div class="hero-eyebrow">' + esc(h.eyebrow || '') + '</div>' +
      '<h1>' + C.markup(h.title) + '</h1>' +
      '<p class="hero-sub">' + esc(h.subtitle || '') + '</p>' +
      '<a href="#need-section" class="hero-cta">' + esc(h.cta || '') + ' <span class="arrow">→</span></a>' +
      (stats ? '<div class="hero-stat-strip">' + stats + '</div>' : '');
  }

  function renderWizard(w) {
    w = w || {};
    const mat = (w.materials || []).map((m) => '<div class="mat-card" data-material="' + esc(m.key) + '"><div class="mat-icon">' + esc(m.icon) + '</div><div class="mat-name">' + esc(m.name) + '</div><div class="mat-desc">' + esc(m.desc) + '</div></div>').join('');
    const thick = (w.thickness || []).map((t) => '<div class="thick-card" data-thickness="' + esc(t.key) + '"><div class="thick-ico">' + esc(t.icon) + '</div><div class="thick-info"><h4>' + esc(t.title) + '</h4><p>' + esc(t.desc) + '</p></div></div>').join('');
    const scale = (w.scale || []).map((s) => '<div class="scale-card" data-scale="' + esc(s.key) + '"><div class="scale-ico">' + esc(s.icon) + '</div><div class="scale-info"><h4>' + esc(s.title) + '</h4><p>' + esc(s.desc) + '</p></div></div>').join('');
    const feat = (w.features || []).map((f) => '<div class="feat-card" data-feature="' + esc(f.key) + '"><div class="feat-dot"></div><span>' + esc(f.label) + '</span></div>').join('');
    document.getElementById('needSection').innerHTML =
      '<div class="need-header"><div class="tag">' + esc(w.tag || '') + '</div><h2>' + C.markup(w.title) + '</h2><p>' + esc(w.subtitle || '') + '</p></div>' +
      '<div class="step-label"><div class="num">1</div><div>' + esc(w.step1 || '') + '</div></div><div class="material-grid">' + mat + '</div>' +
      '<div class="step-label"><div class="num">2</div><div>' + esc(w.step2 || '') + '</div></div><div class="thickness-row">' + thick + '</div>' +
      '<div class="step-label"><div class="num">3</div><div>' + esc(w.step3 || '') + '</div></div><div class="scale-row">' + scale + '</div>' +
      '<div class="step-label"><div class="num">4</div><div>' + esc(w.step4 || '') + '</div></div><div class="feature-grid">' + feat + '</div>' +
      '<div class="result-box" id="resultBox"><div class="result-title">' + esc(w.resultTitle || '') + '</div><div class="result-products" id="resultProducts"></div><div class="result-note" id="resultNote"></div></div>';
    bindWizard();
  }

  function renderProducts(ps, items) {
    ps = ps || {};
    document.getElementById('prodHeader').innerHTML =
      '<div class="tag">' + esc(ps.tag || '') + '</div><h2>' + C.markup(ps.title) + '</h2><p>' + esc(ps.subtitle || '') + '</p>';
    document.getElementById('allProducts').innerHTML = (items || []).map((p) => C.productCard(p, false)).join('');
  }

  // ---------- 智能选型 ----------
  let sel = { material: null, thickness: null, scale: null, features: [] };
  function bindWizard() {
    const bind = (selector, key, single) => {
      document.querySelectorAll(selector).forEach((c) => c.addEventListener('click', () => {
        if (single) {
          document.querySelectorAll(selector).forEach((x) => x.classList.remove('selected'));
          c.classList.add('selected'); sel[key] = c.dataset[key];
        } else {
          c.classList.toggle('selected');
          const v = c.dataset.feature;
          if (c.classList.contains('selected')) sel.features.push(v); else sel.features = sel.features.filter((x) => x !== v);
        }
        updateRec();
      }));
    };
    bind('.mat-card', 'material', true);
    bind('.thick-card', 'thickness', true);
    bind('.scale-card', 'scale', true);
    bind('.feat-card', 'features', false);
  }
  function updateRec() {
    const box = document.getElementById('resultBox');
    const wrap = document.getElementById('resultProducts');
    if (!sel.material || !sel.thickness) { box.classList.remove('visible'); return; }
    box.classList.add('visible');
    const products = (window.VG.L.products) || [];
    let want = [sel.thickness]; if (sel.scale) want.push(sel.scale);
    let recs = products.filter((p) => (p.match || []).some((m) => want.includes(m)));
    if (!recs.length) recs = products.slice(0, 3);
    recs = [...new Map(recs.map((p) => [p.id, p])).values()].slice(0, 4);
    wrap.innerHTML = recs.map((p, i) => C.productCard(p, i === 0)).join('');
  }

  C.boot(function () {
    const L = window.VG.L;
    C.initChrome(true);
    renderHero(L.hero);
    renderWizard(L.wizard);
    renderProducts(L.productsSection, L.products);
  });
})();
