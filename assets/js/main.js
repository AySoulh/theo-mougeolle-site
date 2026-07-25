document.addEventListener('DOMContentLoaded', function () {
  // Survol des cartes projet : le titre part lettre par lettre en décalé, et
  // "Ouvrir" arrive lettre par lettre au même rythme. On découpe les deux en
  // <i> pour animer chaque lettre avec son propre délai.
  function splitLetters(el) {
    if (!el || el.querySelector('i')) return;
    var word = el.textContent;
    el.textContent = '';
    for (var i = 0; i < word.length; i++) {
      var span = document.createElement('i');
      // espace insécable pour garder la largeur des espaces
      span.textContent = word[i] === ' ' ? '\u00A0' : word[i];
      span.style.setProperty('--l', i);
      el.appendChild(span);
    }
  }
  document.querySelectorAll('.card-title').forEach(function (title) {
    splitLetters(title.querySelector('.ct-base'));
    splitLetters(title.querySelector('.ct-hover'));
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

  // ---------- Vidéo hero -> projets : scroll normal ----------
  // Le hero défile comme une section classique et disparaît en haut ; le
  // contenu suivant arrive dessous. L'effet de distorsion WebGL (roulette),
  // pièce maîtresse du site, suit le scroll de son côté (watchScroll) et reste
  // donc parfaitement synchronisé.
  //
  // __heroState / __heroCommit sont conservés pour compatibilité avec les liens
  // d'ancre du header : ici l'état est toujours "ouvert", donc les liens
  // scrollent normalement vers leur cible sans traitement particulier.
  window.__heroState = function () { return 1; };
  window.__heroCommit = function () {};

  // ---------- Parallax de la vidéo hero ----------
  // La vidéo (zoomée à scale 1.12 en CSS) se déplace un peu plus lentement que
  // le scroll : elle "traîne" vers le bas, ce qui crée un léger effet de
  // profondeur. Le zoom donne la marge nécessaire pour que ce déplacement ne
  // révèle jamais de bord vide.
  (function () {
    var hero = document.getElementById('hero-video');
    if (!hero) return;
    var media = hero.querySelector('video, img');
    if (!media) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var PARALLAX = 0.10;   // fraction du scroll dont la vidéo "retarde"
    var ticking = false;

    function apply() {
      ticking = false;
      var y = window.scrollY;
      var h = hero.offsetHeight || window.innerHeight;
      if (y > h) return; // hors écran : inutile de calculer
      // La vidéo part légèrement remontée (-marge/2) et descend avec le scroll,
      // de sorte que le mouvement reste centré dans la marge du zoom : aucun
      // bord vide n'apparaît, ni en haut ni en bas.
      var maxShift = h * PARALLAX;
      var shift = -maxShift / 2 + (y / h) * maxShift;
      media.style.transform = 'scale(1.2) translateY(' + shift.toFixed(1) + 'px)';
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
  })();


  // ---------- Arrivée des textes : mot par mot, rejouable ----------
  // Chaque texte (titres compris) se dévoile mot par mot : chaque mot monte
  // depuis le bas derrière un masque, avec un léger décalage de l'un à l'autre.
  // L'animation se REJOUE : si le texte ressort de l'écran puis y revient (on
  // remonte puis on redescend), elle se relance.
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SEL = 'main h1, main h2, main h3, main h4, main p, main .eyebrow, main blockquote, main figcaption';
    var els = [].slice.call(document.querySelectorAll(SEL));

    var targets = [];
    els.forEach(function (el) {
      if (el.closest('.hero-video')) return;          // le hero a sa propre animation
      if (el.closest('.rise-words')) return;          // pas d'imbrication
      if (el.querySelector('h1,h2,h3,h4,p')) return;  // conteneur, pas une ligne
      if (!el.textContent.trim()) return;

      // Cas particulier des titres de carte : ils ont déjà .ct-base / .ct-hover
      // découpés en lettres pour le survol, avec leur propre masque. On ne les
      // enveloppe donc PAS dans un masque .rw (ça casserait le survol) : on les
      // anime à l'arrivée via une classe dédiée (montée + fondu de l'ensemble).
      var isCardTitle = el.classList.contains('card-title');

      if (isCardTitle) {
        el.classList.add('rise-title');
      } else {
        splitIntoWords(el);
        el.classList.add('rise-words');
      }
      targets.push(el);
    });
    if (!targets.length) return;

    // Enveloppe chaque MOT d'un élément dans un masque + un inner animable.
    function splitIntoWords(el) {
      // On parcourt les nœuds texte pour préserver les éléments internes
      // (ex: <span class="dot">). Chaque mot devient <span class="rw"><span
      // class="rw-in">mot</span></span>.
      var nodes = [].slice.call(el.childNodes);
      el.textContent = '';
      var wordIndex = 0;
      nodes.forEach(function (node) {
        if (node.nodeType === 3) {
          var parts = node.textContent.split(/(\s+)/); // garde les espaces
          parts.forEach(function (part) {
            if (part === '') return;
            if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
            el.appendChild(makeWord(part, wordIndex++));
          });
        } else {
          // élément non-texte (ex: la puce) : on l'anime aussi comme un mot
          var mask = document.createElement('span');
          mask.className = 'rw';
          var inner = document.createElement('span');
          inner.className = 'rw-in';
          inner.style.setProperty('--w', wordIndex++);
          inner.appendChild(node);
          mask.appendChild(inner);
          el.appendChild(mask);
        }
      });
    }
    function makeWord(text, i) {
      var mask = document.createElement('span');
      mask.className = 'rw';
      var inner = document.createElement('span');
      inner.className = 'rw-in';
      inner.style.setProperty('--w', i);
      inner.textContent = text;
      mask.appendChild(inner);
      return mask;
    }

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) { el.classList.add('rw-go'); });
      document.querySelectorAll('.card').forEach(function (c) { c.classList.add('card-ready'); });
      return;
    }

    // On sépare les cibles : les textes courants (titres de section, para-
    // graphes) et les titres de carte (qui sont tout en bas de leur carte, sous
    // une grande cover, et doivent donc être déclenchés selon la position de la
    // CARTE, pas du titre lui-même).
    var cardTitles = [];
    var textTargets = [];
    targets.forEach(function (el) {
      if (el.classList.contains('rise-title') && el.closest('.card')) cardTitles.push(el);
      else textTargets.push(el);
    });

    // Déclenchement et réarmement pilotés directement par le scroll plutôt que
    // par IntersectionObserver : la mesure est directe et déterministe, donc le
    // réarmement (remonter puis redescendre relance l'animation) est fiable à
    // tous les coups.
    //
    // - Textes courants : s'animent quand leur HAUT franchit 55% de l'écran en
    //   montant, se réarment quand ils repassent sous cette ligne.
    // - Titres de carte : s'animent quand la CARTE est visible à ~25%, se
    //   réarment quand elle repasse sous ce seuil. Le survol reste bloqué
    //   (.card-ready) pendant l'animation d'arrivée.
    // Déclenchement/réarmement via IntersectionObserver (natif, asynchrone,
    // AUCUN calcul par frame de scroll — donc aucun impact sur le framerate,
    // contrairement à une mesure getBoundingClientRect à chaque frame).
    //
    // Hystérésis obtenue avec DEUX observers par catégorie :
    //  - un "reveal" qui déclenche l'animation quand l'élément franchit ~55% de
    //    l'écran (rootMargin réduit le bas de la zone de détection) ;
    //  - un "reset" qui réarme seulement quand l'élément est entièrement ressorti
    //    de l'écran, pour qu'il ne "disparaisse" pas trop tôt quand on remonte.

    // -- Textes courants --
    var textReveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('rw-go'); });
    }, { rootMargin: '0px 0px -45% 0px', threshold: 0 });
    var textReset = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (!e.isIntersecting) e.target.classList.remove('rw-go'); });
    }, { rootMargin: '0px 0px 0px 0px', threshold: 0 });
    textTargets.forEach(function (el) { textReveal.observe(el); textReset.observe(el); });

    // -- Titres de carte (observe la carte entière) --
    function armCard(card, title) {
      if (title.classList.contains('rw-go')) return;
      title.classList.add('rw-go');
      card.classList.remove('card-ready');
      if (card._readyTimer) clearTimeout(card._readyTimer);
      card._readyTimer = setTimeout(function () {
        if (title.classList.contains('rw-go')) card.classList.add('card-ready');
      }, 900);
    }
    function disarmCard(card, title) {
      title.classList.remove('rw-go');
      card.classList.remove('card-ready');
      if (card._readyTimer) { clearTimeout(card._readyTimer); card._readyTimer = null; }
    }
    var cardReveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var title = e.target.querySelector('.card-title.rise-title');
          if (title) armCard(e.target, title);
        }
      });
    }, { threshold: 0.25 });
    var cardReset = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) {
          var title = e.target.querySelector('.card-title.rise-title');
          if (title) disarmCard(e.target, title);
        }
      });
    }, { rootMargin: '0px 0px 0px 0px', threshold: 0 });
    cardTitles.forEach(function (el) {
      var card = el.closest('.card');
      if (card) { cardReveal.observe(card); cardReset.observe(card); }
    });

    // Déblocage anticipé du survol dès que l'animation d'arrivée du titre finit
    // (le timer ci-dessus reste un secours si transitionend ne se déclenche pas).
    cardTitles.forEach(function (title) {
      var base = title.querySelector('.ct-base');
      if (!base) return;
      base.addEventListener('transitionend', function (e) {
        if (e.propertyName !== 'transform') return;
        var card = title.closest('.card');
        if (card && title.classList.contains('rw-go')) card.classList.add('card-ready');
      });
    });
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
    // Ce mécanisme (voile de flou + apparition du footer) est propre à la page
    // d'accueil. Sur les pages projet, le footer est déjà visible (classe
    // footer-in posée dans le HTML) et il ne faut pas y toucher.
    if (!document.querySelector('.hero-video')) return;
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

    var veilTick = false;
    function onVeilScroll() {
      if (veilTick) return;
      veilTick = true;
      requestAnimationFrame(function () { veilTick = false; apply(); });
    }
    apply();
    window.addEventListener('scroll', onVeilScroll, { passive: true });
    window.addEventListener('resize', onVeilScroll);
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
  // L'effet de distorsion au défilement est réservé à la page d'accueil (elle
  // seule a le hero vidéo). Les pages projet gardent des médias normaux.
  if (!document.querySelector('.hero-video')) return;

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

  // Le calcul de position des plans dépend de la géométrie du document au
  // moment de l'init. Or le layout peut encore bouger ensuite (polices web,
  // images, médias). On force donc curtains à tout recalculer une fois ces
  // éléments prêts, sinon les covers gardent un léger offset constant.
  function recalcCurtains(){
    if (!curtains) return;
    // Resynchronise la référence de scroll, recalcule la géométrie, PUIS recale
    // la position de chaque plan. C'est ce dernier updatePosition() global qui
    // corrige le décalage constant (~36px) des premières covers : leur position
    // avait été figée à l'init, avant que le layout ne soit stabilisé.
    if (curtains.updateScrollValues) curtains.updateScrollValues(window.pageXOffset, window.pageYOffset);
    if (curtains.resize) curtains.resize();
    if (window.__glPlanes) {
      window.__glPlanes.forEach(function (pl) { pl.updatePosition && pl.updatePosition(); });
    }
  }
  window.addEventListener('load', recalcCurtains);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalcCurtains);
  setTimeout(recalcCurtains, 500);
  setTimeout(recalcCurtains, 1200);
  setTimeout(recalcCurtains, 2500);

  // --- Gestion de l effet de scroll : identique a l exemple ---
  // On profite du onScroll natif de curtains (déjà appelé pour l'effet) pour
  // recaler UNE SEULE FOIS la position des 3 premières covers : au tout premier
  // scroll le layout est définitif, ce qui corrige leur décalage constant
  // (~36px) sans aucun reflow répété par la suite (donc sans coût de framerate).
  var firstScrollDone = false;
  var scrollEffect = 0;
  curtains.onRender(function () {
    scrollEffect = curtains.lerp(scrollEffect, 0, 0.05);
  }).onScroll(function () {
    if (!firstScrollDone) {
      firstScrollDone = true;
      var planes = window.__glPlanes;
      if (planes) for (var i = 0; i < Math.min(3, planes.length); i++) {
        planes[i].updatePosition && planes[i].updatePosition();
      }
    }
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
