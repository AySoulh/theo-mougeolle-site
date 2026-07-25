// Build : régénère les pages projet HTML à partir de content/projects/*.json
// Usage : node scripts/build.js
// Lancé automatiquement par GitHub Actions à chaque modification du contenu.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'content', 'projects');

// versions de cache-busting (repris depuis un fichier existant pour rester synchro)
function currentVersions() {
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = (idx.match(/style\.css\?v=(\d+)/) || [])[1] || '1';
  const js = (idx.match(/main\.js\?v=(\d+)/) || [])[1] || '1';
  return { css, js };
}
const V = currentVersions();

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Titre : échappe puis convertit les sauts de ligne en <br> (permet un titre
// sur plusieurs lignes, comme « Make it<br>bigger »).
function escTitle(s) {
  return esc(s).replace(/\r?\n/g, '<br>');
}

function renderMeta(meta) {
  if (!meta || !meta.length) return '';
  const items = meta.map(function (m) {
    return '      <div class="meta-item"><p class="eyebrow">' + esc(m.label) +
           '</p><strong>' + esc(m.value) + '</strong></div>';
  }).join('\n');
  return '    <div class="meta-row reveal">\n' + items + '\n    </div>';
}

function renderBody(body) {
  if (!body || !body.length) return '';
  const ps = body.map(function (p) { return '          <p>' + esc(p) + '</p>'; }).join('\n');
  return '        <div class="project-body">\n' + ps + '\n        </div>';
}

function renderLeadMedia(img) {
  if (!img || !img.src) return '      <div class="project-lead-media"></div>';
  return '      <div class="project-lead-media"><img src="' + esc(img.src) +
         '" alt="' + esc(img.alt) + '" loading="lazy"></div>';
}

function renderRows(rows) {
  if (!rows || !rows.length) return '';
  return rows.map(function (row) {
    const imgs = (row.images || []).map(function (im) {
      return '      <img src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" loading="lazy">';
    }).join('\n');
    const single = (row.images || []).length === 1 ? ' single' : '';
    var block = '    <div class="project-media' + single + ' reveal">\n' + imgs + '\n    </div>';
    if (row.caption) {
      block += '\n    <p class="media-caption">' + esc(row.caption) + '</p>';
    }
    return block;
  }).join('\n\n');
}

function renderMotion(src) {
  if (!src) return '';
  return '\n    <div class="project-hero-media reveal">\n' +
         '      <video autoplay muted loop playsinline style="width:100%; display:block;">\n' +
         '        <source src="' + esc(src) + '" type="video/mp4">\n' +
         '      </video>\n' +
         '    </div>';
}

function page(data) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(String(data.title).replace(/\r?\n/g," "))} — Théo Mougeolle</title>
<link rel="stylesheet" href="assets/css/style.css?v=${V.css}">
</head>
<body>

<header class="site-header">
  <div class="wrap">
    <a href="index.html" class="logo"><img src="assets/img/misc/logo.svg" alt="Théo Mougeolle"></a>
    <nav class="nav">
      <a href="index.html#projets">Projets</a>
      <a href="index.html#contact">Contact</a>
    </nav>
    <button class="nav-toggle">Menu</button>
  </div>
</header>

<main>
  <section class="project-hero wrap">
    <div class="project-lead">
      <div class="project-lead-text">
        <h1 class="reveal">${escTitle(data.title)}</h1>
${renderMeta(data.meta)}
${renderBody(data.body)}
      </div>
${renderLeadMedia(data.lead_image)}
    </div>
  </section>

  <section class="wrap">
${renderRows(data.media_rows)}
${renderMotion(data.motion_video)}

    <a class="back-link reveal" href="index.html#projets">← Retour aux projets</a>
  </section>
</main>

<footer class="site-footer footer-in">
  <div class="wrap footer-grid">
    <div class="footer-mail">
      <a href="mailto:contact@theomougeolle.com">contact@theomougeolle.com</a>
      <span>&copy; <span id="year"></span> Théo Mougeolle</span>
    </div>
    <a class="social footer-ig" href="https://www.instagram.com/theo__mgl/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.4"/><circle cx="12" cy="12" r="4.6"/><circle cx="17.7" cy="6.3" r="1.2" fill="currentColor" stroke="none"/></svg>
    </a>
    <div class="footer-logo"><img src="assets/img/misc/logo.svg" alt="Théo Mougeolle"></div>
    <a class="social footer-li" href="https://www.linkedin.com/notifications/?filter=all" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.85V21h-4z"/></svg>
    </a>
    <div class="footer-links">
      <a href="index.html#projets">Projets</a>
      <a href="index.html#contact">Contact</a>
    </div>
  </div>
</footer>

<script>document.getElementById('year').textContent = new Date().getFullYear();</script>
<script src="assets/js/vendor/lenis.min.js"></script>
<script src="assets/js/vendor/curtains.umd.min.js"></script>
<script src="assets/js/main.js?v=${V.js}"></script>
</body>
</html>
`;
}

const files = fs.readdirSync(DATA).filter(function (f) { return f.endsWith('.json'); });
let count = 0;
files.forEach(function (f) {
  const data = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
  if (!data.slug) { console.log('skip (pas de slug):', f); return; }
  fs.writeFileSync(path.join(ROOT, data.slug + '.html'), page(data));
  count++;
  console.log('généré:', data.slug + '.html');
});
console.log('Build terminé :', count, 'page(s).');
