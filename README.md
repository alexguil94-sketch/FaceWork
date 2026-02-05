# FaceWork — Version HTML (débutant friendly)

Cette version est en **HTML / CSS / JS** (aucun npm, aucun build).

## Ouvrir le site (le plus simple)
### Option A — VS Code + Live Server (recommandé)
1. Dézippe le projet
2. Ouvre le dossier **facework-html** dans **VS Code**
3. Installe l’extension **Live Server** (Ritwick Dey)
4. Clique **Go Live** (en bas à droite)
5. Ouvre : `http://127.0.0.1:5500/index.html` (ou l’URL que Live Server te donne)

✅ Avantage : `localStorage` marche bien + navigation entre pages OK.

### Option B — Ouvrir index.html en double-clic
Tu peux ouvrir `index.html` directement, **mais** selon le navigateur, `localStorage` peut être limité en mode `file://`.
Si tu vois des comportements bizarres, utilise Live Server.

## Pages
- `index.html` : Landing
- `login.html` : Connexion (démo)
- `app/feed.html` : Publications
- `app/channels.html` : Canaux
- `app/messages.html` : Messages (DM)
- `app/settings.html` : Paramètres

## Fichiers importants
- `css/style.css` : tout le design (couleurs, glassmorphism, boutons, layout)
- `js/site.js` : thème + “auth” démo + toast + guard app
- `js/app.js` : feed / canaux / messages / settings (données en localStorage)

## Modifier les textes / couleurs
- Textes : directement dans les fichiers `.html`
- Couleurs : dans `css/style.css` → section `:root`

Amuse-toi bien 😄
