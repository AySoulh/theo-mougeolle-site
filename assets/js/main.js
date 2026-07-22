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
  // Le blocage du scroll pendant la résistance repose sur overflow:hidden
  // (document.documentElement/body) : garanti quel que soit le navigateur,
  // le type de souris/trackpad, et indépendant de Lenis. On simule un
  // "tirage" visuel (translateY de <main>) qui suit le scroll avec de la
  // résistance ; si on relâche avant le seuil ça rebondit en place ; si on
  // le dépasse, la course se termine et on se cale exactement à la bonne
  // section. Comportement symétrique pour remonter depuis le tout début de
  // Projets vers la vidéo.
  if (window.Lenis && !window.__lenis) {
    window.__lenis = new Lenis({ autoRaf: true, lerp: 0.11 });
  }
  var heroSection = document.getElementById('hero-video');
  var projetsSection = document.getElementById('projets');
  var mainEl = document.querySelector('main');
  var scrollCue = document.querySelector('.scroll-cue');

  if (heroSection && projetsSection && mainEl) {
    var htmlEl = document.documentElement;
    var bodyEl = document.body;

    function lockScroll() {
      htmlEl.style.overflow = 'hidden';
      bodyEl.style.overflow = 'hidden';
      if (window.__lenis) window.__lenis.stop();
    }
    function unlockScroll() {
      htmlEl.style.overflow = '';
      bodyEl.style.overflow = '';
      if (window.__lenis) window.__lenis.start();
    }

    var state = window.scrollY < 40 ? 'hero' : 'projects';
    if (state === 'hero') lockScroll();

    var drag = 0;           // décalage visuel actuel (px), toujours >= 0
    var dragSign = -1;      // -1 = on tire vers le bas (hero -> projets, <main> monte)
                             // +1 = on tire vers le haut (projets -> hero, <main> descend)
    var MAX_DRAG = 130;     // tirage max avant que ça "cède" (phase résistance)
    var COMMIT = 84;        // seuil de bascule : sous ce seuil -> rebond, au-dessus -> ça passe
    var DAMP = 0.42;        // résistance (plus petit = plus dur à tirer)
    var settling = false;   // true pendant le rebond ou la bascule (animation en cours)
    var idleTimer = null;
    var lockedForBoundary = false;
    var lockedScrollY = 0;

    function applyDrag(px) {
      mainEl.style.transform = px ? 'translateY(' + (dragSign * px).toFixed(1) + 'px)' : '';
      if (scrollCue) {
        scrollCue.style.opacity = (dragSign < 0 && px > 6) ? Math.max(0, 0.85 - px / 30) : '';
      }
    }

    function nearBoundary() {
      return Math.abs(window.scrollY - projetsSection.offsetTop) <= 6;
    }

    // Le rendu WebGL (plans + shader pass sur toutes les images/vidéos de la
    // page) tourne en continu en arrière-plan et peut consommer une bonne
    // partie du budget de chaque frame. Pendant le tirage/la bascule, on le
    // coupe entièrement pour garantir que l'animation reste fluide à 60fps
    // même sur une machine modeste (les images concernées ne sont de toute
    // façon pas visibles pendant cette interaction précise).
    var glPaused = false;
    function pauseGL() {
      if (window.__curtains && !glPaused) { window.__curtains.disableDrawing(); glPaused = true; }
    }
    function resumeGL() {
      if (window.__curtains && glPaused) { window.__curtains.enableDrawing(); glPaused = false; }
    }

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    // Animation pilotée en JS image par image (requestAnimationFrame) plutôt
    // que via une transition CSS : garantit que l'animation se joue et se
    // termine réellement, quel que soit le navigateur.
    function settle(toValue, durationMs, onDone) {
      settling = true;
      var fromValue = drag;
      var t0 = performance.now();
      function step(now) {
        var t = Math.min(1, (now - t0) / durationMs);
        var v = fromValue + (toValue - fromValue) * easeOutCubic(t);
        drag = v;
        applyDrag(v);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          drag = toValue;
          applyDrag(toValue);
          onDone();
        }
      }
      requestAnimationFrame(step);
    }

    function bounceBack() {
      settle(0, 480, function () {
        settling = false;
        drag = 0;
        resumeGL();
        if (state === 'projects') { unlockScroll(); lockedForBoundary = false; }
      });
    }

    // Bascule complète : on anime le tirage jusqu'à EXACTEMENT la distance
    // réelle entre les deux sections (mesurée en direct dans le DOM, jamais
    // une valeur approchée), puis on pose le scroll réel AVANT de retirer le
    // transform, dans le même tick synchrone pendant que Lenis est encore
    // arrêté. Comme la distance animée == la distance réelle, transform et
    // scrollY représentent très exactement la même image au moment de la
    // bascule : rien ne "saute" (c'était ça, la téléportation — la distance
    // animée ne correspondait pas à la vraie distance entre les sections).
    function commit() {
      var goingDown = state === 'hero';
      var travel = goingDown
        ? projetsSection.offsetTop                       // scrollY est verrouillé à 0 pendant le tirage
        : (lockedScrollY - heroSection.offsetTop);        // distance à remonter jusqu'au haut du hero

      settle(travel, 520, function () {
        var finalScrollY = goingDown ? projetsSection.offsetTop : heroSection.offsetTop;
        // Le navigateur ignore silencieusement window.scrollTo() tant que
        // overflow:hidden est actif sur html/body (vérifié : le scroll ne
        // bouge tout simplement pas). Comme le verrou est posé depuis le
        // tout début du tirage, il faut déverrouiller AVANT de poser la
        // position, puis reverrouiller juste après si on revient au hero —
        // toute cette séquence est synchrone (aucun rendu entre les deux),
        // donc invisible pour l'utilisateur : rien ne redevient scrollable
        // à l'écran entre-temps.
        htmlEl.style.overflow = '';
        bodyEl.style.overflow = '';
        window.scrollTo({ top: finalScrollY, left: 0, behavior: 'instant' });
        if (window.__lenis) window.__lenis.scrollTo(finalScrollY, { immediate: true });
        mainEl.style.transform = '';
        if (scrollCue) scrollCue.style.opacity = goingDown ? '0' : '';
        state = goingDown ? 'projects' : 'hero';
        drag = 0; settling = false; lockedForBoundary = false;
        resumeGL();
        if (state === 'hero') {
          lockScroll(); // reverrouille pour le hero (scroll déjà posé à 0 juste avant)
        } else if (window.__lenis) {
          window.__lenis.start();
        }
      });
    }

    function pullBy(rawDelta) {
      if (settling) return;
      pauseGL();
      drag = Math.max(0, Math.min(MAX_DRAG, drag + rawDelta * DAMP));
      applyDrag(drag);
      if (drag >= COMMIT) { clearTimeout(idleTimer); idleTimer = null; commit(); return; }
      if (Math.abs(rawDelta) > 2 || !idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(function () { idleTimer = null; if (drag > 0) bounceBack(); }, 120);
      }
    }

    var onWheel = function (e) {
      if (state === 'hero') {
        e.preventDefault();
        dragSign = -1;
        pullBy(e.deltaY);
        // Filet de sécurité ultime : si malgré overflow:hidden + preventDefault
        // le scroll a quand même légèrement bougé (certains environnements),
        // on le recale de force à 0.
        if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return;
      }
      if (nearBoundary() && e.deltaY < 0) {
        e.preventDefault();
        if (!lockedForBoundary) { lockedForBoundary = true; lockedScrollY = window.scrollY; lockScroll(); }
        dragSign = 1;
        pullBy(-e.deltaY);
        if (window.scrollY !== lockedScrollY) window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
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
      if (state === 'hero') {
        dragSign = -1;
        pullBy(d * 2.2);
        if (window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        return;
      }
      if (nearBoundary() && d < 0) {
        if (!lockedForBoundary) { lockedForBoundary = true; lockedScrollY = window.scrollY; lockScroll(); }
        dragSign = 1;
        pullBy(-d * 2.2);
        if (window.scrollY !== lockedScrollY) window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'instant' });
      }
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
