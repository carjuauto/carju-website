/* =========================
   CARJU JAPAN — Stable Premium Stock System
   Config.js only. No Google Sheets.
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

function escapeHTML(str){
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const PLACEHOLDER_IMG =
  `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='100%' height='100%' fill='%23f3f3f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='18'>Image unavailable</text></svg>`;

function stockImageFallback(img){
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
}

const DEFAULT_BRANDS = [
  "Toyota","Honda","Nissan","Mazda","Subaru","Mitsubishi",
  "Suzuki","Daihatsu","Isuzu","Hino","Lexus"
];

const DEFAULT_CATEGORIES = [
  "Sedan","Hatchback","SUV","Truck","Van","Wagon",
  "Coupe","Convertible","Hybrid/EV","Machinery","Agricultural"
];

function getConfig(){
  const cfg = window.CARJU_CONFIG || {};
  return {
    WHATSAPP: cfg.WHATSAPP || "+81 80 4790 9663",
YUSUMA_WHATSAPP: cfg.YUSUMA_WHATSAPP || "256704104804",
TIKTOK: cfg.TIKTOK || "https://www.tiktok.com/@carju_auto",
    BRANDS: uniqueList([...DEFAULT_BRANDS, ...(cfg.BRANDS || [])]),
    CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(cfg.CATEGORIES || [])]),
    JAPAN_STOCK: cfg.JAPAN_STOCK || [],
    UGANDA_STOCK: cfg.UGANDA_STOCK || [],
    FEES: cfg.FEES || []
  };
}

let CARJU_STOCK_CACHE = [];
let CURRENT_DETAIL_GALLERY = [];
let CURRENT_DETAIL_INDEX = 0;

function splitList(value){
  return String(value || "")
    .split(/[,|]/)
    .map(x => x.trim())
    .filter(Boolean);
}

function normalizeStockItem(item){
  const id = item.ID || item.id || '';
  const location = clean(item.Location || item.location || '');

  let gallery = [];

  if (Array.isArray(item.gallery) && item.gallery.length){
    gallery = item.gallery.filter(Boolean);
  } else {
    gallery = [
      item.MainImage || item.mainImage || item.ImageURL || item.src,
      item.Photo1,item.Photo2,item.Photo3,item.Photo4,item.Photo5,
      item.Photo6,item.Photo7,item.Photo8,item.Photo9,item.Photo10
    ].filter(Boolean);
  }

  const mainImage =
    item.MainImage ||
    item.mainImage ||
    item.mainImageUrl ||
    item.main_image ||
    gallery[0] ||
    PLACEHOLDER_IMG;

  if (!gallery.length){
    gallery = [mainImage];
  }

  return {
    id,
    location,
    title: item.Title || item.title || item.name || 'Vehicle',
    manufacturer: item.Manufacturer || item.manufacturer || item.Brand || item.brand || '',
    model: item.Model || item.model || item.Title || item.title || '',
    brand: item.Brand || item.brand || item.Manufacturer || item.manufacturer || '',
    category: item.Category || item.category || '',
    year: item.Year || item.year || '',
    price: item.Price || item.price || 'Ask for Price',
    status: item.Status || item.status || '',
    seller: item.Seller || item.seller || '',
    badge: item.Badge || item.badge || '',
    doors: item.Doors || item.doors || '',
    transmission: item.Transmission || item.transmission || '',
    drivetrain: item.Drivetrain || item.drivetrain || '',
    fuel: item.Fuel || item.fuel || '',
    maintenance: item.Maintenance || item.maintenance || '',
    features: Array.isArray(item.features) ? item.features : splitList(item.Features || item.features),
    mainImage,
    gallery,
    description: item.Description || item.description || '',
    whatsapp: String(item.WhatsApp || item.whatsapp || '').replace(/[^0-9]/g, '')
  };
}

function getStockItems(){
  return CARJU_STOCK_CACHE.map(normalizeStockItem);
}

function stockDetailUrl(item){
  return item.location === 'uganda'
    ? `stock-uganda-detail.html?id=${encodeURIComponent(item.id)}`
    : `stock-japan-detail.html?id=${encodeURIComponent(item.id)}`;
}

function stockWhatsAppUrl(item){
  const cfg = getConfig();
const fallbackPhone = item.location === 'uganda'
  ? cfg.YUSUMA_WHATSAPP
  : String(cfg.WHATSAPP).replace(/[^0-9]/g, '');
const phone = item.location === 'uganda'
  ? (item.whatsapp || cfg.YUSUMA_WHATSAPP)
  : (item.whatsapp || fallbackPhone);
  const contactName = item.seller || (item.location === 'uganda' ? 'YUSUMA Enterprises' : 'CARJU JAPAN');

  const message = [
    `Hello ${contactName}, I am interested in this car:`,
    ``,
    `${item.title} ${item.year || ''}`,
    `Stock ID: ${item.id}`,
    `Price: ${item.price || 'Ask for Price'}`,
    ``,
    `Please share more details.`
  ].join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function renderStockCard(item, compact = false){
  const card = document.createElement('article');
  card.className = compact ? 'stock-card stock-card-compact premium-stock-card' : 'stock-card premium-stock-card';

  const badgeHtml = item.badge
    ? `<span class="stock-new-badge">${escapeHTML(item.badge)}</span>`
    : '';

  const galleryHtml = item.gallery.map(src => `
    <img src="${escapeHTML(src)}" alt="${escapeHTML(item.title)}" loading="lazy" onerror="stockImageFallback(this)">
  `).join('');

  card.innerHTML = `
    <div class="stock-image-wrap">
      ${badgeHtml}
      <div class="stock-card-image-scroll">
        ${galleryHtml}
      </div>
      <div class="stock-photo-count">${item.gallery.length} photos</div>
    </div>

    <div class="stock-card-body">
      <span class="stock-badge">${escapeHTML(item.status || (item.location === 'uganda' ? 'Available in Uganda' : 'Available in Japan'))}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <div class="stock-meta">${escapeHTML([item.year, item.brand, item.category, item.seller].filter(Boolean).join(' · '))}</div>
      <div class="stock-price">${escapeHTML(item.price)}</div>

      <div class="stock-actions">
        <a class="stock-btn secondary" href="${stockDetailUrl(item)}">View Details</a>
        <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank" rel="noopener">Ask Now</a>
      </div>
    </div>
  `;

  return card;
}

function renderStockSliders(){
  const items = getStockItems();

  function renderGrid(id, location){
    const grid = document.getElementById(id);
    if (!grid) return;

    const section = grid.closest('.stock-section');
    const rows = items.filter(x => x.location === location);

    grid.innerHTML = '';

    if (!rows.length){
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = '';
    rows.forEach(item => grid.appendChild(renderStockCard(item)));
  }

  renderGrid('japanStockGrid', 'japan');
  renderGrid('ugandaStockGrid', 'uganda');
}

function getNewArrivals(items, location, limit = 3){
  return items
    .filter(x =>
      x.location === location &&
      (
        clean(x.badge) === 'new arrival' ||
        (x.features || []).some(f => clean(f) === 'new arrival')
      )
    )
    .slice(0, limit);
}

function renderNewArrivals(){
  const items = getStockItems();

  function renderMount(id, location){
    const mount = document.getElementById(id);
    if (!mount) return;

    const rows = getNewArrivals(items, location, 3);
    const section = mount.closest('.new-arrivals-section');

    mount.innerHTML = '';

    if (!rows.length){
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = '';
    rows.forEach(item => mount.appendChild(renderStockCard(item, true)));
  }

  renderMount('newArrivalsHome', 'japan');
  renderMount('newArrivalsUganda', 'uganda');
}

function renderStockBrowse(){
  const items = getStockItems();

  const locationSel = document.getElementById('stockLocationSelect');
  const brandSel = document.getElementById('stockBrandSelect');
  const catSel = document.getElementById('stockCategorySelect');
  const grid = document.getElementById('stockBrowseGrid');

  if (!brandSel || !catSel || !grid) return;

  const isUgandaPage = document.body.classList.contains('yusuma-uganda-stock-page');
  const isJapanPage = document.body.classList.contains('japan-stock-page');

  function pageLocation(){
    if (isUgandaPage) return 'uganda';
    if (isJapanPage) return 'japan';
    return locationSel ? clean(locationSel.value || 'japan') : 'japan';
  }

  function getPageItems(){
    const loc = pageLocation();
    if (loc === 'uganda') return items.filter(x => x.location === 'uganda');
    return items.filter(x => x.location === 'japan');
  }

  function fillFilters(){
    const rows = getPageItems();
    const brands = uniqueList(['All', ...rows.map(x => x.brand).filter(Boolean), ...getConfig().BRANDS]);
    const cats = uniqueList(['All', ...rows.map(x => x.category).filter(Boolean), ...getConfig().CATEGORIES]);

    const oldBrand = brandSel.value || 'All';
    const oldCat = catSel.value || 'All';

    brandSel.innerHTML = brands.map(b => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`).join('');
    catSel.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

    brandSel.value = brands.includes(oldBrand) ? oldBrand : 'All';
    catSel.value = cats.includes(oldCat) ? oldCat : 'All';
  }

  function updateBrowseGrid(){
    const loc = pageLocation();

    if (loc === 'uganda' && !isUgandaPage){
      window.location.href = 'yusuma-uganda-stock.html';
      return;
    }

    fillFilters();

    const brand = clean(brandSel.value || 'All');
    const cat = clean(catSel.value || 'All');
/* Prevent showing everything by default */
if (brand === 'all' && cat === 'all'){
  grid.innerHTML = `
    <div class="browse-placeholder">
      Please select a brand or category to browse available stock.
    </div>
  `;
  return;
}
    const filtered = getPageItems().filter(item => {
      const brandOk = brand === 'all' || clean(item.brand) === brand;
      const catOk = cat === 'all' || clean(item.category) === cat;
      return brandOk && catOk;
    });

    grid.innerHTML = '';

    if (!filtered.length){
      grid.appendChild(el('div', { class: 'muted small empty-stock' }, loc === 'uganda'
        ? 'No Uganda stock matches found. Try another filter.'
        : 'No Japan stock matches found. Try another filter.'
      ));
      return;
    }

    filtered.forEach(item => grid.appendChild(renderStockCard(item, true)));
  }

  if (locationSel){
    locationSel.value = isUgandaPage ? 'uganda' : 'japan';
    locationSel.addEventListener('change', updateBrowseGrid);
  }

  brandSel.addEventListener('change', updateBrowseGrid);
  catSel.addEventListener('change', updateBrowseGrid);

  fillFilters();
  brandSel.value = 'All';
catSel.value = 'All';

/* Start empty */
grid.innerHTML = `
  <div class="browse-placeholder">
    Please select a brand or category to browse available stock.
  </div>
`;
}

function setupStockSliderControls(){
  document.querySelectorAll('[data-stock-prev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-stock-prev');
      const grid = document.getElementById(type + 'StockGrid');
      if (grid) grid.scrollBy({ left: -340, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-stock-next]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-stock-next');
      const grid = document.getElementById(type + 'StockGrid');
      if (grid) grid.scrollBy({ left: 340, behavior: 'smooth' });
    });
  });
}

function getStockIdFromUrl(){
  return new URLSearchParams(window.location.search).get('id');
}

function openImageViewer(index){
  if (!CURRENT_DETAIL_GALLERY.length) return;

  CURRENT_DETAIL_INDEX = index;

  const viewer = document.getElementById('imageViewer');
  const img = document.getElementById('viewerImage');

  if (!viewer || !img) return;

  img.src = CURRENT_DETAIL_GALLERY[CURRENT_DETAIL_INDEX];
  viewer.classList.remove('hidden');
}

function closeImageViewer(){
  const viewer = document.getElementById('imageViewer');
  if (viewer) viewer.classList.add('hidden');
}

function nextViewerImage(){
  if (!CURRENT_DETAIL_GALLERY.length) return;
  CURRENT_DETAIL_INDEX = (CURRENT_DETAIL_INDEX + 1) % CURRENT_DETAIL_GALLERY.length;
  const img = document.getElementById('viewerImage');
  if (img) img.src = CURRENT_DETAIL_GALLERY[CURRENT_DETAIL_INDEX];
}

function prevViewerImage(){
  if (!CURRENT_DETAIL_GALLERY.length) return;
  CURRENT_DETAIL_INDEX = (CURRENT_DETAIL_INDEX - 1 + CURRENT_DETAIL_GALLERY.length) % CURRENT_DETAIL_GALLERY.length;
  const img = document.getElementById('viewerImage');
  if (img) img.src = CURRENT_DETAIL_GALLERY[CURRENT_DETAIL_INDEX];
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
        <a class="btn" href="${expectedLocation === 'uganda' ? 'yusuma-uganda-stock.html' : 'stock-japan.html'}">Back to Stock</a>
      </section>
    `;
    return;
  }

  CURRENT_DETAIL_GALLERY = item.gallery;

  const detailBadgeHtml = item.badge
    ? `<span class="stock-new-badge detail-badge">${escapeHTML(item.badge)}</span>`
    : '';

  const featuresHtml = item.features && item.features.length
    ? `<div class="stock-features">${item.features.map(feature => `<span>${escapeHTML(feature)}</span>`).join('')}</div>`
    : '';

  mount.innerHTML = `
    <section class="stock-detail-page premium-detail">
      <div class="stock-detail-hero">
        <div class="stock-detail-photo-panel">
          <img id="mainStockImage" class="stock-main-image" src="${escapeHTML(item.mainImage)}" alt="${escapeHTML(item.title)}" onclick="openImageViewer(0)" onerror="stockImageFallback(this)">
          <div class="detail-photo-hint">Tap image to enlarge · ${item.gallery.length} photos</div>
        </div>

        <div class="stock-detail-info">
          <span class="stock-badge">${escapeHTML(item.status)}</span>
          ${detailBadgeHtml}
          <h1>${escapeHTML(item.title)}</h1>
          <p>${escapeHTML(item.description)}</p>

          ${featuresHtml}

          <ul class="stock-detail-list">
            <li><strong>Manufacturer:</strong> ${escapeHTML(item.manufacturer || '-')}</li>
            <li><strong>Model:</strong> ${escapeHTML(item.model || item.title || '-')}</li>
            <li><strong>Year:</strong> ${escapeHTML(item.year || '-')}</li>
            <li><strong>Price:</strong> ${escapeHTML(item.price || '-')}</li>
            <li><strong>Number of doors:</strong> ${escapeHTML(item.doors || '-')}</li>
            <li><strong>Transmission:</strong> ${escapeHTML(item.transmission || '-')}</li>
            <li><strong>Drivetrain:</strong> ${escapeHTML(item.drivetrain || '-')}</li>
            <li><strong>Fuel:</strong> ${escapeHTML(item.fuel || '-')}</li>
            <li><strong>Maintenance:</strong> ${escapeHTML(item.maintenance || '-')}</li>
            <li><strong>Seller:</strong> ${escapeHTML(item.seller || '-')}</li>
            <li><strong>Location:</strong> ${item.location === 'uganda' ? 'Uganda' : 'Japan'}</li>
          </ul>

          <div class="stock-actions">
            <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank" rel="noopener">Ask About This Car</a>
            <a class="stock-btn secondary" href="${item.location === 'uganda' ? 'yusuma-uganda-stock.html' : 'stock-japan.html'}">Back to Stock</a>
          </div>
        </div>
      </div>

      <div class="stock-gallery">
        ${item.gallery.map((src, i) => `
          <img src="${escapeHTML(src)}" alt="${escapeHTML(item.title)}" onclick="openImageViewer(${i})" onerror="stockImageFallback(this)">
        `).join('')}
      </div>

      <div id="imageViewer" class="image-viewer hidden">
        <button class="viewer-close" onclick="closeImageViewer()">×</button>
        <button class="viewer-arrow viewer-prev" onclick="prevViewerImage()">‹</button>
        <img id="viewerImage" src="" alt="Vehicle photo">
        <button class="viewer-arrow viewer-next" onclick="nextViewerImage()">›</button>
      </div>
    </section>
  `;
}

function renderFeesTables(rows){
  const mounts = Array.from(document.querySelectorAll('#feesTable'));
  if (!mounts.length) return;

  mounts.forEach(m => {
    m.innerHTML = '';

    if (!rows || !rows.length){
      m.appendChild(el('div', { class: 'muted small' }, 'Fees are currently unavailable.'));
      return;
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

    const card = document.createElement('div');
    card.className = 'card';
    card.appendChild(el('h3', {}, 'Agency Fee Structure'));
    card.appendChild(table);
    m.appendChild(card);
  });
}

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

  CARJU_STOCK_CACHE = [
    ...cfg.JAPAN_STOCK.map(x => ({ ...x, location: x.location || 'japan' })),
    ...cfg.UGANDA_STOCK.map(x => ({ ...x, location: x.location || 'uganda' }))
  ];

  renderStockBrowse();
  renderStockSliders();
  setupStockSliderControls();
  renderNewArrivals();

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

function toggleService(card){
  if (!card) return;
  const body = card.querySelector('.hidden-text');
  const btn = card.querySelector('.read-more-btn');
  if (!body) return;

  const isOpen = body.classList.toggle('open');
  body.style.display = isOpen ? 'block' : 'none';
  if (btn) btn.textContent = isOpen ? 'Read less' : 'Read more';
}

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

        const msg = [
          `Hi CARJU Japan, I’d like a callback.`,
          `Name: ${name}`,
          `Contact: ${contact}`,
          `Looking for: ${looking}`
        ].join('\n');

        window.open(`https://wa.me/818047909663?text=${encodeURIComponent(msg)}`, '_blank');
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

    const isHidden =
      body.classList.contains('hidden') ||
      body.style.display === 'none' ||
      getComputedStyle(body).display === 'none';

    if (body.classList.contains('hidden')){
      body.classList.toggle('hidden', !isHidden);
    } else if (body.classList.contains('hidden-text')){
      body.classList.toggle('open', isHidden);
      body.style.display = isHidden ? 'block' : 'none';
    } else {
      body.style.display = isHidden ? '' : 'none';
    }

    btn.textContent = isHidden ? 'Read less' : 'Read more';
  });

  document.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('imageViewer');
    if (!viewer || viewer.classList.contains('hidden')) return;

    if (e.key === 'Escape') closeImageViewer();
    if (e.key === 'ArrowRight') nextViewerImage();
    if (e.key === 'ArrowLeft') prevViewerImage();
  });

  buildFromConfig();
});
