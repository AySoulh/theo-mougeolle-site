# Backoffice — guide de mise en route

Le backoffice se trouve à l'adresse : `https://aysoulh.github.io/theo-mougeolle-site/admin/`

Il permet de modifier les projets (titres, textes, images) depuis une interface, sans toucher au code. Chaque modification est enregistrée sur GitHub, puis le site se met à jour tout seul.

Pour qu'il fonctionne, il reste **deux réglages à faire une seule fois** (ils ne sont pas automatisables : ils touchent à la sécurité de la connexion). Comptez ~15 min.

---

## Pourquoi ces réglages ?

Le site est hébergé sur GitHub Pages, qui ne fait tourner aucun serveur. Or, pour se connecter avec GitHub en toute sécurité, il faut un tout petit service intermédiaire (« proxy OAuth ») qui garde secrète la clé de connexion. Ce service est gratuit et se déploie en quelques clics.

---

## Étape 1 — Créer une « OAuth App » GitHub

1. Aller sur https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Remplir :
   - **Application name** : `Backoffice Théo Mougeolle`
   - **Homepage URL** : `https://aysoulh.github.io/theo-mougeolle-site/`
   - **Authorization callback URL** : (à compléter à l'étape 2, une fois le proxy déployé)
3. Valider. Noter le **Client ID** et générer un **Client Secret** (les garder de côté).

## Étape 2 — Déployer le proxy OAuth (gratuit)

Le proxy le plus simple est déployable en un clic sur Netlify (vous avez déjà un compte connecté) :

1. Ouvrir : https://github.com/decaporg/decap-cms/tree/main/packages/netlify-cms-backend-github#external-oauth-clients — ou utiliser un proxy prêt à l'emploi comme **`vencax/netlify-cms-github-oauth-provider`** ou **`sterlingwes/decap-proxy`** (Cloudflare Workers).
2. Lors du déploiement, renseigner les variables :
   - `OAUTH_CLIENT_ID` = le Client ID de l'étape 1
   - `OAUTH_CLIENT_SECRET` = le Client Secret de l'étape 1
3. Le proxy vous donne une URL, par ex. `https://mon-proxy.netlify.app`.
4. Revenir sur l'OAuth App (étape 1) et mettre comme **callback URL** : `https://mon-proxy.netlify.app/callback` (l'URL exacte est indiquée par le proxy choisi).

## Étape 3 — Brancher le proxy dans le CMS

Dans `admin/config.yml`, remplacer la ligne :

```yaml
  base_url: https://REMPLACER-PAR-URL-DU-PROXY-OAUTH
```

par l'URL de votre proxy (étape 2), par ex. :

```yaml
  base_url: https://mon-proxy.netlify.app
```

Committer ce changement.

---

## C'est prêt

Aller sur `.../admin/`, cliquer **Login with GitHub**, autoriser, et vous pouvez éditer les projets. À chaque enregistrement :

1. Le CMS écrit le contenu dans `content/projects/…json` sur GitHub.
2. Une action automatique régénère les pages HTML correspondantes.
3. Le site se met à jour en une à deux minutes.

## Étape 0 (préalable) — Installer l'action de build

Le fichier `admin/build-workflow.yml.txt` contient l'action automatique qui régénère les pages quand vous modifiez un projet. Il doit être placé au bon endroit (je n'ai pas pu le déposer automatiquement, GitHub réservant ce type de fichier à une autorisation spéciale) :

1. Dans le dépôt, créer le dossier `.github/workflows/` s'il n'existe pas.
2. Y copier le contenu de `admin/build-workflow.yml.txt` sous le nom `build.yml`.
3. Committer.

Sans cette action, l'édition fonctionne mais les pages ne se régénèrent pas toutes seules : il faudrait lancer `node scripts/build.js` à la main. Avec elle, tout est automatique.


## Ce qui est éditable

- Le **titre** de chaque projet.
- Les **infos** (rôle, support, univers…) — ajout/suppression libre.
- Les **paragraphes** de texte.
- L'**image à droite du titre**.
- Les **blocs d'images** : ajout, suppression, **réordonnancement par glisser-déposer** (« placer les images comme je veux »).
- Une **vidéo de fin** optionnelle.

> Note : les pages *Variablefont* et *Flower particules* sont des démos interactives sur mesure ; elles ne sont pas gérées par le backoffice pour ne pas casser leurs animations.
