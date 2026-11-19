// Brochure de Casa Maracuyá para enviar por WhatsApp junto con la cotización.
// 8 páginas verticales (9:16) pensadas para leerse en el teléfono, con los colores y letras de la web.
// Uso: npm run brochure  →  public/brochure-casa-maracuya.pdf
// Necesita internet para bajar las letras (Google Fonts) y Chrome o Edge instalado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(".");
const OUT = path.join(ROOT, "public", "brochure-casa-maracuya.pdf");
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
const FOTOS = ["faro-piscina", "muelle-atardecer", "chef-sirviendo", "jugos-brindis", "postre-maracuya", "tequenos", "cafe-de-la-tia",
  "hab-maracuya", "hab-del-valle", "bano-del-valle", "atardecer-kite", "noche-piscina"];
const img = {};
for (const n of FOTOS) {
  const out = path.join(tmp, `${n}.jpg`);
  await sharp(path.join(ROOT, "public", "fotos", `${n}.jpg`)).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toFile(out);
  img[n] = pathToFileURL(out).href;
}
const logo = n => pathToFileURL(path.join(ROOT, "public", "logo", n)).href;

// ---------- Precios por noche (solo en el PDF, nunca en la web) ----------
// [1 a 6 huéspedes, 7 a 12 huéspedes]. null = sin precio todavía.
const PRECIOS = {
  moneda: "USD",
  esencial: { midweek: [653, 1088], weekend: [870, 1450], alta: [null, null] },
  plena: { midweek: [885, 1485], weekend: [1180, 1980], alta: [null, null] }
};
const fmt = v => v == null ? "Consultar" : `${PRECIOS.moneda === "USD" ? "$" : ""}${v}${PRECIOS.moneda === "USD" ? "" : " " + PRECIOS.moneda}`;
const priceTable = () => { const E = PRECIOS.esencial, P = PRECIOS.plena;
  const row = (k, name, when) => `<tr><th>${name}<small>${when}</small></th><td>${fmt(E[k][0])}</td><td>${fmt(E[k][1])}</td><td class="pl">${fmt(P[k][0])}</td><td class="pl">${fmt(P[k][1])}</td></tr>`;
  return `<table class="prices"><thead><tr><th rowspan="2">Por noche</th><th colspan="2">Esencial</th><th colspan="2" class="pl">Plena</th></tr><tr><th>1 a 6</th><th>7 a 12</th><th class="pl">1 a 6</th><th class="pl">7 a 12</th></tr></thead><tbody>
  ${row("midweek", "Midweek", "lun a mié")}${row("weekend", "Weekend", "jue a dom")}<tr class="alta"><th>Temp. alta<small>mín. 4 noches</small></th><td colspan="4">Tarifa según fechas · consúltanos</td></tr></tbody></table>`; };

const CSS = `
@font-face{font-family:"Cifras";font-style:normal;font-weight:400;size-adjust:90%;unicode-range:U+0030-0039;src:url(https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2) format("woff2")}
@font-face{font-family:"Cifras";font-style:italic;font-weight:400;size-adjust:90%;unicode-range:U+0030-0039;src:url(https://fonts.gstatic.com/s/manrope/v23/xn7gYHE41ni1AdIRggexSg.woff2) format("woff2")}
:root{
  --arena-adicora:#C4A56C; --arena-seca:#E8DCCD; --alga:#2E2E24; --aguacate:#B8B89C; --sol:#F9EC9E;
  --laguna:#E6EFEE; --raspao:#F9FFF4; --merey:#D4C7BE; --melon:#778B63; --verde-tabla:#3D3D2A; --nocturna:#2E352A;
  --f-display:"Cifras", "Cormorant Garamond", Garamond, "Times New Roman", serif;
  --f-body:"Manrope", "Segoe UI", system-ui, sans-serif;
}
@page{size:108mm 192mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-variant-numeric:lining-nums;font-family:var(--f-body);color:var(--alga);font-size:9.4pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3{font-family:var(--f-display);font-weight:500;line-height:1.02;margin:0;letter-spacing:-.01em}
p{margin:0}
b{font-weight:700}
.pg{position:relative;width:108mm;height:192mm;overflow:hidden;break-after:page;display:flex;flex-direction:column}
.pg:last-child{break-after:auto}
.linen{background-image:repeating-linear-gradient(0deg,rgba(46,46,36,.05) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(46,46,36,.035) 0 1px,transparent 1px 4px)}
.eyebrow{font-size:6.6pt;text-transform:uppercase;letter-spacing:.22em;font-weight:700;color:var(--verde-tabla)}
.photo{position:relative;flex:none;overflow:hidden}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.body{flex:1;padding:7mm 8mm 0;display:flex;flex-direction:column}
.body h2{font-size:23pt;margin-top:2.5mm}
.body h2 em{font-style:italic;color:var(--melon)}
.lead{margin-top:3.5mm;color:var(--verde-tabla)}
.lead+.lead{margin-top:2mm}
.folio{position:absolute;left:8mm;right:8mm;bottom:5mm;display:flex;justify-content:space-between;font-size:6pt;letter-spacing:.18em;text-transform:uppercase;color:#7a7b68}
.folio b{color:var(--arena-adicora);font-weight:700}
.dark .folio{color:var(--aguacate)}

/* 1 · Portada */
.cover{background:var(--nocturna);color:var(--arena-seca)}
.cover .photo{position:absolute;inset:0}
.cover .photo img{object-position:88% 50%}
.cover .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(24,28,21,.55) 0%,rgba(24,28,21,0) 26%,rgba(24,28,21,0) 44%,rgba(24,28,21,.78) 66%,rgba(24,28,21,.96) 100%)}
.cover .logo{position:absolute;top:9mm;left:8mm;width:34mm;filter:drop-shadow(0 1px 6px rgba(0,0,0,.35))}
.cover .seal{position:absolute;top:8mm;right:8mm;width:22mm;opacity:.95}
.cover .txt{position:absolute;left:8mm;right:8mm;bottom:15mm}
.cover .eyebrow{color:var(--sol)}
.cover h1{font-size:36pt;margin-top:3mm;color:#fff;letter-spacing:.01em}
.cover .sub{font-family:var(--f-display);font-style:italic;font-size:14.5pt;line-height:1.2;margin-top:3mm;color:var(--arena-seca);max-width:80mm}
.cover .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-top:6mm;padding-top:4mm;border-top:1px solid rgba(232,220,205,.35)}
.cover .facts b{display:block;font-size:13pt;font-weight:300;line-height:1;color:#fff}
.cover .facts span{font-size:6.2pt;letter-spacing:.1em;text-transform:uppercase;color:var(--aguacate)}
.cover .folio{color:var(--aguacate)}

/* 2 · Filosofía */
.p2{background:var(--arena-seca)}
.p2 .photo{height:62mm}
.p2 .photo img{object-position:50% 60%}
.gift{margin-top:auto;margin-bottom:12mm;padding:4.5mm 5mm;border:1px solid var(--arena-adicora);border-radius:4mm;background:rgba(249,255,244,.55);position:relative}
.gift .eyebrow{color:var(--arena-adicora)}
.gift p{margin-top:1.5mm;font-size:8.8pt;color:var(--verde-tabla)}
.gift h3{font-size:14pt;margin-top:1mm}

/* 3 · El equipo */
.p3{background:var(--nocturna);color:var(--arena-seca)}
.p3 .photo{height:70mm}
.p3 .photo img{object-position:50% 30%}
.p3 .eyebrow{color:var(--arena-adicora)}
.p3 .lead{color:#d8d0c3}
.p3 h2 em{color:var(--arena-adicora)}
.team{margin-top:4mm;display:grid;gap:0}
.team div{display:grid;grid-template-columns:9mm 1fr;gap:2.5mm;padding:2.1mm 0;border-top:1px solid #47503f}
.team div:last-child{border-bottom:1px solid #47503f}
.team i{font-style:normal;font-weight:300;font-size:13pt;line-height:1;color:var(--arena-adicora)}
.team b{display:block;font-weight:600;color:#fff;font-size:9pt}
.team span{font-size:8pt;color:var(--aguacate);line-height:1.35}
.seven{position:absolute;right:6mm;top:58mm;width:23mm;height:23mm;border-radius:50%;background:var(--sol);color:var(--alga);display:grid;place-content:center;text-align:center;transform:rotate(-8deg);box-shadow:0 6px 16px -6px rgba(0,0,0,.5)}
.seven b{font-size:21pt;line-height:.9;font-weight:300}
.seven span{font-size:5.4pt;letter-spacing:.14em;text-transform:uppercase;font-weight:700;margin-top:1mm}

/* 4 · La cocina */
.p4{background:var(--merey)}
.p4 .collage{flex:none;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:repeat(2,minmax(0,1fr));gap:1.5mm;height:80mm;overflow:hidden}
.p4 .collage img{width:100%;height:100%;min-height:0;object-fit:cover;display:block}
.p4 .collage img:first-child{grid-row:1 / span 2}
.p4 .body{padding-top:5mm}
.p4 h2{font-size:21pt}
.steps{list-style:none;padding:0;margin:3.5mm 0 0;display:grid;gap:1.4mm;counter-reset:s}
.steps li{counter-increment:s;display:grid;grid-template-columns:5.5mm 1fr;gap:2mm;font-size:8.6pt;color:var(--verde-tabla);line-height:1.35}
.steps li::before{content:counter(s);width:5mm;height:5mm;border-radius:50%;border:1px solid var(--alga);display:grid;place-items:center;font-size:6.5pt;font-weight:700;color:var(--alga)}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-top:4mm}
.card{padding:3.5mm;border-radius:3.5mm;background:var(--raspao)}
.card.plena{background:var(--verde-tabla);color:var(--arena-seca)}
.card .eyebrow{font-size:5.8pt;color:var(--melon)}
.card.plena .eyebrow{color:var(--arena-adicora)}
.card h3{font-size:12.5pt;margin-top:1mm}
.card p{font-size:7.8pt;line-height:1.38;margin-top:1.5mm;color:var(--verde-tabla)}
.card.plena p{color:#d8d0c3}
.bar{margin-top:3.5mm;font-size:7.8pt;line-height:1.4;color:var(--verde-tabla);padding-left:3mm;border-left:2px solid var(--arena-adicora)}

/* Planes */
.pp{background:var(--raspao)}
.pp .body{padding-top:6.5mm}
.pp h2{font-size:22pt}
.both{display:flex;flex-wrap:wrap;gap:1.2mm;margin-top:3mm}
.both span{padding:.7mm 2mm;border-radius:99px;background:var(--arena-seca);font-size:6.4pt;font-weight:600}
.plan{margin-top:3mm;border-radius:4mm;padding:3.2mm 4mm;background:#fff;border:1px solid var(--merey)}
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
.prices th,.prices td{padding:1mm .8mm;border-bottom:1px solid var(--merey);text-align:center}
.prices thead th{font-size:5.6pt;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--melon);padding:1mm .8mm}
.prices thead tr:first-child th{font-size:6.4pt;color:var(--alga);border-bottom:0;padding-bottom:0}
.prices thead tr:first-child th.pl{color:var(--verde-tabla)}
.prices .pl{background:rgba(61,61,42,.07)}
.prices th:first-child,.prices tbody th{text-align:left}
.prices tbody th{font-weight:600;font-size:7.4pt}
.prices small{display:block;font-weight:400;font-size:5.8pt;color:#8a8b78}
.prices td{font-size:8.6pt;font-weight:600;white-space:nowrap}
.prices tr.alta td{font-size:7.2pt;font-weight:500;color:var(--verde-tabla);background:none}
.pp .tt{margin-top:3mm;color:var(--arena-adicora)}
.pp .fine{margin-top:2mm;font-size:6.6pt;color:#5f604f;line-height:1.4}

/* 5 · La villa */
.p5{background:var(--raspao)}
.p5 .duo{flex:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.5mm;height:64mm;overflow:hidden}
.p5 .duo img{width:100%;height:100%;object-fit:cover;display:block}
.rooms{margin-top:4mm;display:grid;gap:0}
.rooms div{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;padding:2.2mm 0;border-top:1px solid var(--merey)}
.rooms div:last-child{border-bottom:1px solid var(--merey)}
.rooms h3{font-size:12.5pt}
.rooms span{font-size:8pt;color:var(--verde-tabla);text-align:right}
.note{margin-top:2mm;font-size:7.6pt;color:#5f604f}
.chips{display:flex;flex-wrap:wrap;gap:1.6mm;margin-top:4mm}
.chips span{padding:1.3mm 2.6mm;border-radius:99px;background:var(--arena-seca);font-size:7.6pt;font-weight:600;color:var(--alga)}
.chips span.hi{background:var(--alga);color:var(--sol)}
.hours{margin-top:auto;margin-bottom:13mm;display:grid;grid-template-columns:1fr 1fr;gap:3mm;padding-top:3mm;border-top:1px solid var(--merey)}
.hours dt{font-size:6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--melon)}
.hours dd{margin:.5mm 0 0;font-family:var(--f-display);font-size:13pt}

/* 6 · Viento y mar */
.p6{background:var(--laguna)}
.p6 .photo{height:76mm}
.p6 .photo img{object-position:40% 50%}
.two{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:auto;margin-bottom:13mm}
.two div{padding:3.5mm;border-radius:3.5mm;background:rgba(255,255,255,.7)}
.two i{font-family:var(--f-display);font-style:italic;font-size:11pt;color:var(--melon);display:block;line-height:1.1}
.two p{font-size:7.8pt;line-height:1.4;margin-top:1.5mm;color:var(--verde-tabla)}

/* 7 · Cierre */
.p7{background:var(--nocturna);color:var(--arena-seca)}
.p7 .photo{height:56mm}
.p7 .photo img{object-position:50% 70%}
.p7 .photo::after{content:"";position:absolute;inset:auto 0 0;height:18mm;background:linear-gradient(180deg,rgba(46,53,42,0),var(--nocturna))}
.p7 .body{padding-top:4mm}
.p7 .eyebrow{color:var(--arena-adicora)}
.p7 h2{font-size:22pt}
.p7 h2 em{color:var(--arena-adicora)}
.occ{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-top:4mm}
.occ div{padding:3.2mm;border-radius:3.5mm;border:1px solid #56604c}
.occ .eyebrow{font-size:5.8pt}
.occ h3{font-size:13pt;margin-top:.8mm;color:#fff}
.occ p{font-size:7.6pt;line-height:1.35;margin-top:1.2mm;color:var(--aguacate)}
.season{margin-top:3mm;display:grid;gap:1.2mm;font-size:7.8pt;line-height:1.4;color:#d8d0c3}
.season b{color:#fff;font-weight:600}
.pay{display:flex;flex-wrap:wrap;align-items:center;gap:1.5mm;margin-top:3mm}
.pay span{font-size:6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--aguacate);margin-right:1mm}
.pay b{padding:.9mm 2.6mm;border-radius:99px;border:1px solid var(--arena-adicora);color:#fff;font-size:7.6pt;font-weight:600}
.quote-cta{margin-top:3mm;padding:3mm 3.5mm;border-radius:3.5mm;background:var(--arena-adicora);color:var(--alga);font-size:8.2pt;line-height:1.4}
.quote-cta b{font-family:var(--f-display);font-size:12pt;font-weight:600;display:block;line-height:1.1}
.contact{margin-top:auto;margin-bottom:12mm;display:grid;grid-template-columns:auto 1fr;gap:1mm 3mm;font-size:7.8pt;padding-top:3mm;border-top:1px solid #47503f}
.contact dt{color:var(--aguacate);font-size:6pt;letter-spacing:.16em;text-transform:uppercase;font-weight:700;padding-top:.5mm}
.contact dd{margin:0;color:#fff;font-weight:600}
`;

const folio = n => `<div class="folio"><span>Casa Maracuyá · Adícora</span><span><b>${String(n).padStart(2, "0")}</b> / 08</span></div>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Casa Maracuyá · Brochure</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;600;700&display=block">
<style>${CSS}</style></head><body>

<!-- 1 · Portada -->
<section class="pg cover">
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
  </div>
  <div class="folio"><span>Adícora, Falcón — Venezuela</span><span><b>01</b> / 08</span></div>
</section>

<!-- 2 · Filosofía -->
<section class="pg p2 linen">
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
  </div>
  ${folio(2)}
</section>

<!-- 3 · El equipo -->
<section class="pg p3 dark">
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
  </div>
  ${folio(3)}
</section>

<!-- 4 · La cocina -->
<section class="pg p4 linen">
  <div class="collage"><img src="${img["postre-maracuya"]}" alt=""><img src="${img["tequenos"]}" alt=""><img src="${img["cafe-de-la-tia"]}" alt=""></div>
  <div class="body">
    <p class="eyebrow">Alta gastronomía con identidad local</p>
    <h2>El corazón de la casa: <em>nuestra cocina.</em></h2>
    <ol class="steps">
      <li>La chef te propone un menú con ingredientes frescos y locales, con sabor de la costa y toque gourmet.</li>
      <li>Lo apruebas antes de llegar y nos cuentas alergias o gustos.</li>
      <li>Durante tu estadía eliges, día a día, qué te provoca para mañana.</li>
    </ol>
    <p class="bar">Siempre café, té y jugos naturales. <b>¿Traes tus bebidas?</b> Nuestro equipo las enfría, te prepara los tragos y te los sirve. La cocina es de uso exclusivo del equipo: así tú solo te sientas a la mesa.</p>
  </div>
  ${folio(4)}
</section>

<!-- 5 · Los planes -->
<section class="pg pp">
  <div class="body">
    <p class="eyebrow">Elige tu experiencia</p>
    <h2>Dos formas de vivir <em>la casa.</em></h2>
    <p class="lead">La casa y el equipo son siempre tuyos. Lo que eliges es cuánto cocina nuestra chef para ti.</p>
    <div class="both"><span>Casa completa y 3 habitaciones</span><span>Equipo de 7</span><span>Bienvenida con historia</span><span>Concierge</span><span>Café, té y jugos</span><span>Servicio de tus bebidas</span></div>
    <div class="plan">
      <div class="top"><h3>Experiencia Esencial</h3><span class="tag">Desayuno incluido</span></div>
      <p class="ideal">Para despertar con la mesa servida y salir a explorar Adícora y la península.</p>
      <ul><li>Desayuno de autor cada mañana, preparado por nuestra chef</li><li class="no">Sin almuerzo ni cena: la cocina es de uso exclusivo del equipo</li></ul>
    </div>
    <div class="plan plena">
      <div class="top"><h3>Experiencia Plena</h3><span class="tag">Todas las comidas</span></div>
      <p class="ideal">Para desconectarte de verdad: niños, grupos grandes o kiters que vuelven con hambre.</p>
      <ul><li>Desayuno de autor cada mañana</li><li>Almuerzo en casa o cava gourmet para la playa</li><li>Cena en tiempos: abrebocas o sopa, plato fuerte y postre</li></ul>
    </div>
    <p class="eyebrow tt">Tarifas por noche · por grupo</p>
    ${priceTable()}
    <p class="fine">Precios en dólares (USD) por noche, para todo el grupo, no por persona. Temporada regular desde 1 noche.</p>
  </div>
  ${folio(5)}
</section>

<!-- 6 · La villa -->
<section class="pg p5">
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
  </div>
  ${folio(6)}
</section>

<!-- 7 · Viento y mar -->
<section class="pg p6">
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
  </div>
  ${folio(7)}
</section>

<!-- 8 · Cierre -->
<section class="pg p7 dark">
  <div class="photo"><img src="${img["noche-piscina"]}" alt=""></div>
  <div class="body">
    <p class="eyebrow">Reservas</p>
    <h2>Diseña tu estadía en <em>Casa Maracuyá.</em></h2>
    <div class="occ">
      <div><p class="eyebrow">Plan íntimo</p><h3>1 a 6 huéspedes</h3></div>
      <div><p class="eyebrow">Full house</p><h3>7 a 12 huéspedes</h3></div>
    </div>
    <div class="season">
      <p><b>Siempre la casa entera, solo para tu grupo.</b> Tarifa fija por grupo, no por persona.</p>
      <p><b>Temporada regular:</b> desde 1 noche. Midweek (lunes a miércoles), la más conveniente, y weekend (jueves a domingo). Precios en la página 5.</p>
      <p><b>Temporada alta:</b> estadía mínima de 4 noches.</p>
    </div>
    <div class="pay"><span>Métodos de pago</span><b>Zelle</b><b>Efectivo</b><b>USDT</b></div>
    <div class="quote-cta"><b>Tu cotización viene con este brochure.</b>La preparamos para tus fechas, tu grupo y la experiencia que elijas.</div>
    <dl class="contact">
      <dt>WhatsApp</dt><dd>${WA_TXT}</dd>
      <dt>Instagram</dt><dd>@lacasamaracuya</dd>
      <dt>Web</dt><dd>casa-maracuya.com</dd>
      <dt>Correo</dt><dd>${EMAIL}</dd>
    </dl>
  </div>
  <div class="folio"><span>Viento, mar y cero prisa.</span><span><b>08</b> / 08</span></div>
</section>
</body></html>`;

const file = path.join(tmp, "brochure.html");
fs.writeFileSync(file, html);
execFileSync(browser, [
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
  "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
  `--user-data-dir=${path.join(tmp, "perfil")}`, `--print-to-pdf=${OUT}`, pathToFileURL(file).href
], { stdio: "ignore" });
console.log(`✓ brochure → public/brochure-casa-maracuya.pdf (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`);
if (process.env.PDFS_KEEP) console.log("HTML en", tmp); else fs.rmSync(tmp, { recursive: true, force: true });
