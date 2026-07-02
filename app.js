// ---- Edita estas líneas para tu tienda ----
const CONFIG = {
  shopName: "Closet-China",
  instagramProfileUrl: "https://instagram.com/tu_usuario",
  catalogFile: "catalog.json",
};
// --------------------------------------------

// Etiquetas legibles para los tipos de prenda internos.
// La clave debe coincidir con clothingType tal como sale del parser / clasificador.
const TYPE_LABELS = {
  vestido: "Vestidos",
  blusa: "Blusas",
  polo: "Polos",
  top: "Tops",
  pantalon: "Pantalones",
  falda: "Faldas",
  short: "Shorts",
  casaca: "Casacas",
  abrigo: "Abrigos",
  enterizo: "Enterizos",
  conjunto: "Conjuntos",
  ropa_interior: "Ropa interior",
  otro: "Otros",
};

const catalogEl = document.getElementById("catalog");
const filtersEl = document.getElementById("filters");
const emptyStateEl = document.getElementById("emptyState");
const lastUpdatedEl = document.getElementById("lastUpdated");
const igLinkEl = document.getElementById("igLink");

document.getElementById("shopName").textContent = CONFIG.shopName;
document.title = `${CONFIG.shopName} — Catálogo`;
igLinkEl.href = CONFIG.instagramProfileUrl;

// Estado del filtro activo. { kind: "type"|"tag"|null, value: string|null }
let activeFilter = { kind: null, value: null };

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

function labelForType(type) {
  return TYPE_LABELS[type] || type;
}

function buildFilters(items) {
  filtersEl.innerHTML = "";

  // Chip "todo"
  const allChip = makeChip("Todo", { kind: null, value: null }, true);
  filtersEl.appendChild(allChip);

  // Filtros por tipo de prenda (los que realmente aparecen en el catálogo)
  const typeCounts = new Map();
  items.forEach((item) => {
    if (item.clothingType && item.clothingType !== "otro") {
      typeCounts.set(item.clothingType, (typeCounts.get(item.clothingType) || 0) + 1);
    }
  });

  const types = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  types.forEach((type) => {
    const chip = makeChip(labelForType(type), { kind: "type", value: type }, false);
    filtersEl.appendChild(chip);
  });
}

function makeChip(label, filter, pressed) {
  const btn = document.createElement("button");
  btn.className = "filter-chip";
  btn.textContent = label;
  btn.setAttribute("aria-pressed", String(pressed));
  btn.dataset.kind = filter.kind || "";
  btn.dataset.value = filter.value || "";
  btn.addEventListener("click", () => setFilter(filter));
  return btn;
}

function setFilter(filter) {
  activeFilter = filter;
  [...filtersEl.children].forEach((chip) => {
    const isMatch =
      chip.dataset.kind === (filter.kind || "") &&
      chip.dataset.value === (filter.value || "");
    chip.setAttribute("aria-pressed", String(isMatch));
  });
  renderCards(window.__catalogItems || []);
}

function itemMatchesFilter(item, filter) {
  if (!filter.kind) return true;
  if (filter.kind === "type") return item.clothingType === filter.value;
  if (filter.kind === "tag") return (item.hashtags || []).includes(filter.value);
  return true;
}

function renderCards(items) {
  catalogEl.innerHTML = "";
  const visible = items.filter((item) => itemMatchesFilter(item, activeFilter));

  emptyStateEl.hidden = visible.length > 0;

  visible.forEach((item) => {
    const card = document.createElement("a");
    card.className = "tag-card";
    card.href = item.permalink;
    card.target = "_blank";
    card.rel = "noopener";

    const hole = document.createElement("span");
    hole.className = "hole";
    card.appendChild(hole);

    const frame = document.createElement("div");
    frame.className = "frame";

    const img = document.createElement("img");
    img.className = "photo";
    img.src = item.image;
    img.alt = item.caption ? item.caption.slice(0, 120) : "Prenda disponible";
    img.loading = "lazy";
    frame.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "meta";

    // Fila de detalles: tipo + talla
    const details = document.createElement("p");
    details.className = "details";
    const detailBits = [];
    if (item.clothingType && item.clothingType !== "otro") {
      detailBits.push(labelForType(item.clothingType));
    }
    if (item.talla) {
      detailBits.push(`Talla ${item.talla}`);
    }
    if (detailBits.length) {
      details.textContent = detailBits.join(" · ");
      meta.appendChild(details);
    }

    if (item.caption) {
      const cap = document.createElement("p");
      cap.className = "caption";
      cap.textContent = item.caption;
      meta.appendChild(cap);
    }

    frame.appendChild(meta);
    card.appendChild(frame);
    catalogEl.appendChild(card);
  });
}

async function init() {
  try {
    const res = await fetch(CONFIG.catalogFile, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo leer ${CONFIG.catalogFile}`);
    const data = await res.json();
    const items = (data.items || []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    window.__catalogItems = items;
    buildFilters(items);
    renderCards(items);

    if (data.updated) {
      lastUpdatedEl.textContent = `Actualizado el ${formatDate(data.updated)}`;
    }
  } catch (err) {
    console.error(err);
    emptyStateEl.hidden = false;
    emptyStateEl.textContent =
      "No se pudo cargar el catálogo todavía. Si acabas de configurar el sitio, revisa el README.";
  }
}

init();
