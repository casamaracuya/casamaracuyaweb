// Brochure de Casa Maracuyá para enviar por WhatsApp junto con la cotización.
// Páginas verticales (9:16) para leer en el teléfono: una idea por página, poco texto y letra grande.
// Uso: npm run brochure  →  public/casa-maracuya.pdf
// Necesita internet para bajar las letras (Google Fonts) y Chrome o Edge instalado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { HIGH, MIN_ALTA } from "../src/admin/util.js";

const ROOT = path.resolve(".");
const OUT = path.join(ROOT, "public", "casa-maracuya.pdf");
const src = fs.readFileSync("src/lib/contacto.js", "utf8");
const EMAIL = src.match(/EMAIL = "([^"]+)"/)[1];
const WA = (process.env.VITE_WHATSAPP || src.match(/\|\| "(\d+)"/)[1]).replace(/\D/g, "");
const WA_TXT = `+${WA.slice(0, 2)} ${WA.slice(2, 5)} ${WA.slice(5, 8)} ${WA.slice(8)}`;

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].filter(Boolean);
const browser = BROWSERS.find(b => fs.existsSync(b));
if (!browser) throw new Error("No encontré Chrome ni Edge. Indica la ruta con CHROME_PATH.");

// Fotos reducidas y comprimidas para que el PDF pese poco y baje rápido por WhatsApp.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "brochure-"));
const FOTOS = ["faro-piscina", "muelle-atardecer", "chef-sirviendo", "postre-maracuya", "tequenos", "cafe-de-la-tia",
  "hab-maracuya", "hab-del-valle", "atardecer-kite", "noche-piscina", "comedor-exterior", "piscina-casa", "sala-frente-al-mar"];
const img = {};
for (const n of FOTOS) {
  const out = path.join(tmp, `${n}.jpg`);
  await sharp(path.join(ROOT, "public", "fotos", `${n}.jpg`)).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(out);
  img[n] = pathToFileURL(out).href;
}
const logo = n => pathToFileURL(path.join(ROOT, "public", "logo", n)).href;

// ---------- Precios por noche (solo en el PDF, nunca en la web) ----------
// [precio base hasta BASE personas, cada persona adicional]. Máximo MAX huéspedes.
const PRECIOS = {
  base: 6, max: 12,
  esencial: { weekend: [720, 80], midweek: [520, 60] },
  plena: { weekend: [920, 120], midweek: [680, 100] }
};
const usd = v => "$" + v;
const cell = ([b, x]) => `<b>${usd(b)}</b><small>hasta ${PRECIOS.base} personas</small><span>+${usd(x)} <small>por persona adicional</small></span>`;
const priceTable = () => { const E = PRECIOS.esencial, P = PRECIOS.plena;
  return `<table class="prices"><thead><tr><th>Por noche</th><th>Esencial</th><th class="pl">Plena</th></tr></thead><tbody>
  <tr><th>Weekend<small>jueves a domingo</small></th><td>${cell(E.weekend)}</td><td class="pl">${cell(P.weekend)}</td></tr>
  <tr><th>Midweek<small>lunes a miércoles</small></th><td>${cell(E.midweek)}</td><td class="pl">${cell(P.midweek)}</td></tr>
  <tr class="alta"><th>Temporada alta<small>mínimo ${MIN_ALTA} noches</small></th><td colspan="2">Todas las noches a precio <b>weekend</b>: el midweek no aplica.</td></tr></tbody></table>`; };
const EJ = (() => { const [b, x] = PRECIOS.esencial.weekend, n = 8, extra = n - PRECIOS.base; return { n, extra, b, x, total: b + extra * x }; })();

// Temporada alta: el año con calendario cargado más próximo (o ALTA_AÑO=2028 npm run brochure).
const MESC = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ALTA_Y = +(process.env.ALTA_AÑO || Object.keys(HIGH).map(Number).filter(y => y >= new Date().getFullYear()).sort()[0] || 0);
const dm = iso => { const [, m, d] = iso.split("-").map(Number); return [d, MESC[m - 1]]; };
const rango = ([a, b]) => { const [d1, m1] = dm(a), [d2, m2] = dm(b); return m1 === m2 ? `${d1}–${d2} ${m1}` : `${d1} ${m1} – ${d2} ${m2}`; };

const CSS = `
@font-face{font-family:"Cifras";font-style:normal;font-weight:400;size-adjust:90%;unicode-range:U+0030-0039;src:url(https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2) format("woff2")}
@font-face{font-family:"Cifras";font-style:italic;font-weight:400;size-adjust:90%;unicode-range:U+0030-0039;src:url(https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2) format("woff2")}
:root{
  --arena-adicora:#C4A56C; --arena-seca:#E8DCCD; --alga:#2E2E24; --aguacate:#B8B89C; --sol:#F9EC9E;
  --laguna:#E6EFEE; --raspao:#F9FFF4; --merey:#D4C7BE; --melon:#778B63; --verde-tabla:#3D3D2A; --nocturna:#2E352A;
  --f-display:"Cifras", "Cormorant Garamond", Garamond, "Times New Roman", serif;
  --f-body:"Manrope", "Segoe UI", system-ui, sans-serif;
  --side:9mm;
}
@page{size:108mm 192mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-variant-numeric:lining-nums;font-family:var(--f-body);color:var(--alga);font-size:10pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3{font-family:var(--f-display);font-weight:500;line-height:1.04;margin:0;letter-spacing:-.01em}
p{margin:0}
b{font-weight:700}
.pg{position:relative;width:108mm;height:192mm;overflow:hidden;break-after:page;display:flex;flex-direction:column}
.pg:last-child{break-after:auto}
.linen{background-image:repeating-linear-gradient(0deg,rgba(46,46,36,.05) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(46,46,36,.035) 0 1px,transparent 1px 4px)}
.eyebrow{font-size:6.8pt;text-transform:uppercase;letter-spacing:.22em;font-weight:700;color:var(--melon)}
.photo{position:relative;flex:none;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.body{flex:1;padding:8mm var(--side) 15mm;display:flex;flex-direction:column}
.body h2{font-size:24pt;margin-top:3mm}
.body h2 em{font-style:italic;color:var(--melon)}
.lead{margin-top:5mm;font-size:10.5pt;line-height:1.6;color:var(--verde-tabla)}
.folio{position:absolute;left:var(--side);right:var(--side);bottom:6mm;display:flex;justify-content:space-between;font-size:6pt;letter-spacing:.18em;text-transform:uppercase;color:#8a8b78}
.folio b{color:var(--arena-adicora);font-weight:700}
.dark{background:var(--nocturna);color:var(--arena-seca)}
.dark .eyebrow{color:var(--arena-adicora)}
.dark h2 em{color:var(--arena-adicora)}
.dark .lead{color:#d8d0c3}
.dark .folio{color:var(--aguacate)}
.push{margin-top:auto}

/* Portada */
.cover .photo{position:absolute;inset:0}
.cover .photo img{object-position:88% 50%}
.cover .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,28,21,.55) 0%,rgba(24,28,21,0) 26%,rgba(24,28,21,0) 46%,rgba(24,28,21,.8) 68%,rgba(24,28,21,.96) 100%)}
.cover .logo{position:absolute;top:10mm;left:var(--side);width:34mm}
.cover .txt{position:absolute;left:var(--side);right:var(--side);bottom:16mm}
.cover .eyebrow{color:var(--sol)}
.cover h1{font-size:38pt;margin-top:3mm;color:#fff;letter-spacing:.01em}
.cover .sub{font-family:var(--f-display);font-style:italic;font-size:15pt;line-height:1.25;margin-top:3mm;color:var(--arena-seca);max-width:80mm}
.cover .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-top:7mm;padding-top:4mm;border-top:1px solid rgba(232,220,205,.35)}
.cover .facts b{display:block;font-size:14pt;font-weight:300;line-height:1;color:#fff}
.cover .facts span{display:block;margin-top:1.4mm;font-size:6.2pt;letter-spacing:.1em;text-transform:uppercase;line-height:1.35;color:var(--aguacate)}

/* Recuadro destacado */
.box{padding:5mm 5.5mm;border-radius:4mm;background:rgba(249,255,244,.6);border:1px solid var(--arena-adicora)}
.box .eyebrow{color:var(--arena-adicora)}
.box h3{font-size:15pt;margin-top:1.5mm}
.box p{margin-top:2mm;font-size:9.4pt;line-height:1.55;color:var(--verde-tabla)}

/* Listas con línea */
.rows{margin-top:6mm;border-top:1px solid var(--merey)}
.rows > div{display:flex;justify-content:space-between;align-items:baseline;gap:4mm;padding:2.8mm 0;border-bottom:1px solid var(--merey)}
.rows h3{font-size:13.5pt}
.rows span{font-size:9pt;color:var(--verde-tabla);text-align:right}
.dark .rows,.dark .rows > div{border-color:#47503f}
.dark .rows span{color:var(--aguacate)}
.rows .n{font-weight:300;font-size:15pt;color:var(--arena-adicora);font-family:var(--f-body);width:8mm;flex:none}
.rows .who{flex:1}
.rows .who b{display:block;font-size:10pt;font-weight:600;color:#fff}
.rows .who small{display:block;margin-top:.6mm;font-size:8.4pt;color:var(--aguacate)}

/* Pasos */
.steps{list-style:none;padding:0;margin:6mm 0 0;display:grid;gap:3.6mm;counter-reset:s}
.steps li{counter-increment:s;display:grid;grid-template-columns:7mm 1fr;gap:3mm;font-size:10pt;line-height:1.5;color:var(--verde-tabla)}
.steps li::before{content:counter(s);width:6.5mm;height:6.5mm;border-radius:50%;border:1px solid var(--alga);display:grid;place-items:center;font-size:7.5pt;font-weight:700;color:var(--alga)}

/* Etiquetas */
.chips{display:flex;flex-wrap:wrap;gap:2mm;margin-top:6mm}
.chips span{padding:1.6mm 3mm;border-radius:99px;background:var(--arena-seca);font-size:8.4pt;font-weight:600;color:var(--alga)}
.chips span.hi{background:var(--alga);color:var(--sol)}
.dark .chips span{background:transparent;border:1px solid var(--arena-adicora);color:#fff}

/* Dos datos lado a lado */
.pair{display:grid;grid-template-columns:1fr 1fr;gap:4mm}
.pair dt{font-size:6.6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--melon)}
.pair dd{margin:1mm 0 0;font-family:var(--f-display);font-size:14pt}

/* Temporada alta */
.alta .rule{margin-top:5mm;padding:4mm 5mm;border-radius:4mm;background:var(--sol);color:var(--alga);font-size:10pt;line-height:1.5}
.alta .rule b{font-weight:700}
.dates{margin-top:5mm;border-top:1px solid #47503f}
.dates > div{display:flex;justify-content:space-between;align-items:baseline;gap:4mm;padding:2.5mm 0;border-bottom:1px solid #47503f}
.dates b{font-size:11pt;font-weight:600;color:#fff;white-space:nowrap}
.dates span{font-size:9pt;color:var(--aguacate);text-align:right}

/* Antes de reservar */
.facts3{margin-top:6mm;display:grid;gap:4.5mm}
.facts3 > div{padding-left:5mm;border-left:2px solid var(--arena-adicora)}
.facts3 h3{font-size:14pt}
.facts3 p{margin-top:1.2mm;font-size:9.4pt;line-height:1.55;color:var(--verde-tabla)}
.facts3 .chips{margin-top:2.5mm}
.facts3 .chips span{background:#fff}

/* Páginas con el diseño anterior: filosofía, equipo, casa y viento */
.old{font-size:9.4pt;line-height:1.5}
.old .body{padding:7mm 8mm 0}
.old .body h2{font-size:23pt;margin-top:2.5mm}
.old .eyebrow{font-size:6.6pt;color:var(--verde-tabla)}
.old.dark .eyebrow{color:var(--arena-adicora)}
.old .lead{margin-top:3.5mm;font-size:9.4pt;line-height:1.5}
.old .lead+.lead{margin-top:2mm}
.o2{background:var(--arena-seca)}
.o2 .photo{height:62mm}
.o2 .photo img{object-position:50% 60%}
.gift{margin-top:auto;margin-bottom:12mm;padding:4.5mm 5mm;border:1px solid var(--arena-adicora);border-radius:4mm;background:rgba(249,255,244,.55)}
.gift .eyebrow{color:var(--arena-adicora)}
.gift p{margin-top:1.5mm;font-size:8.8pt;color:var(--verde-tabla)}
.gift h3{font-size:14pt;margin-top:1mm}
.o3 .photo{height:70mm}
.o3 .photo img{object-position:50% 30%}
.team{margin-top:4mm;display:grid}
.team div{display:grid;grid-template-columns:9mm 1fr;gap:2.5mm;padding:2.1mm 0;border-top:1px solid #47503f}
.team div:last-child{border-bottom:1px solid #47503f}
.team i{font-style:normal;font-weight:300;font-size:13pt;line-height:1;color:var(--arena-adicora)}
.team b{display:block;font-weight:600;color:#fff;font-size:9pt}
.team span{font-size:8pt;color:var(--aguacate);line-height:1.35}
.seven{position:absolute;right:6mm;top:58mm;width:23mm;height:23mm;border-radius:50%;background:var(--sol);color:var(--alga);display:grid;place-content:center;text-align:center;transform:rotate(-8deg);outline:1.2mm solid var(--nocturna)}
.seven b{font-size:21pt;line-height:.9;font-weight:300}
.seven span{font-size:5.4pt;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-top:1mm}
.o5{background:var(--raspao)}
.o5 .duo{flex:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5mm;height:64mm;overflow:hidden}
.o5 .duo img{width:100%;height:100%;object-fit:cover;display:block}
.rooms{margin-top:4mm;display:grid}
.rooms div{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;padding:2.2mm 0;border-top:1px solid var(--merey)}
.rooms div:last-child{border-bottom:1px solid var(--merey)}
.rooms h3{font-size:12.5pt}
.rooms span{font-size:8pt;color:var(--verde-tabla);text-align:right}
.o5 .note{margin-top:2mm;font-size:7.6pt;color:#5f604f}
.o5 .chips{gap:1.6mm;margin-top:4mm}
.o5 .chips span{padding:1.3mm 2.6mm;font-size:7.6pt}
.hours{margin-top:auto;margin-bottom:13mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm;padding-top:3mm;border-top:1px solid var(--merey)}
.hours dt{font-size:6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--melon)}
.hours dd{margin:.5mm 0 0;font-family:var(--f-display);font-size:13pt}
.o6{background:var(--laguna)}
.o6 .photo{height:76mm}
.o6 .photo img{object-position:40% 50%}
.two{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:auto;margin-bottom:13mm}
.two div{padding:3.5mm;border-radius:3.5mm;background:rgba(255,255,255,.7)}
.two i{font-family:var(--f-display);font-style:italic;font-size:11pt;color:var(--melon);display:block;line-height:1.1}
.two p{font-size:7.8pt;line-height:1.4;margin-top:1.5mm;color:var(--verde-tabla)}

/* Planes y tarifas (diseño anterior) */
.pp{background:var(--raspao)}
.pp .body{padding-top:6.5mm}
.pp .body h2{font-size:22pt}
.plan{margin-top:2.6mm;border-radius:4mm;padding:3.2mm 4mm;background:#fff;border:1px solid var(--merey)}
.plan.plena{background:var(--verde-tabla);color:var(--arena-seca);border-color:transparent}
.plan .top{display:flex;justify-content:space-between;align-items:baseline;gap:3mm}
.plan h3{font-size:14.5pt}
.plan .tag{font-size:6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--melon)}
.plan.plena .tag{color:var(--arena-adicora)}
.plan .ideal{font-family:var(--f-display);font-style:italic;font-size:9.6pt;line-height:1.25;margin-top:1mm;color:var(--verde-tabla)}
.plan.plena .ideal{color:var(--arena-seca)}
.plan ul{list-style:none;padding:0;margin:2mm 0 0;display:grid;gap:.8mm}
.plan li{position:relative;padding-left:3.6mm;font-size:7.6pt;line-height:1.35}
.plan li::before{content:"";position:absolute;left:0;top:.55em;width:1.5mm;height:1.5mm;border-radius:50%;background:var(--arena-adicora)}
.plan li.no{color:#8a8b78}.plan li.no::before{background:transparent;border:1px solid #8a8b78;box-sizing:border-box}
.plan.plena li{color:#e8dccd}
.prices{width:100%;border-collapse:collapse;margin-top:1.5mm;font-size:7pt}
.prices th,.prices td{padding:1.6mm 1.5mm;border-bottom:1px solid var(--merey);text-align:left;vertical-align:top}
.prices thead th{font-size:6pt;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--melon);padding:1mm 1.5mm}
.prices .pl{background:rgba(61,61,42,.07)}
.prices tbody th{font-weight:600;font-size:8pt;width:27%}
.prices small{display:block;font-weight:400;font-size:5.9pt;color:#8a8b78;line-height:1.3}
.prices td b{display:block;font-size:12pt;font-weight:600;line-height:1.1}
.prices td span{display:block;margin-top:1mm;font-size:8.4pt;font-weight:600;color:var(--verde-tabla)}
.prices td span small{display:inline;font-size:5.9pt}
.prices tr.alta td{font-size:7.4pt;color:var(--verde-tabla);background:none;vertical-align:middle}
.prices tr.alta td b{display:inline;font-size:inherit}
.pp .tt{margin-top:3mm;color:var(--arena-adicora)}
.pp .ej{margin-top:2mm;padding:2mm 2.6mm;border-radius:2.5mm;background:var(--arena-seca);font-size:7.2pt;line-height:1.4}
.pp .fine{margin-top:1.8mm;font-size:6.5pt;color:#5f604f;line-height:1.4}
.pp .fine b{color:var(--alga)}

/* Cierre */
.cta{padding:5mm 5.5mm;border-radius:4mm;background:var(--arena-adicora);color:var(--alga)}
.cta b{display:block;font-family:var(--f-display);font-size:15pt;font-weight:600;line-height:1.15}
.cta span{display:block;margin-top:1.5mm;font-size:9.4pt;line-height:1.5}
.contact{margin-top:6mm;display:grid;grid-template-columns:auto 1fr;gap:2.2mm 4mm;font-size:10pt}
.contact dt{color:var(--aguacate);font-size:6.6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;padding-top:1mm}
.contact dd{margin:0;color:#fff;font-weight:600}
`;

// ---------- Páginas ----------
const pages = [];
const page = (cls, inner) => pages.push({ cls, inner });

// Portada
page("cover dark", `
  <div class="photo"><img src="${img["faro-piscina"]}" alt=""></div>
  <div class="shade"></div>
  <img class="logo" src="${logo("logo-claro.svg")}" alt="Casa Maracuyá">
  <div class="txt">
    <p class="eyebrow">Alquiler exclusivo · Junto al Faro de Adícora</p>
    <h1>Casa Maracuyá</h1>
    <p class="sub">Tu villa privada de alta gastronomía frente al Mar Caribe.</p>
    <div class="facts">
      <div><b>100%</b><span>Casa privada</span></div>
      <div><b>1–12</b><span>Huéspedes</span></div>
      <div><b>3</b><span>Habitaciones</span></div>
      <div><b>7</b><span>Personas a tu servicio</span></div>
    </div>
  </div>`);

// Filosofía
page("old o2 linen", `
  <div class="photo"><img src="${img["muelle-atardecer"]}" alt=""></div>
  <div class="body">
    <p class="eyebrow">Nuestra filosofía · Edutainment</p>
    <h2>Llegas como turista, <em>te vas siendo parte de nuestra historia.</em></h2>
    <p class="lead">Casa Maracuyá es hospitalidad boutique con un propósito: que descanses mientras descubres el alma del lugar. Lo llamamos <i>edutainment</i>: el lujo que no solo se siente, también se aprende.</p>
    <p class="lead">Aquí la privacidad es total. Nunca compartes espacios con extraños: la casa completa y todo nuestro equipo son solo para tu grupo.</p>
    <div class="gift">
      <p class="eyebrow">Privilegio de bienvenida</p>
      <h3>La historia de Adícora, contada en casa</h3>
      <p>Como cortesía de la casa, una historiadora local te visita para contarte, en una charla íntima de 5 minutos, los secretos de Adícora, la mística del faro vecino y la historia de nuestra casa.</p>
    </div>
  </div>`);

// El equipo
page("old o3 dark", `
  <div class="photo"><img src="${img["chef-sirviendo"]}" alt=""></div>
  <div class="seven"><b>7</b><span>a tu<br>servicio</span></div>
  <div class="body">
    <p class="eyebrow">El lujo de ser atendido</p>
    <h2>Tu única responsabilidad <em>es disfrutar.</em></h2>
    <p class="lead">El verdadero lujo es olvidarte de todo. Aquí no cocinas, no recoges y no planificas: siete personas se ocupan de cada detalle mientras tú solo disfrutas.</p>
    <div class="team">
      <div><i>2</i><p><b>Chef privada y ayudante de cocina</b><span>Cocina gourmet cada día, a la medida de tu grupo.</span></p></div>
      <div><i>2</i><p><b>Anfitrionas y mesoneras</b><span>Te atienden en la piscina, el muelle y la mesa.</span></p></div>
      <div><i>2</i><p><b>Limpieza y mantenimiento</b><span>La casa impecable y todo funcionando, todo el tiempo.</span></p></div>
      <div><i>1</i><p><b>Concierge</b><span>Tu anfitrión y guía local para turismo y deportes.</span></p></div>
    </div>
  </div>`);

// La cocina
page("", `
  <div class="photo" style="height:78mm;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:1.5mm">
    <img src="${img["postre-maracuya"]}" alt="" style="grid-row:1 / span 2;min-height:0"><img src="${img["tequenos"]}" alt="" style="min-height:0"><img src="${img["cafe-de-la-tia"]}" alt="" style="min-height:0"></div>
  <div class="body linen" style="background-color:var(--merey)">
    <p class="eyebrow">Alta gastronomía local</p>
    <h2>El corazón de la casa: <em>la cocina.</em></h2>
    <ol class="steps">
      <li>La chef te propone el menú, con ingredientes frescos de la costa.</li>
      <li>Lo apruebas antes de llegar y nos cuentas tus alergias.</li>
      <li>Cada día eliges qué te provoca para mañana.</li>
    </ol>
    <p class="lead push">¿Traes tus bebidas? <b>Te las servimos</b> y te preparamos los tragos.</p>
  </div>`);

// La casa
page("old o5", `
  <div class="duo"><img src="${img["hab-maracuya"]}" alt=""><img src="${img["hab-del-valle"]}" alt=""></div>
  <div class="body">
    <p class="eyebrow">La casa y sus espacios</p>
    <h2>Confort pensado para <em>el descanso.</em></h2>
    <div class="rooms">
      <div><h3>Habitación principal</h3><span>1 cama queen + sofá cama</span></div>
      <div><h3>Dos habitaciones dobles</h3><span>2 camas queen cada una</span></div>
    </div>
    <p class="note">Hasta 4 personas por habitación · capacidad máxima de la casa: 12 huéspedes.</p>
    <div class="chips">
      <span class="hi">Piscina privada</span><span class="hi">Muelle frente al mar</span><span class="hi">Al lado del faro</span>
      <span>Planta eléctrica</span><span>Aire acondicionado</span><span>Agua caliente</span><span>Wi-Fi</span><span>Estacionamiento</span><span>Pet friendly</span>
    </div>
    <dl class="hours"><div><dt>Check-in</dt><dd>desde las 3:00 PM</dd></div><div><dt>Check-out</dt><dd>hasta las 11:00 AM</dd></div></dl>
  </div>`);

// Viento y mar
page("old o6", `
  <div class="photo"><img src="${img["atardecer-kite"]}" alt=""></div>
  <div class="body">
    <p class="eyebrow">Aventura, viento y mar</p>
    <h2>Adrenalina o calma: <em>tú marcas el ritmo.</em></h2>
    <p class="lead">Adícora es uno de los mejores spots de viento del Caribe. Desde la terraza ves las cometas en el agua.</p>
    <p class="lead">Nuestro concierge es kitesurfista: te orienta y te da coaching, te conecta con las escuelas de kite de la zona y organiza paseos por la península de Paraguaná.</p>
    <div class="two">
      <div><i>Si vienes a volar</i><p>Información del viento, coaching y clases con escuelas aliadas. Al volver, te espera la mesa servida.</p></div>
      <div><i>Si vienes a desconectarte</i><p>Piscina, muelle, atardeceres frente al faro y nadie apurándote.</p></div>
    </div>
  </div>`);

// Planes y tarifas (diseño anterior)
page("old pp", `
  <div class="body">
    <p class="eyebrow">Elige tu experiencia</p>
    <h2>Dos formas de vivir <em>la casa.</em></h2>
    <div class="plan">
      <div class="top"><h3>Experiencia Esencial</h3><span class="tag">Desayuno incluido</span></div>
      <p class="ideal">Para despertar con la mesa servida y salir a explorar Adícora y la península.</p>
      <ul><li>Desayunos gourmet diarios, preparados por la chef</li><li class="no">Sin almuerzo ni cena: la cocina es de uso exclusivo del equipo</li></ul>
    </div>
    <div class="plan plena">
      <div class="top"><h3>Experiencia Plena</h3><span class="tag">Todas las comidas</span></div>
      <p class="ideal">Para desconectarte de verdad: niños, grupos grandes o kiters que vuelven con hambre.</p>
      <ul><li>Desayunos gourmet diarios, preparados por la chef</li><li>Almuerzos y cenas a la carta, con postre artesanal</li><li>Servicio de tequeños y cava de playa reforzada con hidratación y frutas</li></ul>
    </div>
    <p class="eyebrow tt">Tarifas por noche · casa completa</p>
    ${priceTable()}
    <p class="ej"><b>Ejemplo:</b> ${EJ.n} personas un fin de semana en la Experiencia Esencial: ${usd(EJ.b)} + ${EJ.extra} × ${usd(EJ.x)} = <b>${usd(EJ.total)} por noche</b>.</p>
    <p class="fine">Precios en dólares (USD) por noche. Máximo ${PRECIOS.max} huéspedes. <b>Niños de 0 a 3 años:</b> cortesía (máx. 2 por reserva, compartiendo cama con sus padres; no suman como huésped adicional). Desde los 4 años cuentan como huésped regular.</p>
  </div>`);

// Temporada alta
if (HIGH[ALTA_Y]) page("dark alta", `
  <div class="body" style="padding-top:12mm">
    <p class="eyebrow">Temporada alta ${ALTA_Y}</p>
    <h2>Fechas <em>más buscadas.</em></h2>
    <p class="rule">Todas las noches a precio <b>weekend</b> y mínimo <b>${MIN_ALTA} noches</b>.</p>
    <div class="dates">${HIGH[ALTA_Y].map(x => `<div><b>${rango(x)}</b><span>${x[2]}</span></div>`).join("")}</div>
    <p class="lead push" style="font-size:9.4pt">El resto del año reservas desde 1 noche.</p>
  </div>`);

// Antes de reservar
page("linen", `
  <div class="photo" style="height:62mm"><img src="${img["sala-frente-al-mar"]}" alt="" style="object-position:50% 55%"></div>
  <div class="body" style="background-color:var(--arena-seca)">
    <p class="eyebrow">Antes de reservar</p>
    <h2>Bueno <em>saberlo.</em></h2>
    <div class="facts3">
      <div><h3>Niños de 0 a 3 años, cortesía</h3><p>Hasta 2 por reserva, en la cama de sus padres. Desde los 4 años cuentan como huésped.</p></div>
      <div><h3>Siempre la casa entera</h3><p>Sin compartir áreas con nadie más.</p></div>
      <div><h3>Formas de pago</h3><div class="chips"><span>Zelle</span><span>Efectivo</span><span>USDT</span></div></div>
    </div>
  </div>`);

// Cierre
page("dark", `
  <div class="photo" style="height:84mm"><img src="${img["noche-piscina"]}" alt="" style="object-position:50% 70%"></div>
  <div class="body">
    <p class="eyebrow">Reservas</p>
    <h2>Diseña tu estadía en <em>Casa Maracuyá.</em></h2>
    <div class="cta push"><b>Tu cotización viene con este PDF.</b><span>Hecha para tus fechas, tu grupo y la experiencia que elijas.</span></div>
    <dl class="contact">
      <dt>WhatsApp</dt><dd>${WA_TXT}</dd>
      <dt>Instagram</dt><dd>@lacasamaracuya</dd>
      <dt>Web</dt><dd>casa-maracuya.com</dd>
      <dt>Correo</dt><dd>${EMAIL}</dd>
    </dl>
  </div>`);

const N = pages.length, nn = n => String(n).padStart(2, "0");
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Casa Maracuyá</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@300;400;600;700&display=block">
<style>${CSS}</style></head><body>
${pages.map((p, i) => `<section class="pg ${p.cls}">${p.inner}
  <div class="folio"><span>${i === 0 ? "Adícora, Falcón — Venezuela" : i === N - 1 ? "Viento, mar y cero prisa." : "Casa Maracuyá · Adícora"}</span><span><b>${nn(i + 1)}</b> / ${nn(N)}</span></div>
</section>`).join("\n")}
</body></html>`;

const file = path.join(tmp, "brochure.html");
fs.writeFileSync(file, html);
execFileSync(browser, [
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
  `--user-data-dir=${path.join(tmp, "perfil")}`, `--print-to-pdf=${OUT}`, pathToFileURL(file).href
], { stdio: "ignore" });
console.log(`✓ brochure → public/casa-maracuya.pdf (${N} páginas, ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`);
if (process.env.PDFS_KEEP) console.log("HTML en", tmp); else fs.rmSync(tmp, { recursive: true, force: true });
