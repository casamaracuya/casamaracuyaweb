// Después de compilar, escribe cada página pública ya armada en HTML, con su título,
// descripción, dirección canónica y enlaces entre idiomas (hreflang). Así Google lee
// todo el contenido sin depender de JavaScript, y cada idioma tiene su propia dirección.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIST = "dist";
const SITE = "https://casa-maracuya.com";
const tpl = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, ".vite", "manifest.json"), "utf8"));
const { render } = await import(pathToFileURL(path.resolve("dist-ssr", "entry-server.js")).href);

const HOME = { es: "/", en: "/en/" };
const PRIVACY = { es: "/privacidad", en: "/en/privacy" };

const PAGES = [
  { url: "/", out: "index.html", src: "src/site/Site.jsx", lang: "es", alt: HOME,
    title: "Casa Maracuyá · Posada en Adícora frente al faro | Falcón, Venezuela",
    desc: "Posada en Adícora, Falcón: la casa completa para tu grupo de 1 a 12 personas, frente al Faro y al Mar Caribe. Chef en casa, pet friendly y el kitesurf a la vista desde la terraza." },
  { url: "/en/", out: "en/index.html", src: "src/site/Site.jsx", lang: "en", alt: HOME,
    title: "Casa Maracuyá · Guesthouse in Adícora by the lighthouse | Venezuela",
    desc: "Private guesthouse in Adícora, Falcón, Venezuela: the whole house for groups of 1 to 12, by the lighthouse and the Caribbean Sea. Private chef, pet friendly and kitesurfing in view from the terrace." },
  { url: "/privacidad", out: "privacidad.html", src: "src/site/Privacy.jsx", lang: "es", alt: PRIVACY,
    title: "Política de privacidad · Casa Maracuyá",
    desc: "Qué datos guarda Casa Maracuyá cuando pides una estadía, para qué los usa y cómo pedir que los corrijamos o borremos." },
  { url: "/en/privacy", out: "en/privacy.html", src: "src/site/Privacy.jsx", lang: "en", alt: PRIVACY,
    title: "Privacy policy · Casa Maracuyá",
    desc: "What data Casa Maracuyá keeps when you request a stay, what it's used for and how to ask us to correct or delete it." }
];

// CSS y JS que necesita cada página, para que llegue con estilos desde el primer instante.
function assetsFor(src) {
  const css = new Set(), js = new Set(), seen = new Set();
  const walk = key => {
    if (seen.has(key) || !manifest[key]) return; seen.add(key);
    const m = manifest[key]; js.add(m.file); (m.css || []).forEach(c => css.add(c)); (m.imports || []).forEach(walk);
  };
  walk(src);
  return { css: [...css], js: [...js] };
}

const esc = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const setMeta = (html, re, value) => { if (!re.test(html)) throw new Error("No encontré en index.html: " + re); return html.replace(re, value); };

for (const p of PAGES) {
  const body = render(p.url);
  const { css, js } = assetsFor(p.src);
  const canonical = SITE + p.url;
  const other = p.lang === "es" ? "en" : "es";
  const head = [
    ...css.map(f => `<link rel="stylesheet" href="/${f}">`),
    ...js.map(f => `<link rel="modulepreload" href="/${f}">`),
    `<link rel="alternate" hreflang="es" href="${SITE + p.alt.es}">`,
    `<link rel="alternate" hreflang="en" href="${SITE + p.alt.en}">`,
    `<link rel="alternate" hreflang="x-default" href="${SITE + p.alt.es}">`
  ].join("\n  ");

  let html = tpl;
  html = setMeta(html, /<html lang="[^"]*">/, `<html lang="${p.lang}">`);
  html = setMeta(html, /<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  html = setMeta(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.desc)}">`);
  html = setMeta(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical}">`);
  html = setMeta(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`);
  html = setMeta(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(p.title)}">`);
  html = setMeta(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(p.desc)}">`);
  html = setMeta(html, /<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${p.lang === "es" ? "es_VE" : "en_US"}">`);
  html = setMeta(html, /<meta property="og:locale:alternate" content="[^"]*">/, `<meta property="og:locale:alternate" content="${other === "es" ? "es_VE" : "en_US"}">`);
  html = setMeta(html, /<\/head>/, `  ${head}\n</head>`);
  html = setMeta(html, /<div id="root"><\/div>/, `<div id="root">${body}</div>`);

  const file = path.join(DIST, p.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  console.log(`✓ ${p.url.padEnd(14)} → ${p.out} (${(html.length / 1024).toFixed(0)} kB)`);
}

// Todo lo demás (el panel y las direcciones que no existen) recibe la app vacía.
// Cloudflare la entrega con código 404 para lo que no existe; React decide qué mostrar.
const shell = tpl.replace("</head>", `  <meta name="robots" content="noindex">\n</head>`);
fs.writeFileSync(path.join(DIST, "404.html"), shell);
// El panel: /admin y cada sección (/admin/reservas…) responden 200 con la app vacía.
const VIEWS = fs.readFileSync("src/admin/util.js", "utf8").match(/export const VIEWS = \{([^}]*)\}/)[1].match(/\b[a-z]+(?=:)/g);
fs.writeFileSync(path.join(DIST, "admin.html"), shell);
fs.mkdirSync(path.join(DIST, "admin"), { recursive: true });
VIEWS.forEach(v => fs.writeFileSync(path.join(DIST, "admin", `${v}.html`), shell));
console.log(`✓ 404.html y el panel: admin.html + ${VIEWS.length} secciones (app vacía)`);
