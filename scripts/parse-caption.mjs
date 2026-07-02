// Extrae metadatos estructurados desde el caption de un post de Instagram.
// Todo lo que se pueda leer del texto se lee acá; solo si el "tipo de prenda"
// queda vacío, más tarde se manda la foto al clasificador visual.

// Diccionario de tipos de prenda. La clave es el nombre canónico que aparece
// en el sitio; los valores son las variantes (singular/plural, con/sin tilde,
// diminutivos comunes en español peruano) que podrías escribir en un caption.
const CLOTHING_TYPES = {
  vestido: ["vestido", "vestidos", "vestidito", "vestiditos"],
  blusa: ["blusa", "blusas", "blusita", "blusitas", "camisa", "camisas", "camisita", "camisitas"],
  polo: ["polo", "polos", "polito", "politos", "playera", "playeras", "camiseta", "camisetas", "t-shirt", "tshirt"],
  top: ["top", "tops", "crop", "crop top", "croptop"],
  pantalon: ["pantalón", "pantalon", "pantalones", "pantaloncito", "pantaloncitos", "jean", "jeans"],
  falda: ["falda", "faldas", "faldita", "falditas", "pollera", "polleras"],
  short: ["short", "shorts", "shortcito", "shortcitos"],
  casaca: ["casaca", "casacas", "casaquita", "casaquitas", "chaqueta", "chaquetas", "chaquetita", "chompa", "chompas", "chompita", "chompitas", "sweater", "sweaters", "cárdigan", "cardigan"],
  abrigo: ["abrigo", "abrigos", "abriguito", "abriguitos", "trench"],
  enterizo: ["enterizo", "enterizos", "mono", "monos", "jumpsuit"],
  conjunto: ["conjunto", "conjuntos", "conjuntito", "conjuntitos", "set", "sets"],
  ropa_interior: ["bikini", "bikinis", "lencería", "lenceria", "brasier", "sujetador", "top deportivo"],
};

// Formatos de talla soportados:
//  "talla S", "talla: M", "T. L", "size XL", "T-38", "talla 38", "talla única"
// Usamos límites explícitos (espacios/puntuación) en vez de \b porque \b en JS
// trata las vocales acentuadas como no-palabra, causando falsos positivos como
// matchear "S" dentro de "súper".
const BOUNDARY_BEFORE = "(?:^|[\\s.,;:!?()\\-])";
const BOUNDARY_AFTER = "(?=$|[\\s.,;:!?()\\-])";
const TALLA_LETRAS = new RegExp(
  `${BOUNDARY_BEFORE}(?:t(?:alla)?[\\s.:-]*)?(XXS|XS|S|M|L|XL|XXL|XXXL)${BOUNDARY_AFTER}`,
  "i"
);
const TALLA_NUMERO = new RegExp(
  `${BOUNDARY_BEFORE}t(?:alla)?[\\s.:-]*(2[0-9]|3[0-9]|4[0-9]|5[0-9])${BOUNDARY_AFTER}`,
  "i"
);
const TALLA_UNICA = /talla\s+[úu]nica/i;

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function parseClothingType(caption) {
  if (!caption) return null;
  const normalized = normalize(caption);

  // Recolectamos TODAS las coincidencias y elegimos la que aparezca antes en el
  // texto. Esto arregla el caso "Casaca de jean" (donde antes ganaba "pantalón"
  // solo porque estaba primero en el diccionario).
  const matches = [];

  for (const [canonical, variants] of Object.entries(CLOTHING_TYPES)) {
    for (const variant of variants) {
      const normalizedVariant = normalize(variant);
      const pattern = new RegExp(
        `(?:^|[^a-z0-9])${normalizedVariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
        "i"
      );
      const match = normalized.match(pattern);
      if (match) {
        matches.push({ canonical, position: match.index });
      }
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => a.position - b.position);
  return matches[0].canonical;
}

export function parseTalla(caption) {
  if (!caption) return null;

  if (TALLA_UNICA.test(caption)) return "única";

  const numMatch = caption.match(TALLA_NUMERO);
  if (numMatch) return numMatch[1];

  const letterMatch = caption.match(TALLA_LETRAS);
  if (letterMatch) return letterMatch[1].toUpperCase();

  return null;
}

export function parseCaption(caption) {
  return {
    clothingType: parseClothingType(caption),
    talla: parseTalla(caption),
  };
}
