document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.CARJU_CONFIG || {};
  const stock = cfg.STOCK || [];

  const brandSel = document.getElementById("stockBrandSelect");
  const catSel = document.getElementById("stockCategorySelect");
  const browseGrid = document.getElementById("stockBrowseGrid");
  const japanGrid = document.getElementById("japanStockGrid");
  const ugandaGrid = document.getElementById("ugandaStockGrid");

  function esc(v){ return String(v || ""); }

  function card(item){
    const detailPage = item.location === "uganda"
      ? `stock-uganda-detail.html?id=${item.id}`
      : `stock-japan-detail.html?id=${item.id}`;

    const msg = encodeURIComponent(`Hello ${item.seller || "CARJU JAPAN"}, I am interested in ${item.title}. Please share more details.`);
    const whats = `https://wa.me/${String(item.whatsapp || "818047909663").replace(/[^0-9]/g,"")}?text=${msg}`;

    return `
      <article class="stock-card">
        <div class="stock-image-wrap">
          ${item.badge ? `<span class="stock-new-badge">${esc(item.badge)}</span>` : ""}
          <img src="${esc(item.mainImage)}" alt="${esc(item.title)}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22400%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23f3f3f3%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2218%22>Image unavailable</text></svg>'">
        </div>
        <div class="stock-card-body">
          <span class="stock-badge">${esc(item.status)}</span>
          <h3>${esc(item.title)}</h3>
          <div class="stock-meta">${esc([item.year, item.brand, item.category, item.seller].filter(Boolean).join(" · "))}</div>
          <div class="stock-price">${esc(item.price || "Ask for Price")}</div>
          <div class="stock-actions">
            <a class="stock-btn secondary" href="${detailPage}">View Details</a>
            <a class="stock-btn" href="${whats}" target="_blank">Ask Now</a>
          </div>
        </div>
      </article>
    `;
  }

  const brands = ["All", ...new Set([...(cfg.BRANDS || []), ...stock.map(x => x.brand).filter(Boolean)])];
  const cats = ["All", ...new Set([...(cfg.CATEGORIES || []), ...stock.map(x => x.category).filter(Boolean)])];

  if (brandSel) brandSel.innerHTML = brands.map(b => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
  if (catSel) catSel.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");

  function renderBrowse(){
    if (!browseGrid) return;

    const loc = document.getElementById("stockLocationSelect")?.value || "All";
    const brand = brandSel?.value || "All";
    const cat = catSel?.value || "All";

    const filtered = stock.filter(item => {
      return (loc === "All" || item.location === loc) &&
             (brand === "All" || item.brand === brand) &&
             (cat === "All" || item.category === cat);
    });

    browseGrid.innerHTML = filtered.length
      ? filtered.map(card).join("")
      : `<div class="muted small">No stock matches found.</div>`;
  }

  function renderSliders(){
    if (japanGrid){
      const japan = stock.filter(x => x.location === "japan");
      japanGrid.innerHTML = japan.map(card).join("");
      const section = japanGrid.closest(".stock-section");
      if (section && japan.length === 0) section.style.display = "none";
    }

    if (ugandaGrid){
      const uganda = stock.filter(x => x.location === "uganda");
      ugandaGrid.innerHTML = uganda.map(card).join("");
      const section = ugandaGrid.closest(".stock-section");
      if (section && uganda.length === 0) section.style.display = "none";
    }
  }

  document.getElementById("stockLocationSelect")?.addEventListener("change", renderBrowse);
  brandSel?.addEventListener("change", renderBrowse);
  catSel?.addEventListener("change", renderBrowse);

  renderBrowse();
  renderSliders();

  console.log("stock-fix.js loaded. Stock count:", stock.length);
});
