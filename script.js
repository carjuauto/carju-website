/* =========================
   Global language state
   ========================= */
const state = { lang: localStorage.getItem('carju_lang') || 'en' };

function setLang(l){
  state.lang = l;
  localStorage.setItem('carju_lang', l);

  document.querySelectorAll('[data-i18n]').forEach(el=>{
    el.classList.toggle('hidden', el.getAttribute('data-i18n') !== l);
  });

  document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.classList.toggle('badge', b.getAttribute('data-lang-btn') !== l);
  });
}

/* =========================
   Helpers
   ========================= */
function el(tag, attrs = {}, html = ''){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  if (html) n.innerHTML = html;
  return n;
}

function uniqueList(arr){
  return [...new Set((arr || []).filter(Boolean))];
}

function clean(s){
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const PLACEHOLDER_IMG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='100%' height='100%' fill='%23f3f3f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='18'>Image unavailable</text></svg>`;

function stockImageFallback(img){
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
}

function escapeHTML(str){
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* =========================
   Config
   ========================= */
const DEFAULT_BRANDS = [
  "Toyota","Honda","Nissan","Mazda","Subaru","Mitsubishi","Suzuki","Daihatsu","Isuzu","Hino","Lexus",
  "UD Trucks","Scania","Volvo","BMW","Mercedes-Benz","Audi","Volkswagen","Porsche","Maserati","Yamaha","Kawasaki"
];

const DEFAULT_CATEGORIES = [
  "Sedan","Hatchback","SUV","Truck","Van","Wagon","Coupe","Convertible","Hybrid/EV",
  "Machinery","Agricultural","Bus","Mini Bus","Pickup","Heavy Machinery","Construction Equipment","Motorcycle"
];

function getConfig(){
  const cfg = window.CARJU_CONFIG || {};
  return {
    WHATSAPP: cfg.WHATSAPP || "+81 80 4790 9663",
    TIKTOK: cfg.TIKTOK || "https://www.tiktok.com/@carju_auto",
    BRANDS: uniqueList([...DEFAULT_BRANDS, ...(cfg.BRANDS || [])]),
    CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(cfg.CATEGORIES || [])]),
    STOCK: cfg.STOCK || [],
    FEES: cfg.FEES || []
  };
}

/* =========================
   Fees renderer
   ========================= */
function renderFeesTables(rows){
  const mounts = Array.from(document.querySelectorAll('#feesTable'));
  if (!mounts.length) return;

  const buildTableNode = () => {
    if (!rows || !rows.length){
      return el('div', { class: 'muted small' }, 'Fees are currently unavailable.');
    }

    const headers = Object.keys(rows[0] || {});
    const table = document.createElement('table');
    table.className = 'table';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');

    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });

    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    rows.forEach(r => {
      const tr = document.createElement('tr');

      headers.forEach(h => {
        const td = document.createElement('td');
        td.textContent = r[h] ?? '';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  };

  mounts.forEach(m => {
    m.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';
    card.appendChild(el('h3', {}, 'Agency Fee Structure'));
    card.appendChild(buildTableNode());

    m.appendChild(card);
  });
}

/* =========================
   Stock system
   ========================= */
function normalizeStockItem(item){
  return {
    id: item.id || '',
    location: clean(item.location || ''),
    title: item.title || item.name || 'Vehicle',
    brand: item.brand || '',
    category: item.category || '',
    year: item.year || '',
    price: item.price || 'Ask for Price',
    status: item.status || '',
    seller: item.seller || '',
    mainImage: item.mainImage || item.src || PLACEHOLDER_IMG,
    gallery: item.gallery && item.gallery.length ? item.gallery : [item.mainImage || item.src || PLACEHOLDER_IMG],
    description: item.description || '',
    whatsapp: String(item.whatsapp || '').replace(/[^0-9]/g, '')
  };
}

function getStockItems(){
  return (getConfig().STOCK || []).map(normalizeStockItem);
}

function stockDetailUrl(item){
  return item.location === 'uganda'
    ? `stock-uganda-detail.html?id=${encodeURIComponent(item.id)}`
    : `stock-japan-detail.html?id=${encodeURIComponent(item.id)}`;
}

function stockWhatsAppUrl(item){
  const contactName = item.seller || (item.location === 'uganda' ? 'YUSUMA Enterprises' : 'CARJU JAPAN');
  const message = `Hello ${contactName}, I am interested in this car: ${item.title} ${item.year}. Please share more details.`;
  return `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(message)}`;
}

function renderStockCard(item, compact = false){
  const card = document.createElement('article');
  card.className = compact ? 'stock-card stock-card-compact' : 'stock-card';

  const safeTitle = escapeHTML(item.title);
  const safeStatus = escapeHTML(item.status || (item.location === 'uganda' ? 'Available in Uganda' : 'Available in Japan'));
  const safeMeta = escapeHTML([item.year, item.brand, item.category, item.seller].filter(Boolean).join(' · '));
  const safePrice = escapeHTML(item.price);

  card.innerHTML = `
    <img src="${escapeHTML(item.mainImage)}" alt="${safeTitle}" onerror="stockImageFallback(this)">
    <div class="stock-card-body">
      <span class="stock-badge">${safeStatus}</span>
      <h3>${safeTitle}</h3>
      <div class="stock-meta">${safeMeta}</div>
      <div class="stock-price">${safePrice}</div>
      <div class="stock-actions">
        <a class="stock-btn secondary" href="${stockDetailUrl(item)}">View Details</a>
        <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank">Ask Now</a>
      </div>
    </div>
  `;

  return card;
}

function renderStockSliders(){
  const items = getStockItems();

  const japanGrid = document.getElementById('japanStockGrid');
  const ugandaGrid = document.getElementById('ugandaStockGrid');

  if (japanGrid){
    japanGrid.innerHTML = '';
    items.filter(x => x.location === 'japan').forEach(item => {
      japanGrid.appendChild(renderStockCard(item));
    });
  }

  if (ugandaGrid){
    ugandaGrid.innerHTML = '';
    items.filter(x => x.location === 'uganda').forEach(item => {
      ugandaGrid.appendChild(renderStockCard(item));
    });
  }
}

function renderStockBrowse(){
  const items = getStockItems();

  const locationSel = document.getElementById('stockLocationSelect');
  const brandSel = document.getElementById('stockBrandSelect');
  const catSel = document.getElementById('stockCategorySelect');
  const grid = document.getElementById('stockBrowseGrid');

  if (!locationSel || !brandSel || !catSel || !grid) return;

  const brands = uniqueList(['All', ...items.map(x => x.brand).filter(Boolean), ...getConfig().BRANDS]);
  const cats = uniqueList(['All', ...items.map(x => x.category).filter(Boolean), ...getConfig().CATEGORIES]);

  brandSel.innerHTML = brands.map(b => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`).join('');
  catSel.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

  function updateBrowseGrid(){
    const loc = clean(locationSel.value || 'All');
    const brand = clean(brandSel.value || 'All');
    const cat = clean(catSel.value || 'All');

    const filtered = items.filter(item => {
      const locationOk = loc === 'all' || item.location === loc;
      const brandOk = brand === 'all' || clean(item.brand) === brand;
      const catOk = cat === 'all' || clean(item.category) === cat;
      return locationOk && brandOk && catOk;
    });

    grid.innerHTML = '';

    if (!filtered.length){
      grid.appendChild(el('div', { class: 'muted small' }, 'No stock matches found. Try another filter.'));
      return;
    }

    filtered.forEach(item => {
      grid.appendChild(renderStockCard(item, true));
    });
  }

  locationSel.addEventListener('change', updateBrowseGrid);
  brandSel.addEventListener('change', updateBrowseGrid);
  catSel.addEventListener('change', updateBrowseGrid);

  locationSel.value = 'All';
  brandSel.value = 'All';
  catSel.value = 'All';

  updateBrowseGrid();
}

function setupStockSliderControls(){
  document.querySelectorAll('[data-stock-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-stock-prev');
      const grid = document.getElementById(type + 'StockGrid');
      if (grid) grid.scrollBy({ left: -320, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-stock-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-stock-next');
      const grid = document.getElementById(type + 'StockGrid');
      if (grid) grid.scrollBy({ left: 320, behavior: 'smooth' });
    });
  });

  ['japanStockGrid', 'ugandaStockGrid'].forEach(id => {
    const grid = document.getElementById(id);
    if (!grid) return;

    setInterval(() => {
      if (grid.scrollWidth <= grid.clientWidth) return;

      const nearEnd = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 20;

      if (nearEnd){
        grid.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        grid.scrollBy({ left: 320, behavior: 'smooth' });
      }
    }, 5000);
  });
}

function getStockIdFromUrl(){
  return new URLSearchParams(window.location.search).get('id');
}

function renderStockDetailPage(expectedLocation){
  const mount = document.getElementById('stockDetailMount');
  if (!mount) return;

  const id = getStockIdFromUrl();
  const item = getStockItems().find(x => x.id === id && x.location === expectedLocation);

  if (!item){
    mount.innerHTML = `
      <section class="card">
        <h1>Car not found</h1>
        <p>This stock item may have been removed or sold.</p>
        <a class="btn" href="index.html">Back to Home</a>
      </section>
    `;
    return;
  }

  mount.innerHTML = `
    <section class="stock-detail-page">
      <div class="stock-detail-hero">
        <div>
          <img id="mainStockImage" class="stock-main-image" src="${escapeHTML(item.mainImage)}" alt="${escapeHTML(item.title)}" onerror="stockImageFallback(this)">
        </div>

        <div class="stock-detail-info">
          <span class="stock-badge">${escapeHTML(item.status)}</span>
          <h1>${escapeHTML(item.title)}</h1>
          <p>${escapeHTML(item.description)}</p>

          <ul class="stock-detail-list">
            <li><strong>Year:</strong> ${escapeHTML(item.year)}</li>
            <li><strong>Brand:</strong> ${escapeHTML(item.brand)}</li>
            <li><strong>Category:</strong> ${escapeHTML(item.category)}</li>
            <li><strong>Price:</strong> ${escapeHTML(item.price)}</li>
            <li><strong>Seller:</strong> ${escapeHTML(item.seller)}</li>
            <li><strong>Location:</strong> ${item.location === 'uganda' ? 'Uganda' : 'Japan'}</li>
          </ul>

          <div class="stock-actions">
            <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank">Ask About This Car</a>
            <a class="stock-btn secondary" href="index.html">Back to Stock</a>
          </div>
        </div>
      </div>

      <div class="stock-gallery">
        ${item.gallery.map(src => `
          <img src="${escapeHTML(src)}" alt="${escapeHTML(item.title)}" onclick="document.getElementById('mainStockImage').src='${escapeHTML(src)}'" onerror="stockImageFallback(this)">
        `).join('')}
      </div>
    </section>
  `;
}

/* =========================
   Build page
   ========================= */
function buildFromConfig(){
  const cfg = getConfig();

  const wa = document.getElementById('wa-link');
  const tk = document.getElementById('tiktok-link');

  if (wa && cfg.WHATSAPP){
    const num = String(cfg.WHATSAPP).replace(/[^0-9]/g, '');
    if (num) wa.href = 'https://wa.me/' + num;
  }

  if (tk && cfg.TIKTOK){
    tk.href = cfg.TIKTOK;
  }

  renderStockBrowse();
  renderStockSliders();
  setupStockSliderControls();

  if (cfg.FEES && cfg.FEES.length){
    renderFeesTables(cfg.FEES);
  }

  if (document.body.classList.contains('japan-stock-detail')){
    renderStockDetailPage('japan');
  }

  if (document.body.classList.contains('uganda-stock-detail')){
    renderStockDetailPage('uganda');
  }
}

/* =========================
   Services Card Toggle
   ========================= */
function toggleService(card){
  if (!card) return;
  const body = card.querySelector('.hidden-text');
  const btn = card.querySelector('.read-more-btn');
  if (!body) return;

  const isOpen = body.classList.toggle('open');
  body.style.display = isOpen ? 'block' : 'none';
  if (btn) btn.textContent = isOpen ? 'Read less' : 'Read more';
}

/* =========================
   Init
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.addEventListener('click', () => setLang(b.getAttribute('data-lang-btn')));
  });
  setLang(state.lang);

  const nav = document.getElementById('siteNav');
  const navBtn = document.getElementById('navToggle');

  if (nav && navBtn){
    navBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (nav.classList.contains('open')){
          nav.classList.remove('open');
          navBtn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  const heroPanel = document.querySelector('.hero-panel');

  if (heroPanel){
    const nameEl = heroPanel.querySelector('input[type="text"]');
    const contactEl = heroPanel.querySelector('input[type="email"]');
    const selectEl = heroPanel.querySelector('select');
    const cbBtn = heroPanel.querySelector('.btn');

    if (cbBtn){
      cbBtn.addEventListener('click', (e) => {
        e.preventDefault();

        const name = (nameEl && nameEl.value.trim()) || '';
        const contact = (contactEl && contactEl.value.trim()) || '';
        const looking = (selectEl && selectEl.value) || '';

        const subject = `Callback request from ${name || 'client'}`;
        const body = [
          `Hello CARJU Japan,`,
          ``,
          `Name: ${name || '-'}`,
          `Contact (Email/WhatsApp): ${contact || '-'}`,
          `Looking for: ${looking || '-'}`,
          ``,
          `Please call me back or reply when you can.`
        ].join('\n');

        if (confirm('Send via WhatsApp? (Cancel = Email)')){
          const msg = `Hi CARJU Japan, I’d like a callback.\nName: ${name}\nContact: ${contact}\nLooking for: ${looking}`;
          window.open(`https://wa.me/818047909663?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
          window.location.href = `mailto:carjuautoagency@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      });
    }
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.read-more, .why-more, [data-expand]');
    if (!btn) return;

    e.preventDefault();

    const card = btn.closest('.bio, .card, .why-item, .point, article, .service-card, .value, .doc, section');
    if (!card) return;

    const body = card.querySelector('.more, .hidden-text');
    if (!body) return;

    const isCurrentlyHidden =
      body.classList.contains('hidden') ||
      body.style.display === 'none' ||
      getComputedStyle(body).display === 'none';

    if (body.classList.contains('hidden')){
      body.classList.toggle('hidden', !isCurrentlyHidden);
    } else if (body.classList.contains('hidden-text')){
      body.classList.toggle('open', isCurrentlyHidden);
      body.style.display = isCurrentlyHidden ? 'block' : 'none';
    } else {
      body.style.display = isCurrentlyHidden ? '' : 'none';
    }

    btn.textContent = isCurrentlyHidden ? 'Read less' : 'Read more';

    if (isCurrentlyHidden && window.matchMedia('(max-width: 860px)').matches){
      setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  });

  const promoBar = document.getElementById('promo-bar');
  const promoBarClose = document.getElementById('promo-bar-close');

  if (promoBar){
    promoBar.classList.remove('hidden');

    if (promoBarClose){
      promoBarClose.addEventListener('click', () => {
        promoBar.classList.add('hidden');
      });
    }
  }

  const initReveal = () => {
    const targets = document.querySelectorAll('.services-grid .service-card, .reveal');

    if (!targets.length) return;

    if (!('IntersectionObserver' in window)){
      targets.forEach(t => t.classList.add('in-view'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    targets.forEach((t, i) => {
      t.style.transitionDelay = (i * 50) + 'ms';
      io.observe(t);
    });
  };

  try {
    buildFromConfig();
    initReveal();
    console.log('[CARJU] Stock system initialized.');
  } catch (err){
    console.error('[CARJU] buildFromConfig failed:', err);
  }
});
