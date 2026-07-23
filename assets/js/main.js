document.addEventListener('DOMContentLoaded', function () {
  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      var isOpen = nav.classList.contains('open');
      toggle.textContent = isOpen ? 'Fermer' : 'Menu';
      var headerEl = document.querySelector('.site-header');
      if (headerEl) headerEl.classList.toggle('menu-open', isOpen);
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.textContent = 'Menu';
        var headerEl = document.querySelector('.site-header');
        if (headerEl) headerEl.classList.remove('menu-open');
      });
    });
  }

  // Header transparent sur la vidéo hero, blanc une fois qu'on a scrollé
  var header = document.querySelector('.site-header');
  var heroVideo = document.getElementById('hero-video');
  if (header && heroVideo && 'IntersectionObserver' in window) {
    header.classList.add('on-hero');
    var headerIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        header.classList.toggle('on-hero', entry.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });
    headerIO.observe(heroVideo);
  }

  // Animations au scroll
  var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }


  // ---------- Scroll fluide (Lenis) ----------
  // Instanciation indispensable : sans elle, lenis.min.js est chargé mais ne
  // fait rien, et le site retombe sur le scroll brut du navigateur.
  if (window.Lenis && !window.__lenis) {
    window.__lenis = new Lenis({ autoRaf: true, lerp: 0.11 });
  }

  // ---------- Vidéo hero -> suite du site : fondu au rythme du scroll ----------
  // La section qui suit le hero est maintenue EXACTEMENT à sa place finale
  // (calée en haut de l'écran) pendant toute la durée du fondu : elle
  // n'arrive pas "en glissant par-dessus", elle apparaît sur place, de 0 à
  // 100% d'opacité, au rythme du scroll. Une fois à 100%, le décalage vaut
  // pile zéro et le scroll normal reprend, sans aucune rupture.
  (function () {
    var hero = document.getElementById('hero-video');
    var after = document.querySelector('.after-hero');
    if (!hero || !after) return;

    var pinTop = 0;   // distance de scroll que dure le fondu (= hauteur du hero)

    function measure() {
      // offsetTop n'est pas affecté par le transform : mesure fiable.
      pinTop = after.offsetTop || window.innerHeight;
      apply();
    }

    function apply() {
      var y = window.scrollY;
      var p = pinTop > 0 ? Math.min(1, Math.max(0, y / pinTop)) : 1;

      hero.style.opacity = String(1 - p);
      // opacity:0 laisse l'élément cliquable : on le retire vraiment une fois
      // le fondu terminé, sinon il bloquerait les clics sur le contenu.
      hero.style.visibility = p >= 1 ? 'hidden' : '';

      if (p < 1) {
        // On annule le défilement : la section reste collée en haut de l'écran.
        after.style.transform = 'translateY(' + (y - pinTop).toFixed(1) + 'px)';
        after.style.opacity = String(p);
      } else {
        after.style.transform = '';
        after.style.opacity = '';
      }

      // Les images des cartes ne sont PAS affichées par le HTML : elles sont
      // dessinées par le canvas WebGL, qui est un élément séparé, en dehors de
      // .after-hero. L'opacité appliquée ci-dessus ne les atteint donc pas :
      // sans cette ligne elles restent à 100% et s'affichent par-dessus la
      // vidéo dès le chargement, au lieu d'apparaître en fondu.
      if (!glStage) glStage = document.getElementById('gl-stage');
      if (glStage) glStage.style.opacity = p < 1 ? String(p) : '';

      // Même problème pour la POSITION : la couche WebGL suit le scroll brut
      // du navigateur, alors que le HTML est décalé pour rester en place.
      // Résultat sans ce recalage : les covers défilent pendant que leurs
      // textes restent fixes, et se retrouvent désalignées (jusqu'à un écran
      // entier de décalage). updatePosition() relit la position écran réelle
      // de chaque carte, décalage compris, ce qui rend les covers solidaires
      // de leurs textes.
      // On le fait systématiquement, et pas seulement pendant le fondu : le
      // suivi incrémental de curtains accumule l'erreur dès qu'un événement de
      // scroll est perdu ou regroupé, alors qu'une relecture de la position
      // réelle est auto-corrective.
      var planes = window.__glPlanes;
      if (planes) {
        for (var i = 0; i < planes.length; i++) {
          if (planes[i].updatePosition) planes[i].updatePosition();
        }
      }

      if (scrollCueEl) scrollCueEl.style.opacity = String(Math.max(0, 1 - p * 2.2));
      return p;
    }

    var scrollCueEl = document.querySelector('.scroll-cue');
    var glStage = null;
    var rafId = 0;
    var tailFrames = 0;
    var TAIL = 20;   // ~1/3 s de suivi après le dernier événement de scroll

    // Pendant le fondu, on recalcule à CHAQUE frame plutôt que de se fier aux
    // seuls événements de scroll : ceux-ci peuvent être regroupés ou limités
    // par le navigateur, et un seul raté se verrait comme un décrochage du
    // bloc. Après le fondu, la boucle continue quelques frames au-delà du
    // dernier scroll (le temps que la position se stabilise), puis s'arrête
    // complètement pour ne rien consommer à l'arrêt.
    function tick() {
      rafId = 0;
      var p = apply();
      if (p < 1 || tailFrames < TAIL) {
        tailFrames++;
        rafId = requestAnimationFrame(tick);
      }
    }
    function kick() {
      tailFrames = 0;
      apply();                                   // immédiat : aucun retard
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    measure();
    kick();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);
  })();

  // ---------- Arrivée des textes : montée derrière un masque ----------
  // Chaque texte qui arrive pour la première fois à l'écran reprend le geste
  // de la phrase du hero : il monte depuis le bas et se dévoile derrière un
  // masque. Les textes d'un même bloc s'enchaînent avec un léger décalage.
  (function () {
    var SEL = 'main h1, main h2, main h3, main h4, main p, main .eyebrow, main blockquote, main figcaption';
    var els = [].slice.call(document.querySelectorAll(SEL));

    var targets = [];
    els.forEach(function (el) {
      if (el.closest('.hero-video')) return;          // le hero a déjà sa propre animation
      if (el.closest('.rise')) return;                // pas d'imbrication
      if (el.querySelector('h1,h2,h3,h4,p')) return;  // conteneur, pas une ligne de texte
      if (!el.textContent.trim()) return;
      var inner = document.createElement('span');
      inner.className = 'rise-in';
      while (el.firstChild) inner.appendChild(el.firstChild);
      el.appendChild(inner);
      el.classList.add('rise');
      targets.push(el);
    });
    if (!targets.length) return;

    // Décalage progressif entre les textes d'un même bloc.
    var counters = new Map();
    targets.forEach(function (el) {
      var group = el.closest('.card, .section-head, .section, footer') || document.body;
      var i = counters.get(group) || 0;
      el.style.setProperty('--rise-i', i);
      counters.set(group, i + 1);
    });

    if (!('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('rise-go'); });
      return;
    }

    // Déclenchement quand le texte est à 60% visible. Un bloc plus haut que
    // 60% de l'écran ne pourra jamais atteindre ce ratio : dans ce cas on se
    // contente qu'il soit entré dans l'écran.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var tall = entry.boundingClientRect.height > window.innerHeight * 0.6;
        if (entry.intersectionRatio >= 0.6 || tall) {
          entry.target.classList.add('rise-go');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: [0, 0.6] });
    targets.forEach(function (el) { io.observe(el); });
  })();

// ---------- Quadrillage overlay ----------
// Les lignes verticales reprennent EXACTEMENT les 12 colonnes de la grille du
// site (celle de .pgrid) : elles sont mesurées sur un vrai conteneur .wrap de
// la page, donc elles restent alignées sur les cartes quelle que soit la
// largeur d'écran. Le quadrillage est placé sous les images et la vidéo
// (z-index dans le CSS).
(function () {
  var COLS = 12;
  var ov = document.createElement('div');
  ov.className = 'grid-overlay';
  document.body.appendChild(ov);

  function metrics() {
    var wrap = document.querySelector('.wrap');
    if (!wrap) return null;
    var r = wrap.getBoundingClientRect();
    var cs = getComputedStyle(wrap);
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padR = parseFloat(cs.paddingRight) || 0;
    var left = r.left + padL;
    var width = r.width - padL - padR;
    if (width <= 0) return null;

    // Gouttière réelle de la grille (.pgrid), sinon repli sur 24px.
    var gap = 24;
    var pg = document.querySelector('.pgrid');
    if (pg) {
      var g = parseFloat(getComputedStyle(pg).columnGap);
      if (!isNaN(g)) gap = g;
    }
    return { left: left, width: width, gap: gap };
  }

  function build() {
    ov.innerHTML = '';
    var m = metrics();
    if (!m) return;

    // Le conteneur est en position fixed sur tout l'écran : on le cale sur la
    // zone de contenu réelle plutôt que sur des marges approximatives.
    ov.style.left = m.left + 'px';
    ov.style.right = 'auto';
    ov.style.width = m.width + 'px';

    var colW = (m.width - m.gap * (COLS - 1)) / COLS;

    // Bords gauche et droit de chaque colonne : c'est là que se calent les
    // cartes, donc les lignes tombent pile sur leurs arêtes.
    var xs = [];
    for (var c = 0; c < COLS; c++) {
      var x0 = c * (colW + m.gap);
      xs.push(x0);
      xs.push(x0 + colW);
    }

    xs.forEach(function (x) {
      var v = document.createElement('span');
      v.className = 'gl-v';
      v.style.left = x.toFixed(2) + 'px';
      ov.appendChild(v);
    });

    // Lignes horizontales + croix, en gardant le rythme d'origine (les croix
    // restent sur les tiers pour ne pas surcharger).
    var hStep = Math.max(240, Math.round(window.innerHeight / 3));
    var crossX = [0, m.width / 3, (m.width * 2) / 3, m.width];
    for (var y = hStep; y < window.innerHeight; y += hStep) {
      var h = document.createElement('span');
      h.className = 'gl-h';
      h.style.top = y + 'px';
      ov.appendChild(h);
      crossX.forEach(function (x) {
        var k = document.createElement('span');
        k.className = 'gl-x';
        k.textContent = '+';
        k.style.left = x.toFixed(2) + 'px';
        k.style.top = y + 'px';
        ov.appendChild(k);
      });
    }
  }

  build();
  window.addEventListener('resize', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();

  initScrollWarp();
});

// ============================================================
// Effet scroll (exemple officiel curtains.js "multiple planes
// scroll effect") : les images sont des plans WebGL ondulés au
// scroll + un ShaderPass de post-traitement applique une
// distorsion radiale autour du centre de l ecran sur TOUTE la
// scene (donc uniquement les images, le texte reste net).
// ============================================================
function initScrollWarp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.Curtains || !window.Plane || !window.ShaderPass) return;

  // Scroll natif simple (pas de librairie de smooth-scroll).

  var container = document.createElement('div');
  container.id = 'gl-stage';
  container.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
  document.body.appendChild(container);

  var curtains;
  try {
    curtains = new Curtains({ container: container, watchScroll: true, pixelRatio: Math.min(1.5, window.devicePixelRatio) });
  } catch (err) { return; }
  curtains.onError(function () { container.remove(); });
  window.__curtains = curtains; // permet à la bascule élastique hero<->projets de couper ce rendu WebGL pendant l'animation (voir pauseGL/resumeGL)

  // --- Gestion de l effet de scroll : identique a l exemple ---
  var scrollEffect = 0;
  curtains.onRender(function () {
    scrollEffect = curtains.lerp(scrollEffect, 0, 0.05);
  }).onScroll(function () {
    var delta = curtains.getScrollDeltas();
    delta.y = -delta.y;
    if (Math.abs(delta.y) > Math.abs(scrollEffect)) {
      scrollEffect = curtains.lerp(scrollEffect, delta.y, 0.5);
    }
  });

  // --- Plans : ondulation horizontale au scroll (shader de l exemple) ---
  var vs = [
    'precision mediump float;',
    'attribute vec3 aVertexPosition;',
    'attribute vec2 aTextureCoord;',
    'uniform mat4 uMVMatrix;',
    'uniform mat4 uPMatrix;',
    'uniform mat4 planeTextureMatrix;',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'void main() {',
    '  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);',
    '  vTextureCoord = (planeTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;',
    '  vVertexPosition = aVertexPosition;',
    '}'
  ].join('\n');

  var fs = [
    'precision mediump float;',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'uniform sampler2D planeTexture;',
    'void main() {',
    '  gl_FragColor = texture2D(planeTexture, vTextureCoord);',
    '}'
  ].join('\n');

  var medias = document.querySelectorAll('.card-media img, .card-media video, .project-media img, .project-hero-media img, .about .img-wrap img');
  // Exposé pour le fondu d'accueil : pendant qu'il décale le HTML pour le
  // maintenir en place, les plans doivent être recalés sur ce même décalage,
  // sinon les covers défilent alors que les textes restent fixes.
  var glPlanes = [];
  window.__glPlanes = glPlanes;
  medias.forEach(function (img) {
    var wrapper = img.parentElement;
    var isVideo = img.tagName === 'VIDEO';
    var plane = new (window.Plane)(curtains, wrapper, {
      vertexShader: vs,
      fragmentShader: fs,
      widthSegments: 1,
      heightSegments: 1,
      uniforms: {}
    });
    glPlanes.push(plane);
    if (isVideo) {
      plane.loadVideo(img, { sampler: 'planeTexture' });
      img.play && img.play().catch(function(){});
    } else {
      plane.loadImage(img, { sampler: 'planeTexture' });
    }
    plane.onReady(function () {
      img.style.opacity = 0;
      wrapper.style.background = 'transparent';
      wrapper.style.overflow = 'visible';
    });

  });

  // --- ShaderPass : distorsion radiale de toute la scene (le code fourni) ---
  var passFs = [
    '#ifdef GL_ES',
    'precision mediump float;',
    '#endif',
    'varying vec3 vVertexPosition;',
    'varying vec2 vTextureCoord;',
    'uniform sampler2D uRenderTexture;',
    'uniform float uScrollEffect;',
    'void main() {',
    '  vec2 uv = vTextureCoord;',
    // distance verticale au centre de l ecran (-0.5 .. 0.5)
    '  float d = uv.y - 0.5;',
    // profil : 0 au centre (feuille plate), 1 aux extremites (courbure max)
    '  float e = pow(abs(d) * 2.0, 2.2);',
    // intensite pilotee par la vitesse de scroll
    '  float s = uScrollEffect / 85.0;',
    '  float m = 1.0 + s * e;',
    // les extremites s incurvent VERS le spectateur : grossissement pres des bords
    // horizontal : le contenu s elargit et sort a gauche/droite
    '  uv.x = 0.5 + (uv.x - 0.5) / m;',
    // vertical : le contenu est pousse au-dela du bord (la feuille se courbe)
    '  uv.y = 0.5 + d / (1.0 + s * e * 0.75);',
    '  gl_FragColor = texture2D(uRenderTexture, uv);',
    '}'
  ].join('\n');

  var pass = new (window.ShaderPass)(curtains, {
    fragmentShader: passFs,
    uniforms: {
      scrollEffect: { name: 'uScrollEffect', type: '1f', value: 0 }
    }
  });
  pass.onRender(function () {
    pass.uniforms.scrollEffect.value = Math.abs(scrollEffect);
  });
}
