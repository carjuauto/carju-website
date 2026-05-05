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
  "Toyota","Honda","Nissan","Mazda","Subaru","Mitsubishi","Suzuki","Daihatsu","Isuzu","Hino","Lexus"
];

const DEFAULT_CATEGORIES = [
  "Sedan","Hatchback","SUV","Truck","Van","Wagon","Hybrid/EV","Machinery"
];

function getConfig(){
  const cfg = window.CARJU_CONFIG || {};
  return {
    WHATSAPP: cfg.WHATSAPP || "+81 80 4790 9663",
    TIKTOK: cfg.TIKTOK || "",
    BRANDS: uniqueList([...DEFAULT_BRANDS, ...(cfg.BRANDS || [])]),
    CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(cfg.CATEGORIES || [])]),
    STOCK: cfg.STOCK || [],
    FEES: cfg.FEES || []
  };
}

/* =========================
   Stock system
   ========================= */
function normalizeStockItem(item){
  return {
    id: item.id || '',
    location: clean(item.location || ''),
    title: item.title || 'Vehicle',

    manufacturer: item.manufacturer || item.brand || '',
    model: item.model || item.title || '',
    brand: item.brand || '',
    category: item.category || '',
    year: item.year || '',
    price: item.price || 'Ask for Price',

    doors: item.doors || '',
    transmission: item.transmission || '',
    drivetrain: item.drivetrain || '',
    fuel: item.fuel || '',
    maintenance: item.maintenance || '',

    features: Array.isArray(item.features) ? item.features : [],

    status: item.status || '',
    seller: item.seller || '',
    mainImage: item.mainImage || PLACEHOLDER_IMG,
    gallery: item.gallery && item.gallery.length ? item.gallery : [item.mainImage || PLACEHOLDER_IMG],
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
  const contactName = item.seller || "CARJU JAPAN";
  const message = `Hello ${contactName}, I am interested in this car: ${item.title} ${item.year}. Please share more details.`;
  return `https://wa.me/${item.whatsapp}?text=${encodeURIComponent(message)}`;
}

function renderStockCard(item){
  const card = document.createElement('article');
  card.className = 'stock-card';

  card.innerHTML = `
    <img src="${escapeHTML(item.mainImage)}" onerror="stockImageFallback(this)">
    <div class="stock-card-body">
      <span class="stock-badge">${item.status}</span>
      <h3>${item.title}</h3>
      <div class="stock-meta">${item.year} · ${item.seller}</div>
      <div class="stock-price">${item.price}</div>
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

/* =========================
   DETAIL PAGE (FIXED)
   ========================= */
function getStockIdFromUrl(){
  return new URLSearchParams(window.location.search).get('id');
}

function renderStockDetailPage(expectedLocation){
  const mount = document.getElementById("stockDetailMount");
  if (!mount) return;

  const item = getStockItems().find(
    x => x.id === getStockIdFromUrl() && x.location === expectedLocation
  );

  if (!item){
    mount.innerHTML = `<h2>Car not found</h2>`;
    return;
  }

  const featuresHtml = item.features.length
    ? `<div class="stock-features">${item.features.map(f => `<span>${f}</span>`).join("")}</div>`
    : "";

  mount.innerHTML = `
    <div class="stock-detail-page">
      <img id="mainStockImage" src="${item.mainImage}" class="stock-main-image" onerror="stockImageFallback(this)">

      <h1>${item.title}</h1>
      <p>${item.description}</p>

      ${featuresHtml}

      <ul class="stock-detail-list">
        <li><b>Manufacturer:</b> ${item.manufacturer}</li>
        <li><b>Model:</b> ${item.model}</li>
        <li><b>Year:</b> ${item.year}</li>
        <li><b>Doors:</b> ${item.doors}</li>
        <li><b>Transmission:</b> ${item.transmission}</li>
        <li><b>Fuel:</b> ${item.fuel}</li>
        <li><b>Drivetrain:</b> ${item.drivetrain}</li>
        <li><b>Maintenance:</b> ${item.maintenance}</li>
      </ul>

      <a class="stock-btn" href="${stockWhatsAppUrl(item)}" target="_blank">
        Ask About This Car
      </a>

      <div class="stock-gallery">
        ${item.gallery.map(img => `
          <img src="${img}" onclick="document.getElementById('mainStockImage').src='${img}'">
        `).join("")}
      </div>
    </div>
  `;
}

/* =========================
   INIT
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  setLang(state.lang);

  renderStockSliders();

  if (document.body.classList.contains('japan-stock-detail')){
    renderStockDetailPage('japan');
  }

  if (document.body.classList.contains('uganda-stock-detail')){
    renderStockDetailPage('uganda');
  }
});
