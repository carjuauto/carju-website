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

/* =========================
   Google Sheets integration
   ========================= */
/** ✅ YOUR SHEET ID (from the link you sent) **/
const SHEET_ID = "1vRa9U4sMmZDWdh4pp4Gkig53XUmGr1mFxIB24Zcj_UE";
/** Tab names (must match your sheet tabs exactly) **/
const SHEET_CARS_TAB = "Cars";            // columns: Name | Brand | Category | Year | ImageURL
const SHEET_DELIVERIES_TAB = "Deliveries"; // columns: Caption | ImageURL

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
    src: (r.ImageURL || "").trim()
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
  // 1) Try Google Sheets
  try {
    if(SHEET_ID){
      const [carsRows, deliveriesRows] = await Promise.all([
        fetchSheetJSON(SHEET_CARS_TAB),
        fetchSheetJSON(SHEET_DELIVERIES_TAB)
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
        GALLERIES: { cars, deliveries }
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
        GALLERIES: { cars: json.cars || [], deliveries: json.deliveries || [] }
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
    }
  };
}

/* =========================
   Slider (one-at-a-time)
   ========================= */
function setupSlider(containerId, items, intervalMs = 6000){
  const wrap = document.getElementById(containerId);
  if(!wrap || !items || !items.length){ return; }

  const fig = wrap.querySelector('figure');
  const img = fig.querySelector('img');
  const cap = fig.querySelector('figcaption');
  const prevBtn = wrap.querySelector('.slider-arrow.prev');
  const nextBtn = wrap.querySelector('.slider-arrow.next');
  const dotsWrap = wrap.querySelector('.slider-dots');

  let i = 0;
  let timer = null;

  function htmlCaption(it){
    return [
      it.name ? `<strong>${it.name}</strong>` : '',
      it.brand ? ` — ${it.brand}` : '',
      it.category ? ` · ${it.category}` : '',
      it.year ? ` (${it.year})` : ''
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

  function render(idx, animate=true){
    const it = items[idx];
    if(!it) return;
    if(animate){
      img.classList.remove('slide-enter','slide-exit');
      img.classList.add('slide-exit');
      setTimeout(()=>{
        img.classList.remove('slide-exit');
        img.src = it.src;
        img.alt = it.name || it.brand || it.category || 'Image';
        cap.innerHTML = htmlCaption(it);
        img.classList.add('slide-enter');
        setTimeout(()=> img.classList.remove('slide-enter'), 520);
      }, 200);
    }else{
      img.src = it.src;
      img.alt = it.name || it.brand || it.category || 'Image';
      cap.innerHTML = htmlCaption(it);
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

  // Sliders
  setupSlider('slider-cars', (cfg.GALLERIES && cfg.GALLERIES.cars) || []);
  setupSlider('slider-deliveries', (cfg.GALLERIES && cfg.GALLERIES.deliveries) || []);

  // Brand + Category filters (grid preview)
  const brands = cfg.BRANDS || [];
  const cats = cfg.CATEGORIES || [];
  const items = (cfg.GALLERIES && cfg.GALLERIES.cars) || [];

  const brandSel = document.getElementById('brandSelect');
  const catSel = document.getElementById('categorySelect');
  const grid = document.getElementById('brandGrid');

  if(brandSel && catSel && grid){
    brandSel.innerHTML = ['All', ...brands].map(b=>`<option value="${b}">${b}</option>`).join('');
    catSel.innerHTML = ['All', ...cats].map(c=>`<option value="${c}">${c}</option>`).join('');

    const render = ()=>{
      const b = brandSel.value;
      const c = catSel.value;
      grid.innerHTML = '';
      const filtered = items.filter(it=>{
        const brandOk = (b==='All' || it.brand===b);
        const catOk = (c==='All' || it.category===c);
        return brandOk && catOk;
      });
      const show = filtered.length ? filtered : items.slice(0,6);
      show.slice(0,12).forEach(it=>{
        const card = el('div', {class:'card'});
        const title = it.name || `${it.brand||''} ${it.category||''}`.trim() || 'Vehicle';
        card.innerHTML = `
          <h3>${title}</h3>
          <p>${[it.brand, it.category, it.year].filter(Boolean).join(' · ') || 'Models & images coming soon.'}</p>
          ${it.src ? `<img src="${it.src}" alt="${title}" loading="lazy" style="width:100%;height:160px;object-fit:cover;border-radius:10px;border:1px solid #eee;margin-top:6px">` : ''}
        `;
        grid.appendChild(card);
      });
      if(!items.length){
        const msg = el('div', {class:'muted small'}, 'Add items in Google Sheets (Cars tab) or in data/content.json');
        grid.appendChild(msg);
      }
    };
    brandSel.addEventListener('change', render);
    catSel.addEventListener('change', render);
    if(brands.length) brandSel.value = 'All';
    if(cats.length) catSel.value = 'All';
    render();
  }
}

/* =========================
   Init
   ========================= */
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.addEventListener('click', ()=> setLang(b.getAttribute('data-lang-btn')));
  });
  setLang(state.lang);
  buildFromConfig();
});
document.addEventListener('DOMContentLoaded', () => {
  const popup = document.getElementById('promo-popup');
  const closeBtn = document.getElementById('promo-close');

  if (popup && closeBtn) {
    // Show only once per session (per tab)
    if (!sessionStorage.getItem('promoShown')) {
      setTimeout(() => {
        popup.classList.remove('hidden');
        sessionStorage.setItem('promoShown', 'true');
      }, 2000); // shows after 2 seconds
    }

    closeBtn.addEventListener('click', () => {
      popup.classList.add('hidden');
    });

    // Optional: click outside box to close
    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.classList.add('hidden');
    });

    // Optional: Esc to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') popup.classList.add('hidden');
    });
  }
});
