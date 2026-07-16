/* V槽 CMS 产品详情页渲染（多语言） */
(function () {
  const C = window.VGCommon;
  const esc = C.esc;

  let gal = { items: [], current: 0 };

  function renderGallery() {
    const main = document.getElementById('gMain');
    const thumbs = document.getElementById('gThumbs');
    if (!gal.items.length) { main.innerHTML = '<img src="/assets/logo.png" style="object-fit:contain;padding:3rem;opacity:.4">'; thumbs.innerHTML = ''; return; }
    const it = gal.items[gal.current];
    const media = it.type === 'video'
      ? '<video src="' + esc(it.src) + '" muted loop controls></video>'
      : '<img src="' + esc(it.src) + '" alt="' + esc(it.alt || '') + '">';
    main.innerHTML = '<div class="inner-content" style="width:100%;height:100%">' + media + '</div>' +
      (gal.items.length > 1 ? '<button class="gallery-btn prev" type="button">‹</button><button class="gallery-btn next" type="button">›</button>' : '') +
      '<div class="gallery-counter">' + (gal.current + 1) + ' / ' + gal.items.length + '</div>';
    main.onclick = openLightbox;
    const prev = main.querySelector('.gallery-btn.prev');
    const next = main.querySelector('.gallery-btn.next');
    if (prev) prev.addEventListener('click', function (e) { e.stopPropagation(); window.__g(-1); });
    if (next) next.addEventListener('click', function (e) { e.stopPropagation(); window.__g(1); });
    thumbs.innerHTML = '';
    gal.items.forEach(function (x, i) {
      const el = document.createElement('div');
      el.className = i === gal.current ? 'g-thumb active' : 'g-thumb';
      el.innerHTML = x.type === 'video'
        ? '<video src="' + esc(x.src) + '" muted></video><span class="g-thumb-type">VIDEO</span>'
        : '<img src="' + esc(x.src) + '" alt="">';
      el.addEventListener('click', function () { window.__gg(i); });
      thumbs.appendChild(el);
    });
  }
  window.__g = (d) => { gal.current = (gal.current + d + gal.items.length) % gal.items.length; renderGallery(); };
  window.__gg = (i) => { gal.current = i; renderGallery(); };

  function openLightbox() {
    if (!gal.items.length) return;
    renderLightbox(); document.getElementById('lightbox').classList.add('open');
  }
  function renderLightbox() {
    const lb = document.getElementById('lightbox');
    const m = gal.items[gal.current];
    const media = m.type === 'video' ? '<video src="' + esc(m.src) + '" controls autoplay></video>' : '<img src="' + esc(m.src) + '" alt="">';
    lb.innerHTML = '<button class="lightbox-close" type="button" data-lb="close">✕</button>' +
      (gal.items.length > 1
        ? '<button class="lightbox-close" type="button" data-lb="-1" style="left:20px;right:auto;top:50%;transform:translateY(-50%)">‹</button>' +
          '<button class="lightbox-close" type="button" data-lb="1" style="right:20px;top:50%;transform:translateY(-50%)">›</button>'
        : '') + media;
    lb.querySelectorAll('[data-lb]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const v = btn.getAttribute('data-lb');
        if (v === 'close') window.__lbc();
        else window.__lb(Number(v));
      });
    });
  }
  window.__lb = (d) => { gal.current = (gal.current + d + gal.items.length) % gal.items.length; renderLightbox(); renderGallery(); };
  window.__lbc = () => document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') window.__lbc(); });
  document.addEventListener('keydown', (e) => {
    const lb = document.getElementById('lightbox'); if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') window.__lbc();
    if (e.key === 'ArrowLeft' && gal.items.length > 1) window.__lb(-1);
    if (e.key === 'ArrowRight' && gal.items.length > 1) window.__lb(1);
  });

  /** 下载参数表：优先 downloadUrl；否则根据产品信息生成 txt */
  function downloadSpecSheet(p) {
    const url = (p.downloadUrl || p.datasheet || '').trim();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      if (!/^https?:\/\//i.test(url)) a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const lines = [];
    lines.push(p.name || 'Product');
    if (p.subtitle) lines.push(p.subtitle);
    lines.push('');
    if (p.price && (p.price.main || p.price.usd)) {
      lines.push((p.price.label || 'Price') + ': ' + [p.price.main, p.price.cny, p.price.usd].filter(Boolean).join(' '));
      if (p.price.note) lines.push(p.price.note);
      lines.push('');
    }
    const a = p.attrs || {};
    [['Brand', a.brand], ['Model', a.model], ['Certification', a.cert], ['Origin', a.origin]].forEach(function (row) {
      if (row[1]) lines.push(row[0] + ': ' + row[1]);
    });
    (p.customAttrs || []).forEach(function (x) { if (x.name) lines.push(x.name + ': ' + (x.value || '')); });
    (p.specs || []).forEach(function (s) { if (s.k) lines.push(s.k + ': ' + (s.v || '')); });
    const t = p.trade || {};
    if (t.moq) lines.push('MOQ: ' + t.moq);
    if (t.supplyAbility) lines.push('Supply: ' + t.supplyAbility);
    if (t.deliveryTime) lines.push('Lead time: ' + t.deliveryTime);
    if (t.packaging) lines.push('Packaging: ' + t.packaging);
    if (t.payments && t.payments.length) lines.push('Payment: ' + t.payments.join(', '));
    if (p.highlights && p.highlights.length) {
      lines.push('');
      lines.push(p.highlightsTitle || 'Highlights');
      p.highlights.forEach(function (h) { lines.push('- ' + h); });
    }
    lines.push('');
    lines.push('Page: ' + location.href);
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(blob);
    a2.download = (p.slug || p.id || 'spec') + '-specs.txt';
    document.body.appendChild(a2);
    a2.click();
    a2.remove();
    setTimeout(function () { URL.revokeObjectURL(a2.href); }, 1000);
  }

  function renderInfo(p, L) {
    const price = p.price || {};
    let priceHtml = '';
    if (price.main || price.usd) {
      priceHtml = '<div class="price-block"><div class="price-label">' + esc(price.label || '') + '</div><div class="price-row">' +
        (price.main ? '<span class="price-main">' + esc(price.main) + '</span>' : '') +
        (price.cny ? '<span class="price-cny">' + esc(price.cny) + '</span>' : '') +
        (price.usd ? '<span class="price-usd">' + esc(price.usd) + '</span>' : '') +
        '</div>' + (price.note ? '<div class="price-note">' + esc(price.note) + '</div>' : '') + '</div>';
    }
    const delivery = (p.delivery || []).map((d) => '<div class="dtag' + (d.green ? ' green' : '') + '">' + esc(d.text) + '</div>').join('');
    const trust = (p.trustBadges || []).map((t) => '<div class="trust-badge">' + esc(t) + '</div>').join('');
    const benefits = (p.benefits || []).map((b) => '<div class="benefit-item"><span class="benefit-icon">' + esc(b.icon) + '</span><span class="benefit-text">' + esc(b.text) + '</span></div>').join('');
    const highlights = (p.highlights && p.highlights.length)
      ? '<div class="featured-box"><h3>' + esc(p.highlightsTitle || '') + '</h3><ul>' + p.highlights.map((h) => '<li>' + esc(h) + '</li>').join('') + '</ul></div>' : '';

    const host = document.getElementById('pInfo');
    host.innerHTML =
      (p.badge ? '<span class="product-badge ' + esc(p.badgeClass || '') + '">' + esc(p.badge) + '</span>' : '') +
      '<h1 class="product-title">' + esc(p.name) + '</h1>' +
      '<p class="product-subtitle">' + esc(p.subtitle || '') + '</p>' +
      priceHtml +
      (delivery ? '<div class="delivery-tags">' + delivery + '</div>' : '') +
      '<div class="cta-group" id="pCtaGroup"></div>' +
      (trust ? '<div class="trust-badges">' + trust + '</div>' : '') +
      (benefits ? '<div class="benefits-grid">' + benefits + '</div>' : '') +
      highlights;

    const group = document.getElementById('pCtaGroup');
    const btnPrimary = document.createElement('button');
    btnPrimary.type = 'button';
    btnPrimary.className = 'cta-primary';
    btnPrimary.setAttribute('data-open-chat', '1');
    btnPrimary.textContent = p.ctaPrimary || '获取报价';
    btnPrimary.addEventListener('click', function (ev) { window.openChat(ev); });
    const btnSecondary = document.createElement('button');
    btnSecondary.type = 'button';
    btnSecondary.className = 'cta-secondary';
    btnSecondary.textContent = p.ctaSecondary || '下载参数表';
    btnSecondary.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      downloadSpecSheet(p);
    });
    group.appendChild(btnPrimary);
    group.appendChild(btnSecondary);
  }

  const LBL = {
    zh: { brand: '品牌', model: '型号', cert: '认证证书', origin: '原产地', moq: '最小起订量', supply: '供货能力', delivery: '发货期限', pack: '常规包装', pay: '付款方式', params: '产品参数', desc: '产品描述' },
    en: { brand: 'Brand', model: 'Model', cert: 'Certification', origin: 'Origin', moq: 'Min. Order', supply: 'Supply Ability', delivery: 'Lead Time', pack: 'Packaging', pay: 'Payment Terms', params: 'Specifications', desc: 'Description' },
  };
  function lbl(k) { return (LBL[window.VG.lang] || LBL.en)[k] || LBL.en[k] || k; }

  function renderSpecs(p) {
    const el = document.getElementById('specSection');
    const rows = [];
    const a = p.attrs || {};
    if (a.brand) rows.push([lbl('brand'), a.brand]);
    if (a.model) rows.push([lbl('model'), a.model]);
    if (a.cert) rows.push([lbl('cert'), a.cert]);
    if (a.origin) rows.push([lbl('origin'), a.origin]);
    (p.customAttrs || []).forEach((x) => { if (x.name) rows.push([x.name, x.value]); });
    (p.specs || []).forEach((s) => { if (s.k) rows.push([s.k, s.v]); });
    const t = p.trade || {};
    if (t.moq) rows.push([lbl('moq'), t.moq]);
    if (t.supplyAbility) rows.push([lbl('supply'), t.supplyAbility]);
    if (t.deliveryTime) rows.push([lbl('delivery'), t.deliveryTime]);
    if (t.packaging) rows.push([lbl('pack'), t.packaging]);
    if (t.payments && t.payments.length) rows.push([lbl('pay'), t.payments.join(', ')]);
    let html = '';
    if (rows.length) {
      html += '<div class="spec-title">' + esc(p.specsTitle || lbl('params')) + '</div><table class="spec-table">' +
        rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>';
    }
    if (p.description && String(p.description).trim()) {
      html += '<div class="spec-title" style="margin-top:2rem">' + esc(lbl('desc')) + '</div><div class="product-desc">' + p.description + '</div>';
    }
    el.innerHTML = html;
  }

  function renderRelated(p, L) {
    const el = document.getElementById('relatedSection');
    const all = L.products || [];
    const rel = (p.related || []).map((r) => all.find((x) => (x.slug || x.id) === r.slug) || r).filter(Boolean);
    const list = rel.length ? rel : all.filter((x) => (x.slug || x.id) !== (p.slug || p.id)).slice(0, 3);
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="related-title">' + esc(p.relatedTitle || '') + '</div><div class="related-grid">' +
      list.map((r) => {
        const full = all.find((x) => (x.slug || x.id) === (r.slug || r.id));
        const m = full ? C.cardMedia(full) : null;
        const img = m ? (m.type === 'video' ? '<video src="' + esc(m.src) + '" muted></video>' : '<img src="' + esc(m.src) + '" alt="">') : '<img src="/assets/logo.png" style="object-fit:contain;padding:1rem;opacity:.4">';
        return '<a class="related-card" href="' + C.productHref(window.VG.lang, r.slug || (full && full.id) || '') + '"><div class="related-card-img">' + img + '</div><div class="related-card-body"><h4>' + esc(r.name || (full && full.name)) + '</h4><p>' + esc(r.note || '') + '</p></div></a>';
      }).join('') + '</div>';
  }

  C.boot(function (info) {
    const L = window.VG.L;
    C.initChrome(false);
    const products = L.products || [];
    const p = products.find((x) => (x.slug || x.id) === info.slug) || products.find((x) => x.id === info.slug);
    if (!p) {
      document.getElementById('productPage').innerHTML = '<div style="text-align:center;padding:4rem 1rem"><h1>404</h1><p style="color:var(--gray-500)">未找到产品「' + esc(info.slug) + '」</p><a class="hero-cta" href="' + C.homeHref(window.VG.lang) + '">← 返回首页</a></div>';
      return;
    }
    if (L.meta) document.title = p.name + ' | ' + (L.brandName || 'V槽PRO');
    window.VG.productContext = {
      productSlug: p.slug || p.id,
      productName: p.name || '',
      productImage: (p.cardImage) || (p.gallery && p.gallery[0] && p.gallery[0].src) || '',
      productPrice: (p.price && (p.price.main || p.price.usd)) || '',
    };
    const ui = L.ui || {};
    document.getElementById('breadcrumb').innerHTML =
      '<a href="' + C.homeHref(window.VG.lang) + '">' + esc(ui.breadcrumbHome || '首页') + '</a> › ' +
      '<a href="' + C.homeHref(window.VG.lang) + '#all-products">' + esc(ui.breadcrumbProducts || '全部产品') + '</a> › <span>' + esc(p.name) + '</span>';
    gal = { items: (p.gallery && p.gallery.length) ? p.gallery.slice() : (p.cardImage ? [{ type: 'image', src: p.cardImage, alt: p.name }] : []), current: 0 };
    renderGallery();
    renderInfo(p, L);
    renderSpecs(p);
    renderRelated(p, L);
  });
})();
