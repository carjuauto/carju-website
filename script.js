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
function el(tag, attrs={}, html=''){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=> n.setAttribute(k,v));
  if(html) n.innerHTML = html;
  return n;
}
function uniqueList(arr){ return [...new Set((arr||[]).filter(Boolean))]; }
function shuffle(arr){ return [...arr].sort(()=>Math.random()-0.5); }
function pick(arr, n){ return arr.length <= n ? arr.slice() : shuffle(arr).slice(0, n); }

// Normalize strings for matching (trim + lowercase + collapse spaces)
function clean(s){
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Simple JPY formatter (keeps whatever you typed if it’s already text)
function formatJPY(val){
  if(val === undefined || val === null) return '';
  if (typeof val === 'number' && !Number.isNaN(val)){
    return new Intl.NumberFormat('ja-JP', { style:'currency', currency:'JPY', maximumFractionDigits:0 }).format(val);
  }
  const num = Number(String(val).replace(/[^\d.-]/g,''));
  if(!Number.isFinite(num)) return String(val);
  return new Intl.NumberFormat('ja-JP', { style:'currency', currency:'JPY', maximumFractionDigits:0 }).format(num);
}

// Small inline placeholder used when an image fails to load
const PLACEHOLDER_IMG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='100%' height='100%' fill='%23f3f3f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='18'>Image unavailable</text></svg>`;

/* =========================
   Google Drive helpers
   ========================= */
// Convert any Google Drive link into a direct image candidate list
function driveToDirect(u){
  if(!u) return u;
  try{
    const idMatch = String(u).match(/[-\w]{25,}/);
    if(!idMatch) return u; // not a Drive URL
    const id = idMatch[0];
    const candidates = [
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
      `https://lh3.googleusercontent.com/d/${id}=w1600`
    ];
    // attach candidates list in the hash so onerror can try next
    return candidates[0] + `#gdcandidates=${encodeURIComponent(JSON.stringify(candidates))}`;
  }catch(e){ return u; }
}

// If an image fails, try the next candidate URL
function tryNextDriveCandidate(imgEl){
  try{
    const hash = imgEl.src.split('#gdcandidates=')[1];
    if(!hash) return false;
    const list = JSON.parse(decodeURIComponent(hash));
    const current = imgEl.src.split('#')[0];
    const idx = list.findIndex(x => current.startsWith(x.split('#')[0]));
    const next = list[idx+1];
    if(next){
      imgEl.src = next + `#gdcandidates=${encodeURIComponent(JSON.stringify(list))}`;
      return true;
    }
  }catch(e){}
  return false;
}

// Normalize one car/delivery item (keep original fields + normalized copies)
function normalizeItem(it){
  const brand = (it.brand || it.Brand || '').trim();
  const category = (it.category || it.Category || '').trim();
  const year = it.year ?? it.Year ?? '';
  // MarketPrice can be a number or text (handle both)
  const marketPriceRaw = it.MarketPrice ?? it.marketPrice ?? it.Price ?? '';
  let marketPriceNum = Number(String(marketPriceRaw).replace(/[^\d.-]/g,''));
  if(!Number.isFinite(marketPriceNum)) marketPriceNum = undefined;

  return {
    ...it,
    brand, category, year,
    src: driveToDirect(it.src || it.ImageURL || ''),
    _brand: brand.toLowerCase(),
    _cat: category.toLowerCase(),
    _brandClean: clean(brand),
    _catClean: clean(category),
    marketPriceRaw,
    marketPriceNum
  };
}

/* =========================
   Google Sheets integration
   ========================= */
/** ✅ YOUR SHEET ID **/
const SHEET_ID = "1vRa9U4sMmZDWdh4pp4Gkig53XUmGr1mFxIB24Zcj_UE";
/** Tab names (must match your sheet tabs exactly) **/
const SHEET_CARS_TAB = "Cars";            // columns: Name | Brand | Category | Year | ImageURL | MarketPrice
const SHEET_DELIVERIES_TAB = "Deliveries"; // columns: Caption | ImageURL
const SHEET_FEES_TAB = "Fees";             // any columns; will render dynamically

// Master lists so dropdowns never shrink even if the sheet has few entries
const DEFAULT_BRANDS = [
  "Toyota","Honda","Nissan","Mazda","Subaru","Mitsubishi","Suzuki","Daihatsu","Isuzu","Hino","Lexus",
  "UD Trucks","Scania","Volvo","BMW","Mercedes-Benz","Audi","Volkswagen","Porsche","Maserati","Yamaha","Kawasaki"
];
const DEFAULT_CATEGORIES = [
  "Sedan","Hatchback","SUV","Truck","Van","Wagon","Coupe","Convertible","Hybrid/EV",
  "Machinery","Agricultural","Bus","Mini Bus","Pickup","Heavy Machinery","Construction Equipment","Motorcycle"
];

function mapCarRow(r){
  const year = r.Year && String(r.Year).trim() ? Number(r.Year) : undefined;
  return {
    name: (r.Name || "").trim(),
    brand: (r.Brand || "").trim(),
    category: (r.Category || "").trim(),
    year: isNaN(year) ? undefined : year,
    src: (r.ImageURL || "").trim(),
    MarketPrice: r.MarketPrice // keep raw; normalize later
  };
}
function mapDeliveryRow(r){
  return { name: (r.Caption || "").trim(), src: (r.ImageURL || "").trim() };
}
async function fetchSheetJSON(tabName){
  if(!SHEET_ID) return [];
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(tabName)}?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) return [];
  return await res.json();
}

/* =========================
   Content loader with fallbacks
   ========================= */
async function loadContent(){
  // 1) Try Google Sheets (Cars, Deliveries, Fees)
  try {
    if(SHEET_ID){
      const [carsRows, deliveriesRows, feesRows] = await Promise.all([
        fetchSheetJSON(SHEET_CARS_TAB),
        fetchSheetJSON(SHEET_DELIVERIES_TAB),
        fetchSheetJSON(SHEET_FEES_TAB)
      ]);
      const cars = (carsRows || []).map(mapCarRow).filter(x => x.src);
      const deliveries = (deliveriesRows || []).map(mapDeliveryRow).filter(x => x.src);

      const brands = uniqueList([...DEFAULT_BRANDS, ...cars.map(r => r.brand || r.Brand)]);
      const categories = uniqueList([...DEFAULT_CATEGORIES, ...cars.map(r => r.category || r.Category)]);

      return {
        WHATSAPP: "+81 80 4790 9663",
        TIKTOK: "https://www.tiktok.com/@yourhandle",
        BRANDS: brands,
        CATEGORIES: categories,
        GALLERIES: { cars, deliveries },
        FEES: feesRows || []
      };
    }
  } catch (e) {
    console.warn("Sheets load failed, will fallback:", e);
  }

  // 2) Fallback to local JSON (data/content.json)
  try {
    const res = await fetch('/data/content.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return {
        WHATSAPP: json.WHATSAPP || "",
        TIKTOK: json.TIKTOK || "",
        BRANDS: uniqueList([...DEFAULT_BRANDS, ...(json.BRANDS || [])]),
        CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(json.CATEGORIES || [])]),
        GALLERIES: { cars: json.cars || [], deliveries: json.deliveries || [] },
        FEES: json.FEES || []
      };
    }
  } catch (e) { /* continue */ }

  // 3) Final fallback to window.CARJU_CONFIG
  const cfg = window.CARJU_CONFIG || {};
  return {
    WHATSAPP: cfg.WHATSAPP || "",
    TIKTOK: cfg.TIKTOK || "",
    BRANDS: uniqueList([...DEFAULT_BRANDS, ...(cfg.BRANDS || [])]),
    CATEGORIES: uniqueList([...DEFAULT_CATEGORIES, ...(cfg.CATEGORIES || [])]),
    GALLERIES: {
      cars: (cfg.GALLERIES && cfg.GALLERIES.cars) || [],
      deliveries: (cfg.GALLERIES && cfg.GALLERIES.deliveries) || []
    },
    FEES: cfg.FEES || []
  };
}

/* =========================
   Slider (one-at-a-time)
   ========================= */
function setupSlider(containerId, items, intervalMs = 6000){
  const wrap = document.getElementById(containerId);
  if(!wrap || !items || !items.length){ return; }

  const fig = wrap.querySelector('figure');
  const img = fig ? fig.querySelector('img') : null;
  const cap = fig ? fig.querySelector('figcaption') : null;
  const prevBtn = wrap.querySelector('.slider-arrow.prev');
  const nextBtn = wrap.querySelector('.slider-arrow.next');
  const dotsWrap = wrap.querySelector('.slider-dots');

  if(!img || !cap) return;

  let i = 0;
  let timer = null;

  function htmlCaption(it){
    const priceTxt = it.marketPriceNum || it.marketPriceRaw ? ` · ${formatJPY(it.marketPriceNum ?? it.marketPriceRaw)}` : '';
    return [
      it.name ? `<strong>${it.name}</strong>` : '',
      it.brand ? ` — ${it.brand}` : '',
      it.category ? ` · ${it.category}` : '',
      it.year ? ` (${it.year})` : '',
      priceTxt
    ].join('');
  }

  function buildDots(){
    if(!dotsWrap) return;
    dotsWrap.innerHTML = '';
    items.forEach((_, idx)=>{
      const b = document.createElement('button');
      b.className = 'slider-dot';
      b.setAttribute('aria-label', `Go to slide ${idx+1}`);
      b.addEventListener('click', ()=>{ goTo(idx); resetTimer(); });
      dotsWrap.appendChild(b);
    });
  }
  function updateDots(){
    if(!dotsWrap) return;
    Array.from(dotsWrap.children).forEach((d, idx)=>{
      d.classList.toggle('active', idx === i);
    });
  }

  // Render with Drive support
  function render(idx, animate = true){
    const it = items[idx];
    if(!it || !img || !cap) return;

    const src   = driveToDirect(it.src || it.ImageURL || '');
    const title = it.name || it.brand || it.category || 'Image';

    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';

    img.onerror = () => {
      if (!tryNextDriveCandidate(img)) {
        img.onerror = null;
        img.src = PLACEHOLDER_IMG;
      }
    };

    const apply = () => {
      img.src = src;
      img.alt = title;
      cap.innerHTML = htmlCaption(it);
    };

    if (animate){
      img.classList.remove('slide-enter','slide-exit');
      img.classList.add('slide-exit');
      setTimeout(()=>{
        img.classList.remove('slide-exit');
        apply();
        img.classList.add('slide-enter');
        setTimeout(()=> img.classList.remove('slide-enter'), 520);
      }, 200);
    } else {
      apply();
    }

    updateDots();
  }

  function goTo(idx){ i = (idx + items.length) % items.length; render(i, true); }
  function next(){ goTo(i + 1); }
  function prev(){ goTo(i - 1); }

  function startTimer(){ stopTimer(); timer = setInterval(next, intervalMs); }
  function stopTimer(){ if(timer){ clearInterval(timer); timer = null; } }
  function resetTimer(){ stopTimer(); startTimer(); }

  if(prevBtn) prevBtn.addEventListener('click', ()=>{ prev(); resetTimer(); });
  if(nextBtn) nextBtn.addEventListener('click', ()=>{ next(); resetTimer(); });

  // Pause on hover (desktop)
  wrap.addEventListener('mouseenter', stopTimer);
  wrap.addEventListener('mouseleave', startTimer);

  // Swipe (mobile)
  let startX = null;
  wrap.addEventListener('touchstart', (e)=>{ startX = e.touches[0].clientX; }, {passive:true});
  wrap.addEventListener('touchend', (e)=>{
    if(startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if(Math.abs(dx) > 40){ dx < 0 ? next() : prev(); resetTimer(); }
    startX = null;
  }, {passive:true});

  // Init
  buildDots();
  render(i, false);
  startTimer();
}

/* =========================
   FEES renderer (supports <div id="feesTable"> OR <table id="feesTable">, multiple)
   ========================= */
function renderFeesTables(rows){
  const mounts = Array.from(document.querySelectorAll('#feesTable'));
  if(!mounts.length) return;

  // Build a table node from rows
  const buildTableNode = ()=>{
    if(!rows.length){
      const d = el('div', {class:'muted small'}, 'Fees: sheet tab is empty or unavailable.');
      return d;
    }
    const headers = Object.keys(rows[0] || {});
    const table = document.createElement('table');
    table.className = 'table';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    headers.forEach(h=>{
      const th = document.createElement('th');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      headers.forEach(h=>{
        const td = document.createElement('td');
        const val = r[h];
        if (typeof val === 'string' && /price|fee|amount|jpy/i.test(h)){
          td.textContent = formatJPY(val);
        } else {
          td.textContent = val ?? '';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  };

  mounts.forEach(m=>{
    // If the mount is already a <table>, rebuild its thead/tbody directly
    if (m.tagName && m.tagName.toLowerCase() === 'table'){
      m.innerHTML = '';
      const built = buildTableNode();
      if (built && built.tagName && built.tagName.toLowerCase() === 'table'){
        m.innerHTML = built.innerHTML; // copy sections into existing table
      } else {
        // fallback if rows empty
        const d = document.createElement('caption');
        d.textContent = 'No data.';
        m.appendChild(d);
      }
    } else {
      // Mount is a div/container
      m.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card';
      card.appendChild(el('h3', {}, 'Agency Fee Structure'));
      const tableNode = buildTableNode();
      card.appendChild(tableNode);
      m.appendChild(card);
    }
  });
}

/* =========================
   Build page from config
   ========================= */
async function buildFromConfig(){
  const cfg = await loadContent();

  // Socials
  const wa = document.getElementById('wa-link');
  const tk = document.getElementById('tiktok-link');
  if(wa && cfg.WHATSAPP){
    const num = String(cfg.WHATSAPP).replace(/[^0-9]/g,'');
    if(num) wa.href = 'https://wa.me/' + num;
  }
  if(tk && cfg.TIKTOK){
    tk.href = cfg.TIKTOK;
  }

  // Normalize images (Drive) for sliders
  const carsForSlider = ((cfg.GALLERIES && cfg.GALLERIES.cars) || []).map(normalizeItem);
  const deliveriesForSlider = ((cfg.GALLERIES && cfg.GALLERIES.deliveries) || []).map(normalizeItem);

  setupSlider('slider-cars', carsForSlider);
  setupSlider('slider-deliveries', deliveriesForSlider);

  // Brand + Category filters (grid preview)
  const itemBrands = uniqueList(carsForSlider.map(it => (it.brand || '').trim()).filter(Boolean));
  const itemCats   = uniqueList(carsForSlider.map(it => (it.category || '').trim()).filter(Boolean));
  const brands     = uniqueList([ 'All', ...itemBrands, ...(cfg.BRANDS || []) ]);
  const cats       = uniqueList([ 'All', ...itemCats,   ...(cfg.CATEGORIES || []) ]);

  // normalized list with _brand/_cat for reliable matching
  const items  = carsForSlider.map(x => ({...x}));

  const brandSel = document.getElementById('brandSelect');
  const catSel   = document.getElementById('categorySelect');
  const grid     = document.getElementById('brandGrid');

  if(brandSel && catSel && grid){
    brandSel.innerHTML = brands.map(b=>`<option value="${b}">${b}</option>`).join('');
    catSel.innerHTML   = cats.map(c=>`<option value="${c}">${c}</option>`).join('');

    const renderGrid = ()=>{
      const bVal = clean(brandSel.value || 'All');
      const cVal = clean(catSel.value   || 'All');
      grid.innerHTML = '';

      const filtered = items.filter(it=>{
        const brandOk = (bVal === 'all') || (it._brandClean === bVal);
        const catOk   = (cVal === 'all') || (it._catClean   === cVal);
        return brandOk && catOk;
      });

      // Show up to 6, shuffled
      const source = (bVal === 'all' && cVal === 'all') ? items : filtered;
      const show = pick(source, 6);

      if (!show.length){
        const msg = el('div', {class:'muted small'}, 'No matches. Try a different Brand/Category.');
        grid.appendChild(msg);
        return;
      }

      show.forEach(it=>{
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cursor = 'pointer';

        const title = it.name || `${it.brand||''} ${it.category||''}`.trim() || 'Vehicle';

        const h3 = document.createElement('h3');
        h3.textContent = title;
        card.appendChild(h3);

        // meta line + optional market price line
        const meta = document.createElement('p');
        meta.textContent = [it.brand, it.category, it.year].filter(Boolean).join(' · ')
          || 'Models & images coming soon.';
        card.appendChild(meta);

        if (it.marketPriceNum || it.marketPriceRaw){
          const price = document.createElement('p');
          price.style.marginTop = '4px';
          price.style.fontWeight = '600';
          price.textContent = `Market price: ${formatJPY(it.marketPriceNum ?? it.marketPriceRaw)}`;
          card.appendChild(price);
        }

        if (it.src) {
          const imgEl = document.createElement('img');
          imgEl.src = it.src;
          imgEl.alt = title;
          imgEl.loading = 'lazy';
          imgEl.decoding = 'async';
          imgEl.referrerPolicy = 'no-referrer';
          imgEl.style.width = '100%';
          imgEl.style.height = '160px';
          imgEl.style.objectFit = 'cover';
          imgEl.style.borderRadius = '10px';
          imgEl.style.border = '1px solid #eee';
          imgEl.style.marginTop = '6px';

          imgEl.onerror = () => {
            if (!tryNextDriveCandidate(imgEl)) {
              imgEl.onerror = null;
              imgEl.src = PLACEHOLDER_IMG;
            }
          };

          card.appendChild(imgEl);
        }

        // Click-to-inquire
        card.addEventListener('click', ()=>{
          const brand = it.brand || '';
          const category = it.category || '';
          const year = it.year || '';
          const cleanTitle = it.name || `${brand} ${category} ${year}`.trim();

          const priceBit = (it.marketPriceNum || it.marketPriceRaw) ? ` (current market ~ ${formatJPY(it.marketPriceNum ?? it.marketPriceRaw)})` : '';
          const message = `Hi CARJU Japan, I'm interested in a ${brand} ${category} ${year}${priceBit}. Could you please confirm availability and advise me on the next steps?`;
          const whats = `https://wa.me/818047909663?text=${encodeURIComponent(message)}`;
          const mail  = `mailto:carjuautoagency@gmail.com?subject=${encodeURIComponent('Vehicle Inquiry: '+cleanTitle)}&body=${encodeURIComponent(message)}`;

          if (confirm('Send inquiry via WhatsApp? (Cancel = Email)')) {
            window.open(whats, '_blank');
          } else {
            window.location.href = mail;
          }
        });

        grid.appendChild(card);
      });
    };

    brandSel.addEventListener('change', renderGrid);
    catSel.addEventListener('change', renderGrid);
    brandSel.value = 'All';
    catSel.value   = 'All';
    renderGrid();
  }

  /* ===== Fees table (any page that has it) ===== */
  if (cfg.FEES && cfg.FEES.length){
    renderFeesTables(cfg.FEES);
  }
}
/* ===== Scroll Reveal (generic) ===== */
function initScrollReveal(selector, columns = 3, baseDelay = 80){
  const els = Array.from(document.querySelectorAll(selector));
  if (!els.length) return;

  // Mark all as reveal targets (idempotent)
  els.forEach(el => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)){
    els.forEach(el => el.classList.add('in-view'));
    return;
    }

  // Simple stagger: delay by column index on desktop-ish
  els.forEach((el, i) => {
    const col = i % Math.max(1, columns);
    el.style.transitionDelay = (col * baseDelay) + 'ms';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: .15, rootMargin: '0px 0px -8% 0px' });

  els.forEach(el => io.observe(el));
}

/* ===== Modal (image preview + actions) ===== */
function ensureModal(){
  if (document.getElementById('carju-modal')) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.id = 'carju-modal';
  wrap.innerHTML = `
    <div class="modal glass">
      <div class="modal-header">
        <div class="modal-title" id="carju-modal-title"></div>
        <button class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">
        <img id="carju-modal-img" alt="">
        <p id="carju-modal-meta" class="muted" style="margin:8px 2px 0"></p>
        <div class="modal-actions">
          <a id="carju-modal-wa" class="btn" target="_blank" rel="noopener">Ask on WhatsApp</a>
          <a id="carju-modal-mail" class="btn secondary">Ask by Email</a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // Close handlers
  const close = () => wrap.classList.remove('open');
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelector('.modal-close').addEventListener('click', close);
}

function openImageModal(item){
  ensureModal();
  const wrap = document.getElementById('carju-modal');
  const titleEl = document.getElementById('carju-modal-title');
  const imgEl   = document.getElementById('carju-modal-img');
  const metaEl  = document.getElementById('carju-modal-meta');
  const waEl    = document.getElementById('carju-modal-wa');
  const mailEl  = document.getElementById('carju-modal-mail');

  const brand = item.brand || '';
  const category = item.category || '';
  const year = item.year || '';
  const title = item.name || `${brand} ${category} ${year}`.trim() || 'Vehicle';
  const priceBit = (item.marketPriceNum || item.marketPriceRaw)
    ? ` · Market ~ ${formatJPY(item.marketPriceNum ?? item.marketPriceRaw)}`
    : '';

  titleEl.textContent = title;
  imgEl.src = item.src || item.ImageURL || '';
  imgEl.alt = title;
  metaEl.textContent = [brand, category, year].filter(Boolean).join(' · ') + priceBit;

  const message = `Hi CARJU Japan, I'm interested in a ${brand} ${category} ${year}${priceBit}. Could you please confirm availability and advise me on the next steps?`;
  waEl.href = `https://wa.me/818047909663?text=${encodeURIComponent(message)}`;
  mailEl.href = `mailto:carjuautoagency@gmail.com?subject=${encodeURIComponent('Vehicle Inquiry: '+title)}&body=${encodeURIComponent(message)}`;

  wrap.classList.add('open');
}
/* =========================
   INIT (language + data + promo + UI wiring)
   ========================= */
document.addEventListener('DOMContentLoaded', () => {
  // language buttons
  document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.addEventListener('click', ()=> setLang(b.getAttribute('data-lang-btn')));
  });
  setLang(state.lang);

  // Mobile nav toggle (index/services share IDs)
  const nav = document.getElementById('siteNav');
  const navBtn = document.getElementById('navToggle');
  if (nav && navBtn) {
    navBtn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close menu when a link is clicked (mobile)
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (nav.classList.contains('open')) {
          nav.classList.remove('open');
          navBtn.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // Request a Callback (index page hero right card)
  // Works with your current markup: .hero-panel inputs + its .btn
  const heroPanel = document.querySelector('.hero-panel');
  if (heroPanel){
    const nameEl = heroPanel.querySelector('input[type="text"]');
    const contactEl = heroPanel.querySelector('input[type="email"]');
    const selectEl = heroPanel.querySelector('select');
    const cbBtn = heroPanel.querySelector('.btn');

    if (cbBtn){
      cbBtn.addEventListener('click', (e)=>{
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

        // Ask user which channel
        if (confirm('Send via WhatsApp? (Cancel = Email)')){
          const msg = `Hi CARJU Japan, I’d like a callback.\nName: ${name}\nContact: ${contact}\nLooking for: ${looking}`;
          window.open(`https://wa.me/818047909663?text=${encodeURIComponent(msg)}`, '_blank');
        } else {
          window.location.href = `mailto:carjuautoagency@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      });
    }
  }

  // === Why Choose CARJU: Read more / Read less (index + services) ===
document.addEventListener('click', (e) => {
  // match <a class="read-more">, <a class="why-more"> or anything with [data-expand]
  const btn = e.target.closest('.read-more, .why-more, [data-expand]');
  if (!btn) return;

  e.preventDefault(); // stop "#" links from jumping to top

  const card = btn.closest('.why-item, .point, article');
  if (!card) return;

  // your HTML uses <div class="more hidden"> … </div>
  // (also works if a page uses .hidden-text/open instead)
  const body = card.querySelector('.more') || card.querySelector('.hidden-text');
  if (!body) return;

  if (body.classList.contains('hidden')) {
    // .more.hidden → show
    body.classList.remove('hidden');
    btn.textContent = 'Read less';
  } else if (body.classList.contains('hidden-text')) {
    // animated variant
    body.classList.toggle('open');
    btn.textContent = body.classList.contains('open') ? 'Read less' : 'Read more';
  } else {
    // plain div fallback (no classes)
    const shown = body.style.display !== 'none';
    body.style.display = shown ? 'none' : '';
    btn.textContent = shown ? 'Read more' : 'Read less';
  }

  // smooth scroll when opening on mobile
  if (window.matchMedia('(max-width: 860px)').matches) {
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }
});

  // Sticky promo bar
  const promoBar = document.getElementById('promo-bar');
  const promoBarClose = document.getElementById('promo-bar-close');
  if (promoBar) {
    promoBar.classList.remove('hidden');
    if (promoBarClose) {
      promoBarClose.addEventListener('click', () => {
        promoBar.classList.add('hidden');
      });
    }
  }

  // Build dynamic content (sheets/config)
  buildFromConfig().catch(err=>{
    console.error('[CARJU] buildFromConfig failed:', err);
  });

  // Safety: if selects are still empty after 1s, fill with defaults so UI never looks broken
  setTimeout(() => {
    const brandSel = document.getElementById('brandSelect');
    const catSel   = document.getElementById('categorySelect');
    const grid     = document.getElementById('brandGrid');

    if (brandSel && brandSel.options.length === 0) {
      brandSel.innerHTML = ['All', ...DEFAULT_BRANDS].map(b=>`<option value="${b}">${b}</option>`).join('');
    }
    if (catSel && catSel.options.length === 0) {
      catSel.innerHTML = ['All', ...DEFAULT_CATEGORIES].map(c=>`<option value="${c}">${c}</option>`).join('');
    }
    if (grid && grid.children.length === 0) {
      const msg = el('div', {class:'muted small'}, 'Add items in Google Sheets (Cars tab) or in data/content.json');
      grid.appendChild(msg);
    }
  }, 1000);

  console.log('[CARJU] DOM ready → buildFromConfig() invoked.');
});


