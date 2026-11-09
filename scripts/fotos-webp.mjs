// Convierte las fotos de public/fotos y las portadas de public/videos a WebP.
// Uso: npm run fotos   (después de agregar o cambiar una foto .jpg)
// Las .jpg originales se quedan: la de faro-piscina.jpg la usan WhatsApp y las
// redes al compartir el enlace (og:image), que no siempre aceptan WebP.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIRS = ["public/fotos", "public/videos"];
const MAX = 2000;      // lado más largo en píxeles: suficiente para pantallas grandes
const QUALITY = 78;
// Fotos que la web muestra pequeñas: no hace falta más que esto (incluye pantallas retina).
const SMALL = { "detalle-tejido": 640, "detalle-cana": 640, "detalle-sofa": 640 };

let antes = 0, despues = 0;
for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir).filter(f => /\.jpe?g$/i.test(f))) {
    const src = path.join(dir, f), out = src.replace(/\.jpe?g$/i, ".webp");
    const img = sharp(src).rotate();
    const { width, height } = await img.metadata();
    const max = SMALL[path.parse(f).name] || MAX;
    await img.resize(width >= height ? { width: Math.min(width, max) } : { height: Math.min(height, max) })
      .webp({ quality: QUALITY, effort: 6 }).toFile(out);
    const a = fs.statSync(src).size, b = fs.statSync(out).size; antes += a; despues += b;
    console.log(`${(a / 1024).toFixed(0).padStart(5)} KB → ${(b / 1024).toFixed(0).padStart(4)} KB  ${out}`);
  }
}
console.log(`Total: ${(antes / 1024).toFixed(0)} KB → ${(despues / 1024).toFixed(0)} KB (${Math.round((1 - despues / antes) * 100)}% menos)`);
