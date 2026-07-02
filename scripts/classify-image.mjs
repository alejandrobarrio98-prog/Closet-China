// Envía UNA foto a Claude Haiku 4.5 y le pide clasificar el tipo de prenda.
// Solo se llama para posts donde el parser de caption no encontró un tipo,
// y solo para posts que todavía no están cacheados en catalog.json.
// Costo aprox: $0.0013 por foto (a los precios oficiales de Haiku 4.5, junio 2026).

const MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Los tipos válidos que puede devolver el modelo. Deben coincidir 1:1 con las
// claves de CLOTHING_TYPES en parse-caption.mjs para que los filtros del sitio
// funcionen sin importar de dónde vino la clasificación.
const VALID_TYPES = [
  "vestido", "blusa", "polo", "top", "pantalon", "falda",
  "short", "casaca", "abrigo", "enterizo", "conjunto", "ropa_interior",
];

const SYSTEM_PROMPT = `Eres un asistente que clasifica fotos de prendas de ropa para un catálogo online.

Debes elegir UNA sola categoría de esta lista exacta:
${VALID_TYPES.join(", ")}, otro

Reglas:
- Si en la foto hay más de una prenda, elige la que más destaca o la principal.
- Si la foto no muestra una prenda con claridad (por ejemplo es una foto de perfil, un flyer, o un texto), responde "otro".
- "pantalon" incluye jeans y pantalones de tela.
- "casaca" incluye chompas, sweaters, cardigans y chaquetas.
- "top" es un top corto o crop; una blusa completa va en "blusa".
- "conjunto" es cuando venden dos piezas juntas como set.

Responde ÚNICAMENTE con el nombre de la categoría, en minúsculas, sin ninguna otra palabra ni explicación.`;

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la imagen: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return {
    data: Buffer.from(buffer).toString("base64"),
    mediaType: contentType.split(";")[0].trim(),
  };
}

export async function classifyImage(imageUrl, apiKey) {
  if (!apiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY para clasificar imágenes.");
  }

  const { data, mediaType } = await fetchImageAsBase64(imageUrl);

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 20,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data },
            },
            {
              type: "text",
              text: "¿Qué tipo de prenda es esta?",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const body = await res.json();
  const raw = body.content?.[0]?.text?.trim().toLowerCase() || "";

  // Normalizamos: la respuesta debería ser una sola palabra de la lista.
  // Si el modelo escribe algo extra, tomamos la primera coincidencia válida.
  const found = VALID_TYPES.find((t) => raw.includes(t));
  if (found) return found;
  if (raw.includes("otro")) return "otro";

  // Si la respuesta no encaja con ninguna categoría conocida, marcamos como
  // "otro" para no romper el sitio. Se puede reclasificar luego si hace falta.
  return "otro";
}
