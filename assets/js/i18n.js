// Système de langue FR/EN.
// - EN est la langue par défaut du site.
// - Le choix est mémorisé (localStorage) et appliqué sur toutes les pages.
// - Les textes traduisibles portent un attribut data-i18n="clé" ; le texte
//   anglais et français vient du dictionnaire I18N ci-dessous.
// - Le hero animé (structure lettre par lettre) est un cas spécial exposé via
//   window.__heroSetLang, appelé quand la langue change.
(function () {
  var DEFAULT_LANG = 'en';
  var STORE_KEY = 'tm_lang';

  // Dictionnaire : chaque clé a sa version en/fr. Les noms propres (projets,
  // Artpoint…) ne sont pas traduits.
  var I18N = {
    'nav.projects':   { en: 'Projects', fr: 'Projets' },
    'nav.contact':    { en: 'Contact',  fr: 'Contact' },
    'card.open':      { en: 'Open',     fr: 'Ouvrir' },
    'scroll':         { en: 'Scroll',   fr: 'Défiler' },
    'back':           { en: '\u2190 Back to projects', fr: '\u2190 Retour aux projets' },

    // Accueil — bloc contact
    'contact.p1.pre':  { en: 'I explore the ', fr: 'J\u2019explore le ' },
    'contact.p1.mark': { en: 'future of design', fr: 'futur du design' },
    'contact.p1.post': { en: ' through the prism of new technologies, across every discipline of design.',
                         fr: ' \u00e0 travers le prisme des nouvelles technologies, dans toutes les disciplines du design.' },
    'contact.p2.pre':  { en: 'I\u2019m currently the Artistic Director at ', fr: 'Je suis actuellement Directeur Artistique chez ' },
    'contact.p2.mid':  { en: ' where I curate and develop digital design experiences. Alongside this, I explore ',
                         fr: ', o\u00f9 je con\u00e7ois et d\u00e9veloppe des exp\u00e9riences de design num\u00e9rique. En parall\u00e8le, j\u2019explore le ' },
    'contact.p2.mark': { en: 'furniture design,', fr: 'design de mobilier,' },
    'contact.p2.post': { en: ' experimenting with materials, forms, and emerging technologies.',
                         fr: ' en exp\u00e9rimentant mati\u00e8res, formes et technologies \u00e9mergentes.' },

    'footer.copy_name': { en: 'Th\u00e9o Mougeolle', fr: 'Th\u00e9o Mougeolle' }
  };

  // Hero : phrase fixe + mots qui défilent, dans les deux langues.
  var HERO = {
    en: { lead: 'Elevate your brand with', words: ['striking design', 'strong branding', 'memorable motion'] },
    fr: { lead: 'Élever votre image de marque avec', words: ['un design percutant', 'un branding fort', 'une animation marquante'] }
  };
  window.__HERO_I18N = HERO;

  function getLang() {
    try { return localStorage.getItem(STORE_KEY) || DEFAULT_LANG; }
    catch (e) { return DEFAULT_LANG; }
  }
  function setLang(lang) {
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    apply(lang);
  }

  function apply(lang) {
    document.documentElement.setAttribute('lang', lang);

    // Textes marqués data-i18n
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      var entry = I18N[key];
      if (entry && entry[lang] != null) nodes[i].textContent = entry[lang];
    }

    // Éléments dont on traduit une version alternative stockée en data-en/data-fr
    // (utilisé pour les pages projet : titres, paragraphes, méta).
    var alt = document.querySelectorAll('[data-fr]');
    for (var j = 0; j < alt.length; j++) {
      var el = alt[j];
      var enText = el.getAttribute('data-en');
      var frText = el.getAttribute('data-fr');
      var val = (lang === 'fr') ? frText : enText;
      if (val != null) {
        // Autorise <br> dans les titres
        if (val.indexOf('\\n') >= 0 || el.getAttribute('data-allow-br') === '1') {
          el.innerHTML = val.replace(/\\n|\n/g, '<br>');
        } else {
          el.textContent = val;
        }
      }
    }

    // Hero animé
    if (typeof window.__heroSetLang === 'function') window.__heroSetLang(lang);

    // État visuel du bouton
    var btns = document.querySelectorAll('.lang-switch [data-lang]');
    for (var k = 0; k < btns.length; k++) {
      btns[k].classList.toggle('is-active', btns[k].getAttribute('data-lang') === lang);
    }
  }

  // Branche le bouton de langue
  function initSwitch() {
    var btns = document.querySelectorAll('.lang-switch [data-lang]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (e) {
        e.preventDefault();
        setLang(this.getAttribute('data-lang'));
      });
    }
  }

  // Applique au plus tôt pour éviter le flash de langue par défaut
  apply(getLang());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initSwitch(); apply(getLang()); });
  } else {
    initSwitch();
  }

  window.__getLang = getLang;
  window.__setLang = setLang;
})();
