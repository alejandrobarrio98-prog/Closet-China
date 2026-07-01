# Catálogo desde Instagram

Un sitio estático simple que muestra tu catálogo de ropa leyendo `catalog.json`,
un archivo que se actualiza solo una vez por semana jalando datos de tu cuenta de
Instagram. Cuando archivas un post en Instagram (porque se vendió), automáticamente
deja de aparecer en el sitio la próxima vez que se sincroniza — no hace falta borrar
nada a mano, porque la API de Instagram solo devuelve los posts que siguen publicados.

Costo total: **$0**. Todo corre en la capa gratuita de GitHub (Actions + Pages).

---

## Cómo funciona

```
Instagram  →  scripts/fetch-instagram.mjs  →  catalog.json  →  index.html (la web)
              (se ejecuta 1x por semana          ↑
               vía GitHub Actions)        leído por app.js
```

No hay servidor corriendo todo el tiempo. Una vez por semana, un robot de GitHub
descarga tus posts actuales, los guarda en `catalog.json`, y sube el cambio al
repositorio. Como tu sitio está conectado a ese mismo repositorio, se actualiza solo.

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
   propios datos sin pasar por el proceso de revisión de Meta ("App Review"), que
   es el que toma tiempo y solo hace falta si otras personas van a usar la app.

4. Genera un **token de acceso** para tu cuenta desde el panel de la app (la opción
   suele llamarse "Generate token" dentro de la sección de Instagram API setup).
   Ese primer token dura ~1 hora.

> Nota: el panel de Meta for Developers cambia de layout cada cierto tiempo. Si
> algún nombre de botón no coincide exactamente con lo descrito arriba, busca
> "Instagram API with Instagram Login" en su documentación — el flujo general
> se mantiene igual.

---

## Paso 3 — Cambia el token corto por uno de larga duración

El token de 1 hora no sirve para algo que corre una vez por semana. Cámbialo por
uno de 60 días con este comando (reemplaza los valores entre `< >`):

```bash
curl -i -X GET "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=<APP_SECRET>&access_token=<TOKEN_CORTO>"
```

Esto te devuelve un `access_token` nuevo que dura 60 días. Ese es el que vas a usar.

Para encontrar tu **user id** (lo necesitas en el siguiente paso):

```bash
curl -i -X GET "https://graph.instagram.com/me?fields=id,username&access_token=<TOKEN_LARGO>"
```

---

## Paso 4 — Sube este proyecto a GitHub

1. Crea un repositorio nuevo en GitHub (puede ser privado).
2. Sube todos los archivos de esta carpeta a ese repositorio.

---

## Paso 5 — Guarda tus credenciales como secretos del repositorio

`Settings → Secrets and variables → Actions → New repository secret`

Crea dos secretos:

| Nombre            | Valor                                  |
|--------------------|-----------------------------------------|
| `IG_USER_ID`       | el id que obtuviste en el paso 3       |
| `IG_ACCESS_TOKEN`  | el token largo que obtuviste en el paso 3 |

Estos nunca quedan visibles en el código ni en el sitio — solo el robot de
sincronización los usa, dentro de GitHub.

---

## Paso 6 — Activa el sitio (GitHub Pages, gratis)

`Settings → Pages → Source: "Deploy from a branch" → Branch: main / (root)`

GitHub te da una URL tipo `https://tu-usuario.github.io/tu-repo/`. Cada vez que
el robot actualice `catalog.json`, el sitio se vuelve a publicar solo.

(Si prefieres un dominio propio más adelante, tanto GitHub Pages como Netlify o
Cloudflare Pages lo permiten gratis — no hace falta cambiar nada del código.)

---

## Paso 7 — Corre la primera sincronización

No esperes al lunes: ve a la pestaña **Actions** del repositorio, abre
**"Sync catalog from Instagram"**, y dale a **"Run workflow"** para probarlo ahora.
Si todo está bien configurado, en menos de un minuto vas a ver un commit nuevo
con tu `catalog.json` real, y el sitio mostrará tus prendas.

Después de eso, corre solo, todos los lunes (puedes cambiar el día/hora editando
el `cron` dentro de `.github/workflows/sync-instagram.yml`).

---

## Personalizar

Edita las primeras líneas de `app.js`:

```js
const CONFIG = {
  shopName: "Tu Tienda",
  instagramProfileUrl: "https://instagram.com/tu_usuario",
  catalogFile: "catalog.json",
};
```

Las categorías que ves como filtros arriba del catálogo salen automáticamente de
los hashtags que ya usas en tus captions (por ejemplo `#vestidos`, `#casacas`) —
no necesitas configurarlas a mano.

---

## Sobre el vencimiento del token (importante)

El token largo dura **60 días**. Si se vence, la sincronización semanal empezará
a fallar silenciosamente (revisa la pestaña Actions de vez en cuando, o GitHub te
avisará por correo si un workflow falla).

La forma más simple de mantenerlo vivo: cada ~45 días, corre este comando con tu
token actual y reemplaza el secreto `IG_ACCESS_TOKEN` en GitHub con el resultado:

```bash
curl -i -X GET "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<TOKEN_ACTUAL>"
```

Te conviene poner un recordatorio en tu calendario. Si más adelante quieres que
esto también se automatice (sin que tengas que tocar nada), se puede armar un
segundo workflow que lo haga solo — avísame y lo construimos.

---

## Límites a tener en cuenta

- La API permite 200 llamadas por hora por cuenta — una sincronización semanal
  usa apenas un puñado, así que no hay riesgo de toparte con el límite.
- Solo se muestran fotos y carruseles por defecto (los reels/videos se excluyen
  porque normalmente no son "prendas para catálogo"); si quieres incluirlos,
  hay una línea marcada con comentario en `scripts/fetch-instagram.mjs` para
  cambiar ese comportamiento.
- `catalog.json` ya viene con datos de ejemplo para que veas cómo se ve el sitio
  antes de conectar tu cuenta real — se reemplaza solo en la primera sincronización.
