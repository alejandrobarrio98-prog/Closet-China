// ---- Edit these three lines for your shop ----
const CONFIG = {
  shopName: "Tu Tienda",
  instagramProfileUrl: "https://instagram.com/tu_usuario",
  catalogFile: "catalog.json",
};
// ------------------------------------------------

const catalogEl = document.getElementById("catalog");
const filtersEl = document.getElementById("filters");
const emptyStateEl = document.getElementById("emptyState");
const lastUpdatedEl = document.getElementById("lastUpdated");
const igLinkEl = document.getElementById("igLink");

document.getElementById("shopName").textContent = CONFIG.shopName;
document.title = `${CONFIG.shopName} — Catálogo`;
igLinkEl.href = CONFIG.instagramProfileUrl;

let activeFilter = null;

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
}

function buildFilters(items) {
  const tagCounts = new Map();
  items.forEach((item) => {
    (item.hashtags || []).forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  // Only show tags that appear on more than one item, keeps the bar useful rather than noisy
  const usefulTags = [...tagCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8);

  if (usefulTags.length === 0) return;

  const allChip = makeChip("todo", true);
  allChip.addEventListener("click", () => setFilter(null));
  filtersEl.appendChild(allChip);

  usefulTags.forEach((tag) => {
    const chip = makeChip(tag, false);
    chip.addEventListener("click", () => setFilter(tag));
    filtersEl.appendChild(chip);
  });
}

function makeChip(label, pressed) {
  const btn = document.createElement("button");
  btn.className = "filter-chip";
  btn.textContent = `#${label}`;
  btn.setAttribute("aria-pressed", String(pressed));
  btn.dataset.tag = label === "todo" ? "" : label;
  return btn;
}

function setFilter(tag) {
  activeFilter = tag;
  [...filtersEl.children].forEach((chip) => {
    const isMatch = tag === null ? chip.dataset.tag === "" : chip.dataset.tag === tag;
    chip.setAttribute("aria-pressed", String(isMatch));
  });
  renderCards(window.__catalogItems || []);
}

function renderCards(items) {
  catalogEl.innerHTML = "";
  const visible = activeFilter
    ? items.filter((item) => (item.hashtags || []).includes(activeFilter))
    : items;

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

    if (item.caption) {
      const cap = document.createElement("p");
      cap.className = "caption";
      cap.textContent = item.caption;
      meta.appendChild(cap);
    }

    if (item.hashtags && item.hashtags.length) {
      const tags = document.createElement("p");
      tags.className = "tags";
      tags.textContent = item.hashtags.slice(0, 4).map((t) => `#${t}`).join(" ");
      meta.appendChild(tags);
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
