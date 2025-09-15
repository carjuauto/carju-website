/* ===== Language state ===== */
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

/* ===== Tiny helper ===== */
function el(tag, attrs={}, html=''){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=> n.setAttribute(k,v));
  if(html) n.innerHTML = html;
  return n;
}

/* =========================================================================
   Slider: one-at-a-time with auto-rotate + arrows + dots + pause + swipe
   ========================================================================= */
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

  // Controls
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

/* ===== Build page from config ===== */
function buildFromConfig(){
  const cfg = window.CARJU_CONFIG || {};

  // Socials
  const wa = document.getElementById('wa-link');
  const tk = document.getElementById('tiktok-link');
  if(wa && cfg.WHATSAPP){
    const num = cfg.WHATSAPP.replace(/[^0-9]/g,'');
    wa.href = 'https://wa.me/' + num;
  }
  if(tk && cfg.TIKTOK){
    tk.href = cfg.TIKTOK;
  }

  /* --- Sliders (replace the old buildGallery calls) --- */
  setupSlider('slider-cars', (cfg.GALLERIES && cfg.GALLERIES.cars) || []);
  setupSlider('slider-deliveries', (cfg.GALLERIES && cfg.GALLERIES.deliveries) || []);

  /* --- Brand + Category filter grid (keep this) --- */
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
        const msg = el('div', {class:'muted small'}, 'Add items in config.js → GALLERIES.cars');
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

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.addEventListener('click', ()=> setLang(b.getAttribute('data-lang-btn')));
  });
  setLang(state.lang);
  buildFromConfig();
});
