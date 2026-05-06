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
    TIKTOK: cfg.TIKTOK || "https://www.tiktok.com/@carju_auto",

    SHEET_ID: cfg.SHEET_ID || "",

    // New two-tab system
    JAPAN_SHEET_TAB: cfg.JAPAN_SHEET_TAB || cfg.SHEET_TAB || "JAPAN_STOCK",
    UGANDA_SHEET_TAB: cfg.UGANDA_SHEET_TAB || "UGANDA_STOCK",

    BRANDS: uniqueList([...DEFAULT_BRANDS, ...(cfg.BRANDS || [])]),
    CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(cfg.CATEGORIES || [])]),

    // Fallbacks
    STOCK: cfg.STOCK || [],
    JAPAN_STOCK: cfg.JAPAN_STOCK || [],
    UGANDA_STOCK: cfg.UGANDA_STOCK || [],
    FEES: cfg.FEES || []
  };
}

/* =========================
   Google Sheet loader
========================= */
async function loadStockFromSheet(tabName, fallbackRows = []){
  const cfg = getConfig();

  if (!cfg.SHEET_ID){
    console.log(`[CARJU] No Sheet ID. Using fallback for ${tabName}.`);
    return fallbackRows || [];
  }

  try {
    const url = `https://opensheet.elk.sh/${cfg.SHEET_ID}/${encodeURIComponent(tabName)}?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok){
      console.warn(`[CARJU] Sheet failed for ${tabName}. Using fallback.`);
      return fallbackRows || [];
    }

    const rows = await res.json();
    console.log(`[CARJU] ${tabName} loaded:`, rows.length);
    return rows || [];
  } catch (err){
    console.warn(`[CARJU] Sheet load error for ${tabName}. Using fallback:`, err);
    return fallbackRows || [];
  }
}

/* =========================
   Stock system
========================= */
var CARJU_STOCK_CACHE = [];
var CURRENT_DETAIL_GALLERY = [];
var CURRENT_DETAIL_INDEX = 0;

function driveToDirect(url){
  if (!url) return "";

  const raw = String(url).trim();

  if (
    raw.startsWith("assets/") ||
    raw.startsWith("./assets/") ||
    raw.startsWith("../assets/") ||
    raw.startsWith("data:image")
  ){
    return raw;
  }

  const match = raw.match(/[-\w]{25,}/);
  if (!match) return raw;

  const id = match[0];
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
}

function splitList(value){
  return String(value || "")
    .split(/[,|]/)
    .map(x => x.trim())
    .filter(Boolean);
}

function normalizeStockItem(item){
  let photos = [];

  if (Array.isArray(item.gallery) && item.gallery.length){
    photos = item.gallery.map(driveToDirect).filter(Boolean);
  } else {
    photos = [
      item.MainImage || item.mainImage || item.ImageURL || item.src,
      item.Photo1,
      item.Photo2,
      item.Photo3,
      item.Photo4,
      item.Photo5,
      item.Photo6,
      item.Photo7,
      item.Photo8,
      item.Photo9,
      item.Photo10
    ].map(driveToDirect).filter(Boolean);
  }

  return {
    id: item.ID || item.id || '',
    location: clean(item.Location || item.location || item.__forcedLocation || ''),
    title: item.Title || item.title || item.name || 'Vehicle',

    manufacturer: item.Manufacturer || item.manufacturer || item.Brand || item.brand || '',
    model: item.Model || item.model || item.Title || item.title || '',
    brand: item.Brand || item.brand || item.Manufacturer || item.manufacturer || '',
    category: item.Category || item.category || '',
    year: item.Year || item.year || '',
    price: item.Price || item.price || 'Ask for Price',

    doors: item.Doors || item.doors || '',
    transmission: item.Transmission || item.transmission || '',
    drivetrain: item.Drivetrain || item.drivetrain || '',
    fuel: item.Fuel || item.fuel || '',
    maintenance: item.Maintenance || item.maintenance || '',

    features: Array.isArray(item.features)
      ? item.features
      : splitList(item.Features || item.features),

    status: item.Status || item.status || '',
    badge: item.Badge || item.badge || '',
    seller: item.Seller || item.seller || '',

    mainImage: driveToDirect(item.MainImage || item.mainImage || photos[0]) || PLACEHOLDER_IMG,
    gallery: photos.length ? photos : [PLACEHOLDER_IMG],

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
  const contactName = item.seller || (item.location === 'uganda' ? 'YUSUMA Enterprises' : 'CARJU JAPAN');
  const message = `Hello ${contactName}, I am interested in this car: ${item.title} ${item.year}. Please share more details.`;
  return `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(message)}`;
}

/* =========================
   Stock cards
========================= */
function renderStockCard(item, compact = false){
  const card = document.createElement('article');
  card.className = compact ? 'stock-card stock-card-compact' : 'stock-card';

  const badgeHtml = item.badge
    ? `<span class="stock-new-badge">${escapeHTML(item.badge)}</span>`
    : '';

  const imagesHtml = item.gallery.map(src => `
    <img src="${escapeHTML(src)}" alt="${escapeHTML(item.title)}" onerror="stockImageFallback(this)">
  `).join('');

  card.innerHTML = `
    <div class="stock-image-wrap">
      ${badgeHtml}
      <div class="stock-card-image-scroll">
        ${imagesHtml}
      </div>
    </div>

    <div class="stock-card-body">
      <span class="stock-badge">${escapeHTML(item.status || (item.location === 'uganda' ? 'Available in Uganda' : 'Available in Japan'))}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <div class="stock-meta">${escapeHTML([item.year, item.brand, item.category, item.seller].filter(Boolean).join(' · '))}</div>
      <div class="stock-price">${escapeHTML(item.price)}</div>
      <div class="stock-actions">
        <a class="stock-btn secondary" href="${stockDetailUrl(item)}">View Details</a>
        <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank">Ask Now</a>
      </div>
    </div>
  `;

  return card;
}

/* =========================
   Render stock sections
========================= */
function renderStockSliders(){
  const items = getStockItems();

  const japanGrid = document.getElementById('japanStockGrid');
  const ugandaGrid = document.getElementById('ugandaStockGrid');

  const japanSection = japanGrid ? japanGrid.closest('.stock-section') : null;
  const ugandaSection = ugandaGrid ? ugandaGrid.closest('.stock-section') : null;

  const japanItems = items.filter(x => x.location === 'japan');
  const ugandaItems = items.filter(x => x.location === 'uganda');

  if (japanGrid){
    japanGrid.innerHTML = '';
    if (!japanItems.length){
      if (japanSection) japanSection.style.display = 'none';
    } else {
      if (japanSection) japanSection.style.display = '';
      japanItems.forEach(item => japanGrid.appendChild(renderStockCard(item)));
    }
  }

/* =========================
   NEW ARRIVALS SYSTEM
========================= */

function getNewArrivals(items, location, limit = 3){
  return items
    .filter(x =>
      x.location === location &&
      (clean(x.badge) === 'new arrival' ||
       (x.features || []).some(f => clean(f) === 'new arrival'))
    )
    .slice(0, limit);
}

function renderNewArrivals(){
  const items = getStockItems();

  const homeMount = document.getElementById('newArrivalsHome');
  const ugandaMount = document.getElementById('newArrivalsUganda');

  // ===== HOMEPAGE (JAPAN) =====
  if (homeMount){
    const japanNew = getNewArrivals(items, 'japan', 3);

    if (!japanNew.length){
      homeMount.style.display = 'none';
    } else {
      homeMount.innerHTML = '';
      japanNew.forEach(item => {
        homeMount.appendChild(renderStockCard(item, true));
      });
    }
  }

  // ===== UGANDA PAGE =====
  if (ugandaMount){
    const ugandaNew = getNewArrivals(items, 'uganda', 3);

    if (!ugandaNew.length){
      ugandaMount.style.display = 'none';
    } else {
      ugandaMount.innerHTML = '';
      ugandaNew.forEach(item => {
        ugandaMount.appendChild(renderStockCard(item, true));
      });
    }
  }
}
  if (ugandaGrid){
    ugandaGrid.innerHTML = '';
    if (!ugandaItems.length){
      if (ugandaSection) ugandaSection.style.display = 'none';
    } else {
      if (ugandaSection) ugandaSection.style.display = '';
      ugandaItems.forEach(item => ugandaGrid.appendChild(renderStockCard(item)));
    }
  }
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

  const pageLocation = isUgandaPage ? 'uganda' : 'japan';

  const pageItems = items.filter(item => item.location === pageLocation);

  const brands = uniqueList(['All', ...pageItems.map(x => x.brand).filter(Boolean), ...getConfig().BRANDS]);
  const cats = uniqueList(['All', ...pageItems.map(x => x.category).filter(Boolean), ...getConfig().CATEGORIES]);

  brandSel.innerHTML = brands.map(b => `<option value="${escapeHTML(b)}">${escapeHTML(b)}</option>`).join('');
  catSel.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

  function updateBrowseGrid(){
    if (locationSel && clean(locationSel.value) === 'uganda' && !isUgandaPage){
      window.location.href = 'yusuma-uganda-stock.html';
      return;
    }

    const brand = clean(brandSel.value || 'All');
    const cat = clean(catSel.value || 'All');

    const filtered = pageItems.filter(item => {
      const brandOk = brand === 'all' || clean(item.brand) === brand;
      const catOk = cat === 'all' || clean(item.category) === cat;
      return brandOk && catOk;
    });

    grid.innerHTML = '';

    if (!filtered.length){
      grid.appendChild(
        el('div', { class: 'muted small' },
          pageLocation === 'uganda'
            ? 'No Uganda stock matches found. Try another filter.'
            : 'No Japan stock matches found. Try another filter.'
        )
      );
      return;
    }

    filtered.forEach(item => grid.appendChild(renderStockCard(item, true)));
  }

  if (locationSel){
    locationSel.addEventListener('change', updateBrowseGrid);
  }

  brandSel.addEventListener('change', updateBrowseGrid);
  catSel.addEventListener('change', updateBrowseGrid);

  if (locationSel){
    locationSel.value = isUgandaPage ? 'uganda' : 'All';
  }

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
}

/* =========================
   Detail page viewer
========================= */
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
  document.getElementById('viewerImage').src = CURRENT_DETAIL_GALLERY[CURRENT_DETAIL_INDEX];
}

function prevViewerImage(){
  if (!CURRENT_DETAIL_GALLERY.length) return;
  CURRENT_DETAIL_INDEX = (CURRENT_DETAIL_INDEX - 1 + CURRENT_DETAIL_GALLERY.length) % CURRENT_DETAIL_GALLERY.length;
  document.getElementById('viewerImage').src = CURRENT_DETAIL_GALLERY[CURRENT_DETAIL_INDEX];
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

  CURRENT_DETAIL_GALLERY = item.gallery;

  const detailBadgeHtml = item.badge
    ? `<span class="stock-new-badge detail-badge">${escapeHTML(item.badge)}</span>`
    : '';

  const featuresHtml = item.features && item.features.length
    ? `<div class="stock-features">${item.features.map(feature => `<span>${escapeHTML(feature)}</span>`).join('')}</div>`
    : '';

  mount.innerHTML = `
    <section class="stock-detail-page">
      <div class="stock-detail-hero">
        <div>
          <img id="mainStockImage" class="stock-main-image" src="${escapeHTML(item.mainImage)}" alt="${escapeHTML(item.title)}" onclick="openImageViewer(0)" onerror="stockImageFallback(this)">
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
            <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank">Ask About This Car</a>
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
   Build page
========================= */
async function buildFromConfig(){
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

  let japanData = [];
let ugandaData = [];

if (
  document.body.classList.contains('uganda-stock-detail') ||
  document.body.classList.contains('yusuma-uganda-stock-page')
){
  ugandaData = await loadStockFromSheet(cfg.UGANDA_SHEET_TAB, cfg.UGANDA_STOCK, 'uganda');
  CARJU_STOCK_CACHE = ugandaData.length ? ugandaData : cfg.UGANDA_STOCK;
} else {
  japanData = await loadStockFromSheet(
    cfg.JAPAN_SHEET_TAB,
    cfg.JAPAN_STOCK.length ? cfg.JAPAN_STOCK : cfg.STOCK,
    'japan'
  );

  CARJU_STOCK_CACHE = japanData.length
    ? japanData
    : (cfg.JAPAN_STOCK.length ? cfg.JAPAN_STOCK : cfg.STOCK);
}

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

  buildFromConfig()
    .then(() => console.log('[CARJU] Stock system initialized.'))
    .catch(err => console.error('[CARJU] buildFromConfig failed:', err));
});
