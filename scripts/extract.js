// Extrait le contenu des pages projet HTML existantes vers content/projects/*.json
// Usage : node scripts/extract.js
// À lancer UNE FOIS pour amorcer les données depuis les pages actuelles.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'content', 'projects');
fs.mkdirSync(OUT, { recursive: true });

const pages = [
  'human-record', 'interstellar', 'make-it-bigger',
  'meta-tinder', 'table-basse-mp01', 'variablefont', 'flower-particules'
];

// petits helpers d'extraction (regex tolérants sur le HTML produit à la main)
function pick(re, html, group = 1) { const m = html.match(re); return m ? m[group].trim() : ''; }
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

for (const slug of pages) {
  const file = path.join(ROOT, slug + '.html');
  if (!fs.existsSync(file)) { console.log('skip (absent):', slug); continue; }
  const html = fs.readFileSync(file, 'utf8');

  const title = decode(pick(/<title>([^<]*?)\s*—/, html));
  const h1 = decode(pick(/<h1[^>]*>([^<]*)<\/h1>/, html));

  // meta-row : rôle / support / univers
  const meta = [];
  const metaBlock = pick(/<div class="meta-row[^"]*">([\s\S]*?)<\/div>\s*<\/div>/, html) ||
                    pick(/<div class="meta-row[^"]*">([\s\S]*?)<\/div>/, html);
  const metaRe = /<div class="meta-item"><p class="eyebrow">([^<]*)<\/p><strong>([^<]*)<\/strong><\/div>/g;
  let mm;
  const metaSource = html; // on cherche dans tout le html
  while ((mm = metaRe.exec(metaSource)) !== null) {
    meta.push({ label: decode(mm[1].trim()), value: decode(mm[2].trim()) });
  }

  // corps de texte (paragraphes du project-body)
  const bodyHtml = pick(/<div class="project-body">([\s\S]*?)<\/div>/, html);
  const paras = [];
  const pRe = /<p>([\s\S]*?)<\/p>/g;
  let pm;
  while ((pm = pRe.exec(bodyHtml)) !== null) paras.push(decode(pm[1].trim()));

  // image du lead (à droite du titre)
  const leadImg = pick(/<div class="project-lead-media">\s*<img src="([^"]+)"[^>]*alt="([^"]*)"/, html, 1);
  const leadAlt = decode(pick(/<div class="project-lead-media">\s*<img src="[^"]+"[^>]*alt="([^"]*)"/, html, 1));

  // blocs média (rangées d'images) de la section suivante
  const rows = [];
  const rowRe = /<div class="project-media[^"]*">([\s\S]*?)<\/div>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const imgs = [];
    const imgRe = /<img src="([^"]+)"[^>]*alt="([^"]*)"/g;
    let im;
    while ((im = imgRe.exec(rm[1])) !== null) imgs.push({ src: im[1], alt: decode(im[2]) });
    if (imgs.length) rows.push({ type: 'images', images: imgs });
  }

  // vidéo motion éventuelle (project-hero-media avec <video>)
  const motion = pick(/<div class="project-hero-media[^"]*">\s*<video[^>]*>\s*<source src="([^"]+)"/, html);

  const data = {
    slug,
    title: h1 || title,
    meta,
    body: paras,
    lead_image: leadImg ? { src: leadImg, alt: leadAlt } : null,
    media_rows: rows,
    motion_video: motion || ''
  };

  fs.writeFileSync(path.join(OUT, slug + '.json'), JSON.stringify(data, null, 2) + '\n');
  console.log('OK:', slug, '| meta:', meta.length, '| paras:', paras.length, '| rows:', rows.length, '| lead:', !!leadImg, '| motion:', !!motion);
}
console.log('Extraction terminée →', OUT);
