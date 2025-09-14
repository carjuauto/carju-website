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

function el(tag, attrs={}, html=''){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=> n.setAttribute(k,v));
  if(html) n.innerHTML = html;
  return n;
}

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

  // Galleries (named)
  const buildGallery = (id, items)=>{
    const wrap = document.getElementById(id);
    if(!wrap) return;
    wrap.innerHTML = '';
    if(items && items.length){
      items.forEach(it=>{
        const fig = el('figure');
        const img = el('img', { loading:'lazy', src: it.src, alt: it.name || it.model || '' });
        const cap = el('figcaption', {}, [
          it.name ? `<strong>${it.name}</strong>` : '',
          it.brand ? ` — ${it.brand}` : '',
          it.category ? ` · ${it.category}` : '',
          it.year ? ` (${it.year})` : ''
        ].join(''));
        fig.appendChild(img); fig.appendChild(cap);
        wrap.appendChild(fig);
      });
    } else {
      for(let i=0;i<8;i++){
        const ph = el('div', {class:'placeholder'}, 'Add images via config.js');
        wrap.appendChild(ph);
      }
    }
  };
  buildGallery('gallery-cars', (cfg.GALLERIES && cfg.GALLERIES.cars) || []);
  buildGallery('gallery-deliveries', (cfg.GALLERIES && cfg.GALLERIES.deliveries) || []);

  // Brand + Category filter grid
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

document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('[data-lang-btn]').forEach(b=>{
    b.addEventListener('click', ()=> setLang(b.getAttribute('data-lang-btn')));
  });
  setLang(state.lang);
  buildFromConfig();
});
