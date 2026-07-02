// Sincroniza el catálogo desde Instagram. Cada semana:
//  1. Baja todos los posts publicados actualmente (los archivados no aparecen).
//  2. Descarta los anteriores al 1 de enero de 2025.
//  3. Para cada post, intenta leer TIPO DE PRENDA y TALLA del caption.
//  4. Si al final del paso 3 aún no hay tipo, llama a Claude Haiku 4.5 con la foto.
//  5. Guarda todo en catalog.json — cacheando por id del post para no reclasificar
//     las mismas fotos cada semana.
//
// Requiere:
//   IG_USER_ID, IG_ACCESS_TOKEN                  → siempre
//   ANTHROPIC_API_KEY                            → solo si hay posts nuevos por clasificar

import { writeFile, readFile } from "node:fs/promises";
import { parseCaption } from "./parse-caption.mjs";
import { classifyImage } from "./classify-image.mjs";

const IG_USER_ID = process.env.IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
  console.error("Faltan IG_USER_ID o IG_ACCESS_TOKEN.");
  process.exit(1);
}

const FIELDS = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const BASE_URL = `https://graph.instagram.com/${IG_USER_ID}/media`;
const CATALOG_FILE = "catalog.json";
const CUTOFF_DATE = new Date("2025-01-01T00:00:00Z");

async function fetchAllMedia() {
  let url = `${BASE_URL}?fields=${FIELDS}&access_token=${IG_ACCESS_TOKEN}&limit=50`;
  const items = [];

  while (url) {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message} (code ${data.error.code})`);
    }

    items.push(...(data.data || []));

    // Optimización: si el post más viejo de esta página ya es anterior a 2025,
    // no hace falta seguir paginando hacia atrás.
    const oldest = items[items.length - 1];
    if (oldest && new Date(oldest.timestamp) < CUTOFF_DATE) break;

    url = data.paging?.next || null;
  }

  return items;
}

function extractHashtags(caption = "") {
  const matches = caption.match(/#[\p{L}0-9_]+/gu) || [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

function stripHashtags(caption = "") {
  return caption.replace(/#[\p{L}0-9_]+/gu, "").replace(/\s{2,}/g, " ").trim();
}

// Carga el catálogo previo si existe, para reusar clasificaciones anteriores.
async function loadExistingCache() {
  try {
    const raw = await readFile(CATALOG_FILE, "utf-8");
    const data = JSON.parse(raw);
    const cache = new Map();
    for (const item of data.items || []) {
      if (item.id && !item.id.startsWith("sample_")) {
        cache.set(item.id, {
          clothingType: item.clothingType,
          classificationSource: item.classificationSource,
        });
      }
    }
    return cache;
  } catch {
    return new Map();
  }
}

async function main() {
  console.log("Descargando media de Instagram...");
  const rawItems = await fetchAllMedia();

  const filtered = rawItems.filter((item) => {
    const isRecent = new Date(item.timestamp) >= CUTOFF_DATE;
    const isImage = item.media_type !== "VIDEO";
    return isRecent && isImage;
  });

  console.log(`Posts desde 2025 (sin videos): ${filtered.length}`);

  const cache = await loadExistingCache();
  console.log(`Clasificaciones cacheadas de sincronizaciones previas: ${cache.size}`);

  const items = [];
  let newlyClassified = 0;
  let apiErrors = 0;

  for (const item of filtered) {
    const caption = item.caption || "";
    const { clothingType: typeFromCaption, talla } = parseCaption(caption);

    let clothingType = typeFromCaption;
    let classificationSource = typeFromCaption ? "caption" : null;

    if (!clothingType && cache.has(item.id)) {
      const cached = cache.get(item.id);
      clothingType = cached.clothingType;
      classificationSource = cached.classificationSource;
    }

    if (!clothingType) {
      const imageUrl = item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url;
      try {
        console.log(`Clasificando post ${item.id} con Claude...`);
        clothingType = await classifyImage(imageUrl, ANTHROPIC_API_KEY);
        classificationSource = "vision";
        newlyClassified++;
      } catch (err) {
        console.error(`No se pudo clasificar ${item.id}: ${err.message}`);
        clothingType = null;
        classificationSource = null;
        apiErrors++;
      }
    }

    items.push({
      id: item.id,
      image: item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url,
      permalink: item.permalink,
      caption: stripHashtags(caption),
      hashtags: extractHashtags(caption),
      timestamp: item.timestamp,
      clothingType,
      classificationSource,
      talla,
    });
  }

  await writeFile(
    CATALOG_FILE,
    JSON.stringify({ updated: new Date().toISOString(), items }, null, 2)
  );

  const fromCaption = items.filter((i) => i.classificationSource === "caption").length;
  const fromVisionTotal = items.filter((i) => i.classificationSource === "vision").length;
  const fromVisionCached = fromVisionTotal - newlyClassified;
  const unclassified = items.filter((i) => !i.clothingType).length;

  console.log(`Total en catalog.json: ${items.length}`);
  console.log(`  - clasificadas desde el caption: ${fromCaption}`);
  console.log(`  - clasificadas por visión (cache): ${fromVisionCached}`);
  console.log(`  - clasificadas por visión (nuevas): ${newlyClassified}`);
  console.log(`  - sin clasificar: ${unclassified}`);
  if (apiErrors > 0) {
    console.log(`  ⚠ errores de API: ${apiErrors}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
