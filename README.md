# FaceWork — Version HTML (débutant friendly)

Cette version est en **HTML / CSS / JS** (aucun npm, aucun build).

## Ouvrir le site (le plus simple)
### Option A — VS Code + Live Server (recommandé)
1. Ouvre le dossier **facework-html** dans **VS Code**
2. Installe l’extension **Live Server** (Ritwick Dey)
3. Clique **Go Live** (en bas à droite)
4. Ouvre : `http://127.0.0.1:5500/index.html` (ou l’URL que Live Server te donne)

✅ Avantage : navigation multi-pages OK + pas de soucis `file://`.

### Option B — Ouvrir index.html en double-clic
Ça marche, mais selon le navigateur, `localStorage` peut être limité en mode `file://`.
Si tu vois des comportements bizarres, utilise Live Server.

## Pages
- `index.html` : Landing
- `login.html` : Connexion (démo localStorage + Supabase si configuré)
- `app/feed.html` : Publications
- `app/channels.html` : Canaux
- `app/messages.html` : Messages (DM)
- `app/admin.html` : Admin (rôles / membres)
- `app/settings.html` : Paramètres

## Fichiers importants
- `css/style.css` : tout le design
- `js/site.js` : thème + toast + guard app
- `js/app.js` : feed / canaux / DM / settings / admin (localStorage ou Supabase)
- `js/env.js` : variables Supabase (URL + key)
- `js/supabase.js` : client + helpers Supabase
- `supabase/schema.sql` : tables + RLS + triggers (à coller dans Supabase SQL Editor)

## Modifier les textes / couleurs
- Textes : directement dans les fichiers `.html`
- Couleurs : dans `css/style.css` → section `:root`

## Git + Netlify (déploiement)
1. Crée un repo GitHub (vide)
2. Dans ce dossier, ajoute le remote puis push :
   - `git remote add origin <URL_DU_REPO>`
   - `git push -u origin main`
3. Sur Netlify :
   - **Add new site → Import an existing project**
   - choisis ton repo
   - Netlify détecte `netlify.toml` (publish = `.`), puis déploie

Astuce : l’URL `/app` redirige vers `/app/feed.html` (config dans `netlify.toml`).

## Supabase (auth + données pour tout le projet)
### 1) Appliquer le schéma SQL
1. Supabase → **SQL Editor**
2. Copie/colle `supabase/schema.sql`
3. Clique **Run**

Ça crée : `profiles`, `posts`, `channels`, `dm_threads`, `roles`, etc + RLS + triggers (compteurs likes/messages).

### 2) Configurer l’auth
1. Supabase → **Authentication → Providers** : active **Email**
2. (Recommandé pour une démo) Supabase → **Authentication → Settings** : désactive la confirmation email, sinon l’inscription demandera de confirmer par email.
3. Supabase → **Authentication → URL Configuration** :
   - **Site URL** = ton domaine Netlify (ex: `https://ton-site.netlify.app`)
   - **Redirect URLs** = ajoute aussi ton URL locale Live Server (ex: `http://127.0.0.1:5502`)

### 3) Mettre les clés dans le projet
1. Supabase → **Project Settings → API Keys**
2. Récupère :
   - **Project URL**
   - **Publishable key** (ou **Anon key**)
3. Ouvre `js/env.js` et colle :
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

⚠️ La clé **Publishable/Anon** est faite pour être utilisée côté navigateur (elle n’est pas “secrète” comme la `service_role`). Ne mets jamais `service_role` dans un projet front-only.

### 4) Upload de fichiers (Storage)
Pour déposer des fichiers directement dans une publication (glisser‑déposer sur le feed) :
1. Supabase → **Storage** → crée un bucket nommé `facework` (recommandé : **privé**)
2. Supabase → **SQL Editor** → copie/colle `supabase/storage.sql` → **Run** (policies RLS par entreprise)
3. (Si tu changes le nom du bucket) mets à jour `SUPABASE_BUCKET` dans `js/env.js`

### 5) Comment ça marche dans l’app
- **Entreprise / workspace** : tu la saisis sur `login.html` (champ “Entreprise / workspace”). Toutes les données sont isolées par ce champ.
- **Premier membre d’un workspace** : devient **admin** automatiquement (trigger SQL).
- **Admin → Membres** : les membres apparaissent après s’être connectés (Supabase Auth), puis l’admin peut leur attribuer des rôles.

Amuse-toi bien.
