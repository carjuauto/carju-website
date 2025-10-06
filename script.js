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
function clean(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function formatJPY(val){
  if(val === undefined || val === null) return '';
  if (typeof val === 'number' && !Number.isNaN(val)){
    return new Intl.NumberFormat('ja-JP', { style:'currency', currency:'JPY', maximumFractionDigits:0 }).format(val);
  }
  const num = Number(String(val).replace(/[^\d.-]/g,''));
  if(!Number.isFinite(num)) return String(val);
  return new Intl.NumberFormat('ja-JP', { style:'currency', currency:'JPY', maximumFractionDigits:0 }).format(num);
}
const PLACEHOLDER_IMG = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'><rect width='100%' height='100%' fill='%23f3f3f3'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='18'>Image unavailable</text></svg>`;

/* =========================
   Google Drive helpers
   ========================= */
function driveToDirect(u){
  if(!u) return u;
  try{
    const idMatch = String(u).match(/[-\w]{25,}/);
    if(!idMatch) return u;
    const id = idMatch[0];
    const candidates = [
      `https://drive.google.com/uc?export=view&id=${id}`,
      `https://drive.google.com/thumbnail?id=${id}&sz=w1600`,
      `https://lh3.googleusercontent.com/d/${id}=w1600`
    ];
    return candidates[0] + `#gdcandidates=${encodeURIComponent(JSON.stringify(candidates))}`;
  }catch(e){ return u; }
}
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

/* =========================
   Google Sheets integration
   ========================= */
const SHEET_ID = "1vRa9U4sMmZDWdh4pp4Gkig53XUmGr1mFxIB24Zcj_UE";
const SHEET_CARS_TAB = "Cars";
const SHEET_DELIVERIES_TAB = "Deliveries";
const SHEET_FEES_TAB = "Fees";
const DEFAULT_BRANDS = ["Toyota","Honda","Nissan","Mazda","Subaru","Mitsubishi","Suzuki","Daihatsu","Isuzu","Hino","Lexus"];
const DEFAULT_CATEGORIES = ["Sedan","SUV","Truck","Van","Wagon","Bus","Pickup","Hybrid/EV","Motorcycle"];

function mapCarRow(r){
  const year = r.Year && String(r.Year).trim() ? Number(r.Year) : undefined;
  return { name:(r.Name||"").trim(), brand:(r.Brand||"").trim(), category:(r.Category||"").trim(), year:isNaN(year)?undefined:year, src:(r.ImageURL||"").trim(), MarketPrice:r.MarketPrice };
}
function mapDeliveryRow(r){ return { name:(r.Caption||"").trim(), src:(r.ImageURL||"").trim() }; }
async function fetchSheetJSON(tabName){
  if(!SHEET_ID) return [];
  const url = `https://opensheet.elk.sh/${SHEET_ID}/${encodeURIComponent(tabName)}?t=${Date.now()}`;
  const res = await fetch(url,{cache:'no-store'});
  if(!res.ok) return [];
  return await res.json();
}
async function loadContent(){
  try {
    if(SHEET_ID){
      const [carsRows, deliveriesRows, feesRows] = await Promise.all([
        fetchSheetJSON(SHEET_CARS_TAB),
        fetchSheetJSON(SHEET_DELIVERIES_TAB),
        fetchSheetJSON(SHEET_FEES_TAB)
      ]);
      const cars = (carsRows||[]).map(mapCarRow).filter(x=>x.src);
      const deliveries = (deliveriesRows||[]).map(mapDeliveryRow).filter(x=>x.src);
      const brands = uniqueList([...DEFAULT_BRANDS,...cars.map(r=>r.brand)]);
      const categories = uniqueList([...DEFAULT_CATEGORIES,...cars.map(r=>r.category)]);
      return { WHATSAPP:"+81 80 4790 9663", TIKTOK:"https://www.tiktok.com/@yourhandle", BRANDS:brands, CATEGORIES:categories, GALLERIES:{cars,deliveries}, FEES:feesRows||[] };
    }
  }catch(e){ console.warn("Sheets load failed:",e); }
  return { WHATSAPP:"", TIKTOK:"", BRANDS:DEFAULT_BRANDS, CATEGORIES:DEFAULT_CATEGORIES, GALLERIES:{cars:[],deliveries:[]}, FEES:[] };
}

/* =========================
   Build & Events
   ========================= */
async function buildFromConfig(){
  const cfg = await loadContent();
  const wa = document.getElementById('wa-link');
  const tk = document.getElementById('tiktok-link');
  if(wa && cfg.WHATSAPP){ const num=String(cfg.WHATSAPP).replace(/[^0-9]/g,''); if(num) wa.href='https://wa.me/'+num; }
  if(tk && cfg.TIKTOK){ tk.href = cfg.TIKTOK; }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-lang-btn]').forEach(b=> b.addEventListener('click',()=> setLang(b.getAttribute('data-lang-btn'))));
  setLang(state.lang);
  buildFromConfig();

  // === MOBILE NAV ===
  const nav=document.getElementById('siteNav');
  const navBtn=document.getElementById('navToggle');
  if(nav && navBtn){
    navBtn.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      navBtn.setAttribute('aria-expanded',open?'true':'false');
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      if(nav.classList.contains('open')){nav.classList.remove('open');navBtn.setAttribute('aria-expanded','false');}
    }));
  }

  // === WHY CHOOSE CARJU – READ MORE ===
  document.addEventListener('click',(e)=>{
    const btn=e.target.closest('.read-more');
    if(!btn) return;
    e.preventDefault();
    const card=btn.closest('.point');
    const body=card?card.querySelector('.hidden-text'):null;
    if(!body) return;
    const isOpen=body.classList.toggle('open');
    btn.textContent=isOpen?'Read less':'Read more';
    if(isOpen && window.matchMedia('(max-width:860px)').matches){
      setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'start'}),120);
    }
  });

  // === REQUEST CALLBACK BUTTON ===
  const callbackBtn=document.querySelector('.request-callback');
  if(callbackBtn){
    callbackBtn.addEventListener('click',(e)=>{
      e.preventDefault();
      let modal=document.getElementById('callbackModal');
      if(!modal){
        modal=document.createElement('div');
        modal.id='callbackModal';
        modal.innerHTML=`
          <div class="modal-overlay"></div>
          <div class="modal-content">
            <h3>Request a Callback</h3>
            <p>Leave your name & contact. We’ll reach out soon.</p>
            <input type="text" placeholder="Your Name" style="width:100%;margin-bottom:8px;">
            <input type="text" placeholder="Your WhatsApp / Email" style="width:100%;margin-bottom:8px;">
            <button id="closeModal" style="background:#e63946;color:#fff;padding:8px 12px;border:none;border-radius:5px;">Close</button>
          </div>`;
        document.body.appendChild(modal);
        const css=document.createElement('style');
        css.textContent=`
          #callbackModal{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;z-index:9999;}
          #callbackModal .modal-overlay{position:absolute;width:100%;height:100%;background:rgba(0,0,0,0.6);}
          #callbackModal .modal-content{position:relative;background:#fff;padding:20px;border-radius:10px;max-width:360px;width:90%;z-index:2;box-shadow:0 4px 12px rgba(0,0,0,0.2);}
        `;
        document.head.appendChild(css);
      }
      modal.style.display='flex';
      modal.querySelector('.modal-overlay').addEventListener('click',()=>modal.style.display='none');
      modal.querySelector('#closeModal').addEventListener('click',()=>modal.style.display='none');
    });
  }

  console.log('[CARJU] Page ready — interactivity loaded.');
});
