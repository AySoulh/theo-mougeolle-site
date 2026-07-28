(function () {
  var hero = document.getElementById("tpHero");
  if (!hero) return;

  // ── Tweakables ──
  var WORDS = ["un design percutant", "un branding fort", "une animation marquante"];
  var CYCLE_MS = 3200, INTRO_MS = 1100;
  var SPRING = 0.05, FRICTION = 0.86, PUSH_F = 0.22, RADIUS_F = 2.0;
  var MOBILE_BP = 760, MAX_FONT = 220;
  var SWAP_DUR = 500, ENTER_EM = 0.6;

  var mask = document.getElementById("tpMask");
  var sentence = document.getElementById("tpSentence");
  var word = document.getElementById("tpWord");
  var curEl = document.getElementById("tpWordCur");
  var mouse = { x: -1e5, y: -1e5, on: false };
  var raf = 0;            // id de la boucle (0 = arrêtée)
  var running = false;    // le hero a démarré (après l'intro)
  var heroVisible = true; // le hero est dans le viewport

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function lettersInto(parent, text) {
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = text[i] === " " ? "tp-spc" : "tp-ltr";
      s.textContent = text[i];
      parent.appendChild(s);
    }
  }

  function makeWordParticles(entrance) {
    var now = performance.now();
    var els = curEl.querySelectorAll(".tp-ltr"), arr = [];
    for (var i = 0; i < els.length; i++) {
      arr.push({ el: els[i], x: 0, y: 0, vx: 0, vy: 0, enterStart: entrance ? now : -1e9 });
    }
    return arr;
  }
  var staticLetters = Array.prototype.filter
    .call(sentence.querySelectorAll(".tp-ltr"), function (el) { return !word.contains(el); })
    .map(function (el) { return { el: el, x: 0, y: 0, vx: 0, vy: 0, enterStart: -1e9 }; });
  var wordLetters = makeWordParticles(false);
  var particles = staticLetters.concat(wordLetters);

  var fp = 56;
  function readFont() { fp = parseFloat(getComputedStyle(word).fontSize) || 56; }

  function wordWidth(text) {
    var pr = document.createElement("span");
    pr.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:-99999px;top:0;" +
      "display:inline-block;letter-spacing:-0.018em;font-family:'Nohemi',sans-serif;font-size:" + fp + "px;";
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span"); s.style.display = "inline-block"; s.style.whiteSpace = text[i] === " " ? "pre" : "normal"; s.textContent = text[i]; pr.appendChild(s);
    }
    document.body.appendChild(pr);
    var w = pr.scrollWidth;
    document.body.removeChild(pr);
    return w;
  }

  function setWordWidth(animate) {
    if (!animate) word.style.transition = "none";
    word.style.width = wordWidth(WORDS[idx]) + "px";
    if (!animate) { void word.offsetWidth; word.style.transition = ""; }
  }

  function fit() {
    readFont();
    setWordWidth(false);
  }

  var idx = 0;
  function swapWord() {
    var oldText = WORDS[idx];
    idx = (idx + 1) % WORDS.length;

    var ghost = document.createElement("span");
    ghost.className = "tp-ghost";
    lettersInto(ghost, oldText);
    word.appendChild(ghost);
    ghost.style.animationDuration = SWAP_DUR + "ms";
    void ghost.offsetWidth;
    ghost.classList.add("go");
    setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, SWAP_DUR + 80);

    curEl.textContent = "";
    lettersInto(curEl, WORDS[idx]);
    wordLetters = makeWordParticles(true);
    particles = staticLetters.concat(wordLetters);

    setWordWidth(true);
  }

  // Positions "maison" (home) des lettres, mesurées SANS le transform courant.
  // Recalculées seulement quand nécessaire (resize, scroll, changement de mot),
  // pas à chaque frame : c'est ce qui élimine le layout thrashing.
  function measureHome() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var r = p.el.getBoundingClientRect();
      // r inclut le transform courant (p.x,p.y) : on le retire pour obtenir la
      // position de base.
      p.homeX = r.left + r.width / 2 - p.x;
      p.homeY = r.top + r.height / 2 - p.y;
    }
    homeDirty = false;
  }
  var homeDirty = true;

  function frame() {
    var nowMs = performance.now();
    var R = Math.max(120, fp * RADIUS_F);
    var PUSH = Math.max(6, fp * PUSH_F);
    var ENTER_PX = ENTER_EM * fp;
    var i, p;

    // On ne remesure la position de base que si quelque chose a pu la changer
    // (scroll, resize, nouveau mot). Sinon on réutilise le cache.
    if (homeDirty) measureHome();

    var anyMotion = false;
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      p.hx = p.homeX; p.hy = p.homeY;

      var ax = -SPRING * p.x, ay = -SPRING * p.y;
      if (mouse.on) {
        var dx = p.hx + p.x - mouse.x, dy = p.hy + p.y - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < R && d > 0.01) {
          var f = (R - d) / R;
          ax += (dx / d) * f * PUSH;
          ay += (dy / d) * f * PUSH;
        }
      }
      p.vx = (p.vx + ax) * FRICTION;
      p.vy = (p.vy + ay) * FRICTION;
      p.x += p.vx; p.y += p.vy;
      if (Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05) { p.x = 0; p.y = 0; }
      if (Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02 || Math.abs(p.x) > 0.05 || Math.abs(p.y) > 0.05) anyMotion = true;

      var ey = 0, op = 1, entering = false;
      if (p.enterStart > -1e8) {
        var tt = (nowMs - p.enterStart) / SWAP_DUR;
        if (tt <= 0) { ey = -ENTER_PX; op = 0; entering = true; anyMotion = true; }
        else if (tt < 1) { ey = -ENTER_PX * (1 - easeOut(tt)); op = tt; entering = true; anyMotion = true; }
      }
      p.el.style.opacity = op;
      if (entering) {
        p.el.style.transform = "translate(0px," + ey.toFixed(2) + "px)";
      } else {
        p.el.style.transform = "translate(" + p.x.toFixed(2) + "px," + (p.y + ey).toFixed(2) + "px)";
      }
    }

    // Boucle continue seulement si le hero est visible ET qu'il se passe quelque
    // chose (souris active ou lettres encore en mouvement). Sinon on s'arrête et
    // on repartira sur un évènement (souris, resize, swap).
    if (heroVisible && (mouse.on || anyMotion)) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
    }
  }

  // Relance la boucle si elle s'était arrêtée (au repos).
  function kick() {
    if (!raf && running && heroVisible) raf = requestAnimationFrame(frame);
  }

  function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; kick(); }
  function onLeave() { mouse.on = false; }
  function onTouch(e) { var t = e.touches && e.touches[0]; if (t) { mouse.x = t.clientX; mouse.y = t.clientY; mouse.on = true; kick(); } }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseout", onLeave);
  window.addEventListener("blur", onLeave);
  window.addEventListener("resize", function () { fit(); homeDirty = true; kick(); });
  // Au scroll, la position à l'écran des lettres change → cache invalidé.
  window.addEventListener("scroll", function () { homeDirty = true; kick(); }, { passive: true });
  window.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("touchend", onLeave);

  // Pause quand le hero sort du viewport : libère le CPU pour le WebGL des
  // covers pendant qu'on parcourt les projets.
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) { homeDirty = true; kick(); }
    }, { threshold: 0 });
    io.observe(hero);
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    fit();
    mask.classList.add("intro");
    setTimeout(function () {
      mask.classList.remove("intro");
      running = true;
      homeDirty = true;
      raf = requestAnimationFrame(frame);
    }, INTRO_MS);
    setInterval(function () { swapWord(); homeDirty = true; kick(); }, CYCLE_MS);
  });
})();
