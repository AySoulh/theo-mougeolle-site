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


  // ---------- Vidéo hero <-> Projets : glisse élastique avec rebond ----------
  // Tant qu'on est sur la vidéo, le scroll réel reste verrouillé à 0 : on
  // simule un "tirage" (translateY de <main>) qui suit le scroll avec de la
  // résistance. Si on relâche avant le seuil, ça rebondit en douceur en
  // place. Si on passe le seuil, ça termine la course puis se cale
  // exactement sous la vidéo. Idem, symétrique, pour remonter depuis le
  // tout début de Projets.
  if (window.Lenis && !window.__lenis) {
    window.__lenis = new Lenis({ autoRaf: true, lerp: 0.11 });
  }
  var heroSection = document.getElementById('hero-video');
  var projetsSection = document.getElementById('projets');
  var mainEl = document.querySelector('main');
  var scrollCue = document.querySelector('.scroll-cue');

  if (heroSection && projetsSection && mainEl) {
    var state = window.scrollY < 40 ? 'hero' : 'projects';
    if (window.__lenis && state === 'hero') window.__lenis.stop();

    var drag = 0;           // décalage visuel actuel (px)
    var MAX_DRAG = 130;     // tirage max avant que ça "cède"
    var COMMIT = 78;        // seuil de bascule
    var DAMP = 0.42;        // résistance (0=rien ne bouge, 1=suit le doigt)
    var settling = false;   // true pendant le rebond ou la bascule (transition CSS active)
    var idleTimer = null;

    function applyDrag(px, withTransition) {
      mainEl.style.transition = withTransition ? 'transform .45s cubic-bezier(.22,1,.36,1)' : 'none';
      mainEl.style.transform = px ? 'translateY(' + (-px).toFixed(1) + 'px)' : '';
      if (scrollCue) {
        scrollCue.style.transition = withTransition ? 'opacity .45s ease' : 'opacity .1s linear';
        scrollCue.style.opacity = px > 6 ? Math.max(0, 0.85 - px / 30) : '';
      }
    }

    function nearBoundary() {
      return Math.abs(window.scrollY - projetsSection.offsetTop) <= 6;
    }

    function bounceBack() {
      settling = true;
      drag = 0;
      applyDrag(0, true);
      mainEl.addEventListener('transitionend', function done() {
        mainEl.removeEventListener('transitionend', done);
        mainEl.style.transition = '';
        settling = false;
        // Si on rebondit depuis Projets (résistance à la frontière), Lenis
        // avait été stoppé pour empêcher toute fuite de scroll : on le
        // redémarre puisqu'on reste bien sur Projets.
        if (state === 'projects' && window.__lenis) window.__lenis.start();
      }, { once: true });
    }

    function commit() {
      settling = true;
      var goingDown = state === 'hero';
      var full = window.innerHeight + 40;
      drag = full;
      applyDrag(full, true);
      mainEl.addEventListener('transitionend', function done() {
        mainEl.removeEventListener('transitionend', done);
        var target = goingDown ? projetsSection : heroSection;
        mainEl.style.transition = 'none';
        mainEl.style.transform = '';
        if (scrollCue) { scrollCue.style.transition = 'none'; scrollCue.style.opacity = goingDown ? '0' : ''; }
        if (window.__lenis) {
          window.__lenis.start();
          window.__lenis.scrollTo(target, { immediate: true });
        } else {
          window.scrollTo(0, target.offsetTop);
        }
        state = goingDown ? 'projects' : 'hero';
        if (state === 'hero' && window.__lenis) window.__lenis.stop();
        drag = 0; settling = false;
      }, { once: true });
    }

    function pullBy(rawDelta) {
      if (settling) return;
      drag = Math.max(0, Math.min(MAX_DRAG, drag + rawDelta * DAMP));
      applyDrag(drag, false);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (drag >= COMMIT) commit(); else bounceBack();
      }, 110);
    }

    var onWheel = function (e) {
      if (state === 'hero') {
        e.preventDefault();
        pullBy(e.deltaY);
        return;
      }
      if (nearBoundary() && e.deltaY < 0) {
        e.preventDefault();
        if (window.__lenis) window.__lenis.stop();
        pullBy(-e.deltaY);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });

    var touchStartY = null, touchLastY = null;
    window.addEventListener('touchstart', function (e) {
      touchStartY = touchLastY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (touchStartY === null) return;
      var y = e.touches[0].clientY;
      var d = touchLastY - y; // positif = doigt vers le haut = scroll vers le bas
      touchLastY = y;
      if (state === 'hero') { pullBy(d * 2.2); return; }
      if (nearBoundary() && d < 0) { pullBy(-d * 2.2); }
    }, { passive: true });
    window.addEventListener('touchend', function () {
      touchStartY = touchLastY = null;
    }, { passive: true });
  }

  initScrollWarp();

// ---------- Quadrillage overlay ----------
(function () {
  var ov = document.createElement('div');
  ov.className = 'grid-overlay';
  document.body.appendChild(ov);
  function build() {
    ov.innerHTML = '';
    var vPos = [0, 1/3, 2/3, 1];
    var hStep = Math.max(240, Math.round(window.innerHeight / 3));
    var hPos = [];
    for (var y = hStep; y < window.innerHeight; y += hStep) hPos.push(y);
    vPos.forEach(function (p) {
      var v = document.createElement('span');
      v.className = 'gl-v';
      v.style.left = (p * 100) + '%';
      ov.appendChild(v);
    });
    hPos.forEach(function (y) {
      var h = document.createElement('span');
      h.className = 'gl-h';
      h.style.top = y + 'px';
      ov.appendChild(h);
      vPos.forEach(function (p) {
        var x = document.createElement('span');
        x.className = 'gl-x';
        x.textContent = '+';
        x.style.left = (p * 100) + '%';
        x.style.top = y + 'px';
        ov.appendChild(x);
      });
    });
  }
  build();
  window.addEventListener('resize', build);
})();
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

  // Smooth scroll
  // Lenis est déjà instancié plus haut (window.__lenis) si disponible.

  var container = document.createElement('div');
  container.id = 'gl-stage';
  container.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;';
  document.body.appendChild(container);

  var curtains;
  try {
    curtains = new Curtains({ container: container, watchScroll: true, pixelRatio: Math.min(1.5, window.devicePixelRatio) });
  } catch (err) { return; }
  curtains.onError(function () { container.remove(); });

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
