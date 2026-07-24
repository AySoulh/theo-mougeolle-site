document.addEventListener('DOMContentLoaded', function () {
  // Survol des cartes projet : "Ouvrir" arrive lettre par lettre, en décalé.
  // On découpe le mot en <i> pour pouvoir animer chaque lettre avec son délai.
  document.querySelectorAll('.card-title .ct-hover').forEach(function (el) {
    if (el.querySelector('i')) return;
    var word = el.textContent;
    el.textContent = '';
    for (var i = 0; i < word.length; i++) {
      var span = document.createElement('i');
      span.textContent = word[i];
      span.style.setProperty('--l', i);
      el.appendChild(span);
    }
  });

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

  // Liens d'ancre du header : si on est encore verrouillé sur le hero (bascule
  // élastique pas encore franchie), un simple saut d'ancre est ignoré car le
  // scroll est bloqué (overflow:hidden). On force donc d'abord la bascille,
  // puis on scrolle vers la cible une fois le scroll rendu libre.
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;
      if (window.__heroState && window.__heroState() === 0) {
        e.preventDefault();
        if (window.__heroCommit) window.__heroCommit();
        // Laisse la bascule se terminer et le scroll se libérer, puis va à la cible.
        var tries = 0;
        (function go(){
          tries++;
          if (window.__heroState && window.__heroState() === 1) {
            var y = target.getBoundingClientRect().top + window.scrollY - 80;
            if (window.__lenis) window.__lenis.scrollTo(y);
            else window.scrollTo({ top: y, left: 0, behavior: 'smooth' });
          } else if (tries < 90) {
            requestAnimationFrame(go);
          }
        })();
      }
    });
  });

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

  // ---------- Vidéo hero -> projets : bascule élastique avec résistance ----------
  // Au chargement, le scroll est verrouillé sur le hero. Chaque cran de molette
  // accumule une "tension" (le contenu suivant pointe un peu, avec résistance).
  // - Sous le seuil : on relâche, ça REBONDIT (le hero revient).
  // - Au-dessus du seuil : ça BASCULE — la vidéo s'efface, les projets se
  //   révèlent, puis le scroll normal reprend.
  // Leçons des essais précédents, intégrées ici :
  //  * la distance est fixe et connue (0 -> hauteur du hero), aucune approximation ;
  //  * on ne touche jamais au vrai scroll pendant la tension (il reste à 0),
  //    donc rien à "recaler" et aucune téléportation possible ;
  //  * la couche WebGL (opacité + position) est resynchronisée à chaque frame ;
  //  * tout est piloté par une boucle rAF, insensible aux évènements perdus.
  (function () {
    var hero = document.getElementById('hero-video');
    var after = document.querySelector('.after-hero');
    var scrollCueEl = document.querySelector('.scroll-cue');
    if (!hero || !after) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var htmlEl = document.documentElement, bodyEl = document.body;
    var glStage = null;

    // État de la bascule
    var STATE_LOCKED = 0;   // sur le hero, on retient
    var STATE_OPEN = 1;     // bascule faite, scroll libre
    var state = (window.scrollY > 10) ? STATE_OPEN : STATE_LOCKED;

    var tension = 0;        // 0..1 : à quel point on "pousse" pour passer
    var MAX_PULL = 1;
    var COMMIT = 0.62;      // au-delà : bascule ; en-deçà au relâchement : rebond
    var STIFF = 0.0016;     // résistance : petit = dur à pousser (dépend de deltaY)
    
    var idleTimer = null;

    function lock() {
      htmlEl.style.overflow = 'hidden';
      bodyEl.style.overflow = 'hidden';
      if (window.__lenis) window.__lenis.stop();
    }
    function unlock() {
      htmlEl.style.overflow = '';
      bodyEl.style.overflow = '';
      if (window.__lenis) window.__lenis.start();
    }

    // Applique un "avancement" p (0 = hero plein, 1 = projets en place).
    // p pilote à la fois l'opacité et le léger glissement du contenu suivant.
    function render(p) {
      var travel = (after.offsetTop || window.innerHeight);
      hero.style.opacity = String(1 - p);
      hero.style.visibility = p >= 1 ? 'hidden' : '';

      // Le contenu suivant monte depuis "un cran plus bas" vers sa place.
      var lift = (1 - p) * Math.min(120, travel * 0.14);
      after.style.transform = p > 0 ? 'translateY(' + lift.toFixed(1) + 'px)' : '';
      after.style.opacity = p > 0 ? String(p) : '';

      if (!glStage) glStage = document.getElementById('gl-stage');
      if (glStage) glStage.style.opacity = p < 1 ? String(p) : '';

      // WebGL : opacité suit p, et la position est recalée sur le DOM réel.
      var planes = window.__glPlanes;
      if (planes) {
        for (var i = 0; i < planes.length; i++) {
          if (planes[i].updatePosition) planes[i].updatePosition();
        }
      }
      if (scrollCueEl) scrollCueEl.style.opacity = String(Math.max(0, 1 - p * 2.4));
    }

    function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

    // `committing` distingue les deux animations : un rebond est INTERRUPTIBLE
    // par un nouveau cran (on reprend la tension), la bascule (commit) ne l'est
    // pas.
    var rafAnim = 0;
    var committing = false;

    function animateTo(to, ms, done) {
      if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = 0; }
      var from = tension, t0 = performance.now();
      (function step(now){
        var k = Math.min(1, (now - t0) / ms);
        tension = from + (to - from) * easeOutCubic(k);
        render(commitCurve(tension));
        if (k < 1) rafAnim = requestAnimationFrame(step);
        else { rafAnim = 0; tension = to; render(commitCurve(to)); done && done(); }
      })(performance.now());
    }

    // La tension (0..1 de "poussée") est convertie en avancement visuel.
    // Non linéaire : au début ça bouge peu (résistance ressentie), puis ça cède.
    function commitCurve(t){ return Math.max(0, Math.min(1, t * t * (3 - 2 * t))); }

    function rebound() {
      if (committing) return;
      animateTo(0, 460, function(){ tension = 0; });
    }

    function commit() {
      if (committing) return;
      committing = true;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      animateTo(1, 560, function(){
        // Bascule terminée : on pose le vrai scroll en bas du hero et on libère.
        var travel = (after.offsetTop || window.innerHeight);
        // Déverrouiller AVANT scrollTo (sinon il est ignoré sous overflow:hidden),
        // puis poser la position en instantané.
        unlock();
        window.scrollTo({ top: travel, left: 0, behavior: 'instant' });
        if (window.__lenis) window.__lenis.scrollTo(travel, { immediate: true });
        // état final propre
        hero.style.visibility = 'hidden';
        after.style.transform = '';
        after.style.opacity = '';
        if (glStage) glStage.style.opacity = '';
        if (scrollCueEl) scrollCueEl.style.opacity = '0';
        state = STATE_OPEN;
        tension = 0;
        resyncAfterCommit();
      });
    }

    function pull(deltaY) {
      if (committing) return;             // la bascule finale n'est pas interruptible
      // Un nouveau cran interrompt un rebond éventuel et reprend la tension.
      if (rafAnim) { cancelAnimationFrame(rafAnim); rafAnim = 0; }
      tension = Math.max(0, Math.min(MAX_PULL, tension + deltaY * STIFF));
      render(commitCurve(tension));
      if (tension >= COMMIT) {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        commit();
        return;
      }
      // Si on arrête de pousser sans atteindre le seuil : rebond.
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function(){
        idleTimer = null;
        if (state === STATE_LOCKED && tension > 0 && !committing) rebound();
      }, 140);
    }

    var onWheel = function (e) {
      if (state !== STATE_LOCKED) return;      // scroll libre : ne rien intercepter
      e.preventDefault();
      if (e.deltaY > 0) pull(e.deltaY);        // vers le bas : on pousse
      else if (tension > 0) pull(e.deltaY);    // vers le haut : on relâche la tension
      if (window.scrollY !== 0) window.scrollTo({ top:0, left:0, behavior:'instant' });
    };

    // Tactile : la distance du doigt sert de deltaY.
    var touchY = null;
    var onTouchStart = function(e){ if (state === STATE_LOCKED) touchY = e.touches[0].clientY; };
    var onTouchMove = function(e){
      if (state !== STATE_LOCKED || touchY === null) return;
      var y = e.touches[0].clientY, d = touchY - y; touchY = y;
      if (e.cancelable) e.preventDefault();
      pull(d * 2.4);
      if (window.scrollY !== 0) window.scrollTo({ top:0, left:0, behavior:'instant' });
    };
    var onTouchEnd = function(){ touchY = null;
      if (state === STATE_LOCKED && tension > 0 && tension < COMMIT && !committing) rebound();
    };

    function syncLight(){
      var planes = window.__glPlanes;
      if (planes) for (var i=0;i<planes.length;i++) planes[i].updatePosition && planes[i].updatePosition();
    }
    // Après la bascule uniquement : curtains a raté le saut de scroll (posé par
    // scrollTo alors que le scroll était verrouillé). On lui donne la position
    // réelle une bonne fois, puis on le laisse suivre le scroll tout seul
    // (watchScroll). On n'appelle SURTOUT PAS updatePosition en continu : ça
    // entre en conflit avec son propre suivi et fait dériver les covers.
    function resyncAfterCommit(){
      if (window.__curtains && window.__curtains.updateScrollValues){
        window.__curtains.updateScrollValues(window.pageXOffset, window.pageYOffset);
      }
      syncLight();
    }

    function measure(){
      // Redimensionnement fenêtre : curtains recalcule seul via son propre
      // écouteur resize ; on ne fait rien de plus pour ne pas le perturber.
    }

    // On ne s'abonne PAS au scroll pour bouger les plans : curtains le fait
    // déjà (watchScroll:true), et toute interférence les fait dériver.

    if (reduce || state === STATE_OPEN) {
      // Accessibilité / arrivée déjà scrollée : pas d'animation, tout est en place.
      render(1);
      hero.style.visibility = 'hidden';
      state = STATE_OPEN;
      unlock();
    } else {
      render(0);
      lock();
      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
    }
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // Exposé pour le menu du header : permet de forcer la bascule quand on
    // clique un lien alors qu'on est encore verrouillé sur le hero (point 6).
    window.__heroCommit = function () {
      if (state === STATE_LOCKED && !committing) commit();
    };
    window.__heroState = function () { return state; };
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

    // Plus de lignes horizontales ni de croix : seules les colonnes de la
    // grille sont tracees, comme sur les maquettes.
  }

  build();
  window.addEventListener('resize', build);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();

  // ---------- Boutons : survol lettre par lettre ----------
  // Le libellé est découpé en lettres, dupliqué juste en dessous, et le tout
  // monte d'une hauteur de ligne au survol : chaque lettre est remplacée par
  // sa jumelle, avec un léger décalage de l'une à l'autre.
  (function () {
    var btns = document.querySelectorAll('.card-btn, .btn');
    btns.forEach(function (btn) {
      if (btn.querySelector('.btn-label')) return;
      // On ne touche qu'aux nœuds texte : les icônes SVG restent intactes.
      var textNode = null;
      for (var i = 0; i < btn.childNodes.length; i++) {
        var n = btn.childNodes[i];
        if (n.nodeType === 3 && n.textContent.trim()) { textNode = n; break; }
      }
      if (!textNode) return;
      var label = textNode.textContent.trim();

      function makeRow(cls) {
        var row = document.createElement('span');
        row.className = 'btn-row' + (cls ? ' ' + cls : '');
        label.split('').forEach(function (ch, k) {
          var i2 = document.createElement('i');
          i2.textContent = ch;
          i2.style.setProperty('--i', k);
          row.appendChild(i2);
        });
        return row;
      }

      var wrap = document.createElement('span');
      wrap.className = 'btn-label';
      wrap.appendChild(makeRow(''));
      var dup = makeRow('btn-row-dup');
      dup.setAttribute('aria-hidden', 'true');
      wrap.appendChild(dup);
      btn.replaceChild(wrap, textNode);
    });
  })();

  // ---------- Fin de page : la page se floute et se voile ----------
  // Sur la dernière portion de scroll, un voile fixe monte progressivement :
  // flou croissant + dégradé repris de la maquette (voile clair en bas,
  // transparent vers le haut). Les éléments du footer apparaissent pendant
  // cette animation, et restent nets car ils sont au-dessus du voile.
  (function () {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;
    var veil = document.createElement('div');
    veil.className = 'footer-veil';
    document.body.appendChild(veil);

    var supportsBlur = CSS && CSS.supports &&
      (CSS.supports('backdrop-filter', 'blur(4px)') || CSS.supports('-webkit-backdrop-filter', 'blur(4px)'));

    var contactSection = document.getElementById('contact');

    function apply() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;

      // Le flou est ancré sur la FIN de la section contact, pas sur un
      // pourcentage du scroll : il ne commence à monter que lorsqu'on a fini de
      // parcourir contact et qu'on pousse vers le footer. Ainsi un clic sur
      // "Contact" amène toujours le texte parfaitement net, quel que soit la
      // hauteur de la page. Il atteint 100% en bas.
      // La section contact occupe presque tout le bas de la page : il reste
      // peu de scroll ensuite. Le flou démarre donc dans la dernière portion du
      // scroll (assez bas pour qu'un clic sur Contact laisse le texte lisible)
      // et atteint 100% pile en bas de page.
      var startY = max - window.innerHeight * 0.32;
      if (contactSection) {
        // Ne jamais démarrer avant le haut de contact + une marge : garantit
        // que le texte de contact reste net à l'arrivée d'un clic sur Contact.
        var el = contactSection, top = 0;
        while (el) { top += el.offsetTop; el = el.offsetParent; }
        startY = Math.max(startY, top + 40);
      }
      startY = Math.max(0, Math.min(startY, max - 80));
      var endY = max;  // 100% pile en bas de page
      var p = Math.min(1, Math.max(0, (window.scrollY - startY) / (endY - startY)));

      veil.style.opacity = String(p);
      if (supportsBlur) {
        var blur = (5 * p).toFixed(2) + 'px';
        veil.style.backdropFilter = 'blur(' + blur + ')';
        veil.style.webkitBackdropFilter = 'blur(' + blur + ')';
      }
      footer.classList.toggle('footer-in', p > 0.12);
    }

    apply();
    window.addEventListener('scroll', apply, { passive: true });
    window.addEventListener('resize', apply);
    window.addEventListener('load', apply);
  })();

  // ---------- Photo de contact : elle arrive une fois le texte terminé ----------
  // Piloté par la position de scroll plutôt que par un IntersectionObserver :
  // la mesure est directe et déterministe, donc vérifiable, et insensible aux
  // retards de callback quand le navigateur est chargé.
  (function () {
    var photo = document.querySelector('.contact-photo');
    var textBlock = document.querySelector('.contact-text');
    if (!photo || !textBlock) return;

    var startedAt = 0;
    var DELAI = 1150;   // le texte monte derrière son masque (~0.95s + décalages)
    var done = false;

    // Boucle continue plutôt qu'un écouteur de scroll : un seul événement
    // perdu ou regroupé suffirait sinon à ne jamais déclencher la photo.
    // Une lecture de position par frame est négligeable, et la boucle
    // s'arrête définitivement dès que la photo est affichée.
    function check() {
      if (done) return;
      var r = textBlock.getBoundingClientRect();
      var visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      if (r.height > 0 && visible / r.height >= 0.3) {
        if (!startedAt) startedAt = performance.now();
        if (performance.now() - startedAt >= DELAI) {
          photo.classList.add('photo-in');
          done = true;
          return;
        }
      }
      requestAnimationFrame(check);
    }

    requestAnimationFrame(check);
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

  // Sur la page d'accueil, la bascule élastique hero->projets pose le scroll
  // d'un coup (scrollTo) alors que le scroll était verrouillé : curtains, qui
  // suit le scroll de son côté (watchScroll), garde une référence figée et
  // décale durablement les covers (mesuré : ~200px). On désactive donc la
  // distorsion WebGL uniquement ici — les covers restent affichées normalement
  // (vidéos HTML nettes, bien alignées). L'effet reste actif sur les pages
  // projet, qui n'ont pas d'élastique.
  var isHome = !!document.querySelector('.hero-video');
  if (isHome) {
    // On révèle les médias HTML qui auraient été masqués au profit du WebGL.
    document.querySelectorAll('.card-media img, .card-media video').forEach(function (m) {
      m.style.opacity = '';
    });
    return;
  }

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
  window.__curtains = curtains;

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
      // Recale la position dès que le plan est prêt, puis encore après quelques
      // frames : curtains fige sinon une position de référence prise au tout
      // début (hero verrouillé, scroll à 0), ce qui décalait les covers d'un
      // offset constant une fois la bascule franchie.
      plane.updatePosition && plane.updatePosition();
      requestAnimationFrame(function(){ plane.updatePosition && plane.updatePosition(); });
      setTimeout(function(){ plane.updatePosition && plane.updatePosition(); }, 300);
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
