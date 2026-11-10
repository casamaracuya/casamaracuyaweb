// Genera los PDF de la casa (español e inglés) con los colores y letras de la web:
//   · Normas de la casa: el mismo texto que la página /normas (src/site/normas-data.js).
//   · Ficha de registro en blanco, para imprimir (src/site/ficha-data.js). Sin fotos ni logos.
// Los imprime con Chrome o Edge sin ventana. Uso: npm run pdfs  →  archivos en public/
// Necesita internet para bajar las letras (Google Fonts).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { NORMAS, PDF_URL } from "../src/site/normas-data.js";
import { FICHA, OPCIONES, FICHA_PDF } from "../src/site/ficha-data.js";
// contacto.js usa import.meta.env (solo existe en Vite): el correo se lee del texto.
const EMAIL = fs.readFileSync("src/lib/contacto.js", "utf8").match(/EMAIL = "([^"]+)"/)[1];

const ROOT = path.resolve(".");
const file = p => pathToFileURL(path.join(ROOT, "public", p)).href;

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

const FOOT = {
  es: { motto: "Viento, mar y cero prisa.", place: "Adícora, Falcón, Venezuela · Al lado del faro", thanks: "Gracias por cuidar la casa como nosotros la cuidamos." },
  en: { motto: "Wind, sea and no rush.", place: "Adícora, Falcón, Venezuela · Next to the lighthouse", thanks: "Thank you for caring for the house the way we do." }
};

const CSS = `
:root{
  --arena-adicora:#C4A56C; --arena-seca:#E8DCCD; --alga:#2E2E24; --aguacate:#B8B89C; --sol:#F9EC9E;
  --laguna:#E6EFEE; --raspao:#F9FFF4; --merey:#D4C7BE; --melon:#778B63; --verde-tabla:#3D3D2A; --nocturna:#2E352A;
  --ink:var(--alga); --ink-soft:var(--verde-tabla); --muted:#5f604f; --line:var(--merey); --accent:var(--arena-adicora);
  --f-display:"Cormorant Garamond", Garamond, "Times New Roman", serif;
  --f-body:"Manrope", "Segoe UI", system-ui, sans-serif;
}
@page{size:Letter;margin:17mm 18mm 18mm}
@page cover{margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--f-body);color:var(--ink);font-size:10pt;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3{font-family:var(--f-display);font-weight:500;line-height:1.05;margin:0;letter-spacing:-.01em}
p{margin:0}
b{font-weight:700;color:var(--ink)}
.eyebrow{font-size:7.5pt;text-transform:uppercase;letter-spacing:.2em;font-weight:700;color:var(--verde-tabla)}
.linen{background-image:repeating-linear-gradient(0deg,rgba(46,46,36,.05) 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,rgba(46,46,36,.035) 0 1px,transparent 1px 4px)}

/* Portada */
.cover{page:cover;height:279.4mm;display:grid;grid-template-rows:96mm 1fr;background-color:var(--arena-seca);overflow:hidden;break-after:page}
.cover-photo{position:relative;overflow:hidden}
.cover-photo img{width:100%;height:100%;object-fit:cover;object-position:center 62%;display:block}
.cover-photo .logo{position:absolute;top:12mm;left:18mm;width:44mm;height:auto;filter:drop-shadow(0 1px 8px rgba(0,0,0,.25))}
.cover-body{position:relative;padding:13mm 18mm 14mm;display:flex;flex-direction:column}
.cover-body .seal{position:absolute;right:16mm;top:-21mm;width:42mm;height:42mm;padding:3mm;border-radius:50%;background:var(--arena-seca)}
.cover h1{font-size:40pt;margin-top:5mm;max-width:11ch}
.cover h1 em{font-style:italic;color:var(--melon)}
.cover .sub{font-family:var(--f-display);font-style:italic;font-size:16pt;color:var(--ink-soft);margin-top:4mm}
.welcome{margin-top:8mm;padding-left:6mm;border-left:2px solid var(--accent);color:var(--ink-soft);font-size:10pt;line-height:1.7;max-width:150mm}
.welcome p+p{margin-top:3mm}
.key{margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:5mm;padding-top:6mm;border-top:1px solid var(--line)}
.key dt{font-size:7pt;text-transform:uppercase;letter-spacing:.16em;font-weight:700;color:var(--melon)}
.key dd{font-variant-numeric:lining-nums;margin:1mm 0 0;font-family:var(--f-display);font-size:14pt;line-height:1.15}
.key div{margin:0}

/* Normas */
.rules-title{display:flex;align-items:end;justify-content:space-between;gap:8mm;padding-bottom:5mm;margin-bottom:2mm}
.rules-title h2{font-size:26pt;max-width:22ch}
.rules-title img{width:30mm;height:auto}
.part{margin-top:9mm}
.part-head{display:grid;grid-template-columns:16mm 1fr;gap:4mm;align-items:end;padding:5mm 6mm;border-radius:5mm;background:var(--arena-seca);break-after:avoid}
.part:nth-of-type(2) .part-head{background:var(--laguna)}
.part:nth-of-type(3) .part-head{background:#ECEEDC}
.roman{font-family:var(--f-display);font-size:30pt;line-height:.85;color:var(--arena-adicora)}
.part:nth-of-type(2) .roman{color:var(--melon)}
.part-head h3{font-size:17pt}
.part-head .eyebrow{margin-top:1.5mm}
.rule{display:grid;grid-template-columns:16mm 1fr;gap:4mm;padding:4.5mm 6mm;border-bottom:1px solid var(--line);break-inside:avoid}
.rule:last-child{border-bottom:0}
.rule .n{font-variant-numeric:lining-nums;font-family:var(--f-display);font-style:italic;font-size:17pt;line-height:1;color:var(--accent)}
.rule h4{font-family:var(--f-display);font-weight:600;font-size:13pt;line-height:1.15;margin:0 0 1.5mm}
.rule p,.rule li{color:var(--ink-soft)}
.rule ul{list-style:none;margin:0;padding:0;display:grid;gap:1.4mm}
.rule li{position:relative;padding-left:4.5mm}
.rule li::before{content:"";position:absolute;left:.5mm;top:.62em;width:1.6mm;height:1.6mm;border-radius:50%;background:var(--accent)}

/* Cierre */
.closing{margin-top:10mm;padding:9mm 10mm;border-radius:5mm;background:var(--nocturna);color:var(--arena-seca);display:grid;grid-template-columns:auto 1fr;gap:6mm 10mm;align-items:center;break-inside:avoid}
.closing img{width:42mm;height:auto}
.closing .motto{font-family:var(--f-display);font-style:italic;font-size:17pt;line-height:1.2}
.closing .thanks{margin-top:2mm;color:var(--aguacate);font-size:9pt}
.closing .contact{grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:space-between;gap:2mm 8mm;padding-top:5mm;border-top:1px solid #47503f;font-size:8.5pt;color:var(--aguacate)}
.closing .contact b{color:var(--arena-seca);font-weight:600}
`;

function page(lang) {
  const d = NORMAS[lang], f = FOOT[lang];
  let n = 0;
  const parts = d.parts.map(pt => `
    <section class="part">
      <div class="part-head"><span class="roman">${pt.n}</span><div><h3>${pt.h}</h3>${pt.note ? `<p class="eyebrow">${pt.note}</p>` : ""}</div></div>
      ${pt.rules.map(([h, items]) => `
        <div class="rule"><span class="n">${String(++n).padStart(2, "0")}</span><div><h4>${h}</h4>
          ${items.length > 1 ? `<ul>${items.map(x => `<li>${x}</li>`).join("")}</ul>` : `<p>${items[0]}</p>`}
        </div></div>`).join("")}
    </section>`).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${d.doc}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Manrope:wght@400;500;600;700&display=block">
<style>${CSS}</style></head><body>
  <section class="cover linen">
    <div class="cover-photo"><img src="${file("fotos/muelle-atardecer.jpg")}" alt=""><img class="logo" src="${file("logo/logo-claro.svg")}" alt="Casa Maracuyá"></div>
    <div class="cover-body">
      <img class="seal" src="${file("logo/sello-circular.svg")}" alt="">
      <p class="eyebrow">${d.eyebrow}</p>
      <h1>${d.title} <em>${d.titleEm}</em></h1>
      <p class="sub">${d.sub}</p>
      <div class="welcome">${d.welcome.map(w => `<p>${w}</p>`).join("")}</div>
      <dl class="key">${d.key.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    </div>
  </section>
  <main>
    <div class="rules-title"><div><p class="eyebrow">Casa Maracuyá</p><h2>${d.rulesT}</h2></div><img src="${file("logo/logo-dorado.svg")}" alt=""></div>
    ${parts}
    <div class="closing">
      <img src="${file("logo/logo-claro.svg")}" alt="Casa Maracuyá">
      <div><p class="motto">${f.motto}</p><p class="thanks">${f.thanks}</p></div>
      <div class="contact"><span>${f.place}</span><span><b>${EMAIL}</b> · @lacasamaracuya · casa-maracuya.com</span></div>
    </div>
  </main>
</body></html>`;
}

/* ---------- Ficha de registro en blanco ---------- */
const FICHA_CSS = `
:root{
  --arena-adicora:#C4A56C; --arena-seca:#E8DCCD; --alga:#2E2E24; --laguna:#E6EFEE; --merey:#D4C7BE; --melon:#778B63; --verde-tabla:#3D3D2A;
  --ink:var(--alga); --muted:#5f604f; --line:var(--merey);
  --f-display:"Cormorant Garamond", Garamond, "Times New Roman", serif;
  --f-body:"Manrope", "Segoe UI", system-ui, sans-serif;
}
@page{size:Letter;margin:13mm 15mm 13mm}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:var(--f-body);color:var(--ink);font-size:8.6pt;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2{font-family:var(--f-display);font-weight:500;margin:0;line-height:1.05}
p{margin:0}
.head{display:flex;justify-content:space-between;align-items:end;gap:8mm;padding-bottom:4mm;border-bottom:1.5px solid var(--ink)}
.brand{font-family:var(--f-display);font-size:24pt;letter-spacing:.06em;line-height:1}
.brand small{display:block;font:700 6.5pt/1 var(--f-body);letter-spacing:.24em;text-transform:uppercase;color:var(--arena-adicora);margin-top:2mm}
.head h1{font-size:17pt;text-align:right}
.head h1 em{font-style:italic;color:var(--melon)}
.head .code{font-size:7.5pt;color:var(--muted);text-align:right;margin-top:1.5mm}
.sec{margin-top:4.2mm;break-inside:avoid}
.sec h2{display:flex;gap:2.5mm;align-items:baseline;font-size:12.5pt;padding:1.6mm 3mm;background:var(--arena-seca);border-radius:2mm}
.sec h2 span{font-style:italic;color:var(--arena-adicora);font-size:13pt}
.sec h2 small{margin-left:auto;font:600 6.5pt/1 var(--f-body);letter-spacing:.14em;text-transform:uppercase;color:var(--verde-tabla)}
table{width:100%;border-collapse:collapse;margin-top:1.6mm}
td,th{border:1px solid var(--line);padding:0 2.2mm;height:7.4mm;vertical-align:middle;text-align:left}
th{font:700 6.4pt/1.2 var(--f-body);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);background:#FAF7F2;width:27%}
.occ th{width:auto;height:6mm}
.occ td{height:6.5mm}
.occ td:first-child,.occ th:first-child{width:7mm;text-align:center;font-family:var(--f-display);font-style:italic;font-size:10pt;color:var(--arena-adicora)}
.hint{color:var(--muted);font-size:7.5pt}
.box{display:inline-block;width:3mm;height:3mm;border:1px solid var(--ink);border-radius:.6mm;vertical-align:-.4mm;margin-right:1.2mm}
.opts{display:flex;flex-wrap:wrap;gap:1mm 5mm;padding:1.4mm 0}
.line{display:inline-block;border-bottom:1px solid var(--ink);min-width:30mm;height:3.5mm;vertical-align:bottom}
.wide{display:flex;align-items:end;gap:2mm;padding-bottom:1.4mm}.wide .line{flex:1}
.rules{margin:1.8mm 0 0;padding-left:4mm;display:grid;gap:.8mm;font-size:7.8pt;color:var(--verde-tabla)}
.rules b{color:var(--ink)}
.declara{margin-top:1.8mm;font-size:8pt}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:14mm;break-inside:avoid}
.sign div{border-top:1px solid var(--ink);padding-top:1.6mm;text-align:center}
.sign b{display:block;font-size:8pt}
.sign span{color:var(--muted);font-size:7.5pt}
.foot{margin-top:6mm;padding-top:2.5mm;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:var(--muted);font-size:7pt}
`;
const opts = (k, lang, extra = []) => `<div class="opts">${[...OPCIONES[k].map(o => lang === "en" ? o.en : o.v), ...extra].map(x => `<span><i class="box"></i>${x}</span>`).join("")}</div>`;
function fichaPage(lang) {
  const d = FICHA[lang];
  const date = `____ / ____ / 20____`;
  const rows = Array.from({ length: 12 }, (_, i) => `<tr><td>${i + 1}</td><td>${i === 0 ? `<span class="hint">(${d.titular})</span>` : ""}</td><td></td><td></td></tr>`).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${d.doc}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Manrope:wght@400;600;700&display=block">
<style>${FICHA_CSS}</style></head><body>
  <header class="head">
    <div class="brand">CASA MARACUYÁ<small>Relaxing Getaway · Adícora, Falcón</small></div>
    <div><h1>${d.title} <em>${d.titleEm}</em></h1><p class="code">${lang === "en" ? "Booking" : "Reserva"} N° ________</p></div>
  </header>

  <section class="sec"><h2><span>1</span>${d.s1}</h2><table>
    <tr><th>${d.nombre}</th><td colspan="3"></td></tr>
    <tr><th>${d.documento}</th><td></td><th>${d.telefono}</th><td></td></tr>
    <tr><th>${d.email}</th><td></td><th>${d.ciudad}</th><td></td></tr>
  </table></section>

  <section class="sec"><h2><span>2</span>${d.s2}</h2><table>
    <tr><th>${d.checkin}</th><td>${date} <span class="hint">(${d.checkinH})</span></td><th>${d.checkout}</th><td>${date} <span class="hint">(${d.checkoutH})</span></td></tr>
    <tr><th>${d.hora}</th><td></td><th>${d.total}</th><td>${d.adultos}: ____ &nbsp; ${d.ninos}: ____ <span class="hint">(${d.max.toLowerCase()})</span></td></tr>
    <tr><th>${d.vehiculos}</th><td colspan="3">1. <i class="line" style="min-width:52mm"></i> &nbsp; 2. <i class="line" style="min-width:52mm"></i></td></tr>
  </table></section>

  <section class="sec"><h2><span>3</span>${d.s3}<small>${d.max}</small></h2>
    <table class="occ"><tr><th>${d.n}</th><th>${d.acNombre}</th><th style="width:30%">${d.acDoc}</th><th style="width:17%">${d.acEdad}</th></tr>${rows}</table>
    <p class="hint" style="margin-top:1.2mm">${d.s3note}</p></section>

  <section class="sec"><h2><span>4</span>${d.s4}<small>${d.s4note.replace(/\.$/, "")}</small></h2><table>
    <tr><th>${d.alergias}</th><td>${opts("alergias", lang, [d.ninguna])}<div class="wide"><span class="hint">${d.detalle}:</span><i class="line"></i></div></td></tr>
    <tr><th>${d.bebidas}</th><td>${opts("bebidas", lang)}<div class="wide"><span class="hint">${d.otrasBebidas}:</span><i class="line"></i></div></td></tr>
    <tr><th>${d.req}</th><td>${opts("requerimientos", lang)}<div class="wide"><span class="hint">${d.otrosReq}:</span><i class="line"></i></div></td></tr>
  </table></section>

  <section class="sec"><h2><span>5</span>${d.s5}</h2><table>
    <tr><th>${d.mascota}</th><td><div class="opts"><span><i class="box"></i>${d.noMascota}</span><span><i class="box"></i>${d.siMascota} →</span>
      <span>${d.mascotaNombre}: <i class="line"></i></span><span>${d.mascotaRaza}: <i class="line"></i></span></div></td></tr>
    <tr><th>${d.motivo}</th><td>${opts("motivo", lang, [`${d.otro}: <i class="line"></i>`])}</td></tr>
  </table></section>

  <section class="sec"><h2><span>6</span>${d.s6}</h2>
    <p class="declara">${d.declara}</p>
    <ol class="rules">${d.normas.map(([k, v]) => `<li><b>${k}:</b> ${v}</li>`).join("")}</ol>
  </section>

  <div class="sign">
    <div><b>${d.firmaPdf}</b><span>${d.documento}: ____________________</span></div>
    <div><b>${d.recibido}</b><span>${d.fecha}: ${date}</span></div>
  </div>
  <div class="foot"><span>Casa Maracuyá · Adícora, Falcón, Venezuela</span><span>${EMAIL} · casa-maracuya.com${lang === "en" ? "/en/house-rules" : "/normas"}</span></div>
</body></html>`;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdfs-"));
const JOBS = ["es", "en"].flatMap(lang => [
  { name: `normas-${lang}`, html: page(lang), url: PDF_URL[lang] },
  { name: `ficha-${lang}`, html: fichaPage(lang), url: FICHA_PDF[lang] }
]);
for (const job of JOBS) {
  const html = path.join(tmp, `${job.name}.html`);
  fs.writeFileSync(html, job.html);
  const out = path.join(ROOT, "public", job.url.slice(1));
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
    "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
    `--user-data-dir=${path.join(tmp, "perfil")}`, `--print-to-pdf=${out}`, pathToFileURL(html).href
  ], { stdio: "ignore" });
  console.log(`✓ ${job.name.padEnd(9)} → public${job.url} (${(fs.statSync(out).size / 1024).toFixed(0)} kB)`);
}
if (process.env.PDFS_KEEP) console.log("HTML en", tmp); else fs.rmSync(tmp, { recursive: true, force: true });
