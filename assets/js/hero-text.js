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

  var raf = 0;
  function frame() {
    var nowMs = performance.now();
    var R = Math.max(120, fp * RADIUS_F);
    var PUSH = Math.max(6, fp * PUSH_F);
    var ENTER_PX = ENTER_EM * fp;
    var i, p;

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      var r = p.el.getBoundingClientRect();
      p.hx = r.left + r.width / 2 - p.x;
      p.hy = r.top + r.height / 2 - p.y;
    }
    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      var ax = -SPRING * p.x, ay = -SPRING * p.y;
      if (mouse.on) {
        var dx = p.hx + p.x - mouse.x, dy = p.hy + p.y - mouse.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < R && d > 0.01) {
          var f = (R - d) / R;
          var dir = dy < 0 ? -1 : 1;
          ay += dir * f * PUSH;
        }
      }
      p.vx = (p.vx + ax) * FRICTION;
      p.vy = (p.vy + ay) * FRICTION;
      p.x += p.vx; p.y += p.vy;
      if (Math.abs(p.x) < 0.05 && Math.abs(p.y) < 0.05) { p.x = 0; p.y = 0; }

      var ey = 0, op = 1;
      if (p.enterStart > -1e8) {
        var tt = (nowMs - p.enterStart) / SWAP_DUR;
        if (tt <= 0) { ey = -ENTER_PX; op = 0; }
        else if (tt < 1) { ey = -ENTER_PX * (1 - easeOut(tt)); op = tt; }
      }
      p.el.style.opacity = op;
      p.el.style.transform = "translate(" + p.x.toFixed(2) + "px," + (p.y + ey).toFixed(2) + "px)";
    }
    raf = requestAnimationFrame(frame);
  }

  function onMove(e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; }
  function onLeave() { mouse.on = false; }
  function onTouch(e) { var t = e.touches && e.touches[0]; if (t) { mouse.x = t.clientX; mouse.y = t.clientY; mouse.on = true; } }
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseout", onLeave);
  window.addEventListener("blur", onLeave);
  window.addEventListener("resize", fit);
  window.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("touchend", onLeave);

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    fit();
    mask.classList.add("intro");
    setTimeout(function () {
      mask.classList.remove("intro");
      raf = requestAnimationFrame(frame);
    }, INTRO_MS);
    setInterval(swapWord, CYCLE_MS);
  });
})();
