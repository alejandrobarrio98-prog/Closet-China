# Catálogo desde Instagram

Un sitio estático simple que muestra tu catálogo de ropa leyendo `catalog.json`,
un archivo que se actualiza solo una vez por semana jalando datos de tu cuenta de
Instagram y clasificando cada prenda automáticamente. Cuando archivas un post en
Instagram (porque se vendió), automáticamente deja de aparecer en el sitio la
próxima vez que se sincroniza — no hace falta borrar nada a mano.

**Alcance del catálogo**: solo posts publicados desde el 1 de enero de 2025 en adelante.

**Clasificación de prendas**:
- **Tipo de prenda** — primero se busca en el caption (vestido, blusa, pantalón,
  casaca, etc., incluyendo diminutivos como "vestidito" o "chompita"). Si no
  aparece, se envía la foto a Claude Haiku 4.5 (IA con visión) que la clasifica.
- **Talla** — solo se lee del caption. Si no está escrita, la prenda queda sin
  talla (nunca se adivina).

**Costo total mensual**: $0 en hosting. Solo se paga por las clasificaciones
visuales (~$0.0013 por foto nueva sin tipo en el caption), y solo una vez por foto
gracias al cache. Para un catálogo típico de 200-400 fotos: menos de $1 total.

---

## Cómo funciona

```
Instagram  →  fetch-instagram.mjs  →  parse-caption.mjs  →  classify-image.mjs  →  catalog.json  →  sitio web
              (una vez por semana,      (talla y tipo         (solo para posts
               vía GitHub Actions)       desde el texto)       nuevos sin tipo)
```

No hay servidor corriendo todo el tiempo. Una vez por semana, un robot de GitHub
descarga tus posts publicados, filtra los de 2025+, y para cada uno decide si
puede clasificarlo con solo el caption o si necesita ayuda de la IA. Los resultados
se guardan en `catalog.json` y se cachean por ID de post, así que la IA solo
clasifica **posts nuevos** — nunca vuelve a analizar los mismos.

---

## Paso 1 — Convierte tu cuenta a Profesional

La API de Instagram **no funciona con cuentas personales**. Necesitas una cuenta
de tipo Business o Creator (es gratis y toma un par de minutos):

`Instagram → Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional`

---

## Paso 2 — Crea una app en Meta for Developers

1. Entra a [developers.facebook.com](https://developers.facebook.com) con tu cuenta
   de Facebook (o créala si no tienes) y crea una nueva app de tipo **Business**.
2. Dentro de la app, agrega el producto **"Instagram API"** usando el flujo de
   **Instagram Login** (no el de Facebook Login) — esa es la versión que **no** te
   pide tener una Página de Facebook vinculada, y es la más simple para una sola
   cuenta como la tuya.
3. En la sección de **Roles / Instagram testers** de la app, agrégate a ti misma
   (tu usuario de Instagram) como *tester*. Luego, desde la app de Instagram en tu
   celular, acepta la invitación: `Configuración → Apps y sitios web → Invitaciones`.

   Esto es importante: mientras la app esté en **modo desarrollo** (el modo por
   defecto) y tú seas tester de tu propia app, puedes generar tokens y leer tus
   propios datos sin pasar por el proceso de revisión de Meta ("App Review").

4. Genera un **token de acceso** para tu cuenta desde el panel de la app. Ese
   primer token dura ~1 hora.

---

## Paso 3 — Cambia el token corto por uno de larga duración

Ese token de 1 hora no sirve para algo semanal. Cámbialo por uno de 60 días:

```bash
curl -i -X GET "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=<APP_SECRET>&access_token=<TOKEN_CORTO>"
```

Y para conseguir tu **user id**:

```bash
curl -i -X GET "https://graph.instagram.com/me?fields=id,username&access_token=<TOKEN_LARGO>"
```

---

## Paso 4 — Consigue tu API key de Claude (para clasificar imágenes)

Este es un producto separado de claude.ai. Necesitas una cuenta aparte con su
propia facturación. Es rápido:

1. Entra a [platform.claude.com](https://platform.claude.com) y crea cuenta
   (puedes usar el mismo login que tienes en Claude).
2. En **Plans & Billing**, agrega una tarjeta y compra créditos iniciales.
   Con **$5 sobra de sobra** para clasificar cientos de fotos — cada foto
   cuesta aproximadamente $0.0013 con Haiku 4.5. Puedes poner un tope mensual
   bajo (ej. $2) para dormir tranquila.
3. En **Settings → API Keys → Create Key**, ponle un nombre como "catalogo-tienda"
   y **cópialo inmediatamente** — solo se muestra una vez. Empieza con `sk-ant-`.

---

## Paso 5 — Sube este proyecto a GitHub y configura los secretos

Ya tienes el repo `Closet-China` creado. Solo faltan 3 secretos:

`Settings → Secrets and variables → Actions → New repository secret`

| Nombre               | Valor                                            |
|----------------------|---------------------------------------------------|
| `IG_USER_ID`         | el id que obtuviste en el paso 3                 |
| `IG_ACCESS_TOKEN`    | el token largo (60 días) del paso 3              |
| `ANTHROPIC_API_KEY`  | el API key del paso 4 (empieza con `sk-ant-`)   |

Estos nunca quedan visibles en el código ni en el sitio.

---

## Paso 6 — Activa el sitio (ya lo tienes hecho ✅)

GitHub Pages ya está activo. Cada vez que el robot actualice `catalog.json`,
el sitio se vuelve a publicar solo.

---

## Paso 7 — Corre la primera sincronización

En la pestaña **Actions** del repositorio → abre **"Sync catalog from Instagram"** →
**"Run workflow"**. En un minuto o dos verás un commit nuevo con tu `catalog.json`
real, y el sitio mostrará tus prendas clasificadas.

Después corre solo, todos los lunes.

---

## Personalizar

En `app.js`, edita las primeras líneas:

```js
const CONFIG = {
  shopName: "Closet-China",
  instagramProfileUrl: "https://instagram.com/tu_usuario",
  catalogFile: "catalog.json",
};
```

**Para agregar nuevos tipos de prenda** (ej. si vendes bufandas): edita el diccionario
`CLOTHING_TYPES` en `scripts/parse-caption.mjs` (agrega el tipo canónico y sus
variantes/diminutivos), y también agrégalo a la lista `VALID_TYPES` en
`scripts/classify-image.mjs` y a `TYPE_LABELS` en `app.js` (para la etiqueta bonita
en el filtro).

---

## Sobre el vencimiento del token de Instagram

El token largo dura **60 días**. Si se vence, la sincronización semanal empezará
a fallar (GitHub te avisará por correo si un workflow falla).

Cada ~45 días, corre este comando con tu token actual y reemplaza el secreto
`IG_ACCESS_TOKEN` en GitHub con el resultado:

```bash
curl -i -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<TOKEN_ACTUAL>"
```

Ponte un recordatorio en el calendario.

---

## Estimación de costos con IA

| Escenario                                      | Costo aproximado |
|------------------------------------------------|------------------|
| 200 fotos totales, 50% con tipo en el caption  | ~$0.13 (una vez) |
| 400 fotos totales, 30% con tipo en el caption  | ~$0.36 (una vez) |
| 10 fotos nuevas por semana, sin tipo en caption | ~$0.05 al mes    |

Todo esto es de una sola vez por foto. La IA no vuelve a analizar fotos ya
clasificadas gracias al cache.
