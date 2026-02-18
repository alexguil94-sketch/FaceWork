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
- `tutoriel.html` : Tutoriel (prise en main)
- `exercices.html` : Exercices (hub) + pages dans `exercices/`
- `tutos.html` : Tutos (hub) + pages dans `tutos/`
- `langages.html` : Langages (hub) + pages dans `langages/`
- `app/feed.html` : Publications
- `app/salon.html` : Salons (liste)
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
Si tu avais déjà appliqué une ancienne version, relance le fichier : il ajoute aussi les colonnes fichiers (`file_url`, `file_name`) pour les messages.

Note : le schéma ajoute aussi un trigger **Auth → Profiles** qui crée automatiquement la ligne `public.profiles` à l’inscription (recommandé).

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
Pour déposer des fichiers directement (publications **et** messages dans canaux/DM) :
1. Supabase → **Storage** → crée un bucket nommé `facework` (recommandé : **privé**)
2. Supabase → **SQL Editor** → copie/colle `supabase/storage.sql` → **Run** (policies RLS par entreprise)
3. (Si tu changes le nom du bucket) mets à jour `SUPABASE_BUCKET` dans `js/env.js`

### 5) Visio + partage d’écran
- La visio utilise **WebRTC** et **Supabase Realtime** (signaling) : bouton 📹 dans les canaux et les DM.
- Ça marche en **HTTPS** (Netlify) ou sur **localhost** (Live Server). Sans serveur TURN, certains réseaux peuvent bloquer la connexion.

### 6) Comment ça marche dans l’app
- **Entreprise / workspace** : tu la saisis sur `login.html` (champ “Entreprise / workspace”). Toutes les données sont isolées par ce champ.
- **Premier membre d’un workspace** : devient **admin** automatiquement (trigger SQL).
- **Admin → Membres** : les membres apparaissent après s’être connectés (Supabase Auth), puis l’admin peut leur attribuer des rôles.

## IA (Assistant)
Un **assistant IA** peut être activé via une **Netlify Function** (clé API gardée côté serveur).

### Activer sur Netlify
1. Netlify → **Site configuration → Environment variables**
2. Ajoute :
   - `OPENAI_API_KEY` (obligatoire)
   - `OPENAI_MODEL` (optionnel, ex: `gpt-4o-mini`)
3. Redéploie le site (ou “Clear cache and deploy site”).

Ensuite, un bouton **🤖** apparaît en bas à droite (et un bouton “🤖 Aide IA” dans chaque exercice).

### Générer des exercices (admin)
Dans `app/admin.html` → **Exercices & tutoriels**, le bouton **🤖 Générer** remplit automatiquement le formulaire (à valider puis **Enregistrer**).

### Modération (messages)
Un admin peut supprimer des messages dans les canaux. Si tu utilises Supabase, pense à **rejouer** `supabase/schema.sql` (ajout des policies + trigger `after delete`).

### Note dev locale
Avec **Live Server**, les Functions ne tournent pas : teste plutôt après déploiement Netlify (ou avec Netlify Dev si tu l’utilises).

## GIF (bibliothèque)
Dans les **canaux** et les **DM**, le bouton **GIF** ouvre une bibliothèque (tendances + recherche).

Techniquement :
- La recherche passe par une **Netlify Function** : `/.netlify/functions/gifs` (Tenor).

### (Recommandé) Configurer ta clé Tenor sur Netlify
Netlify → **Site configuration → Environment variables** :
- `TENOR_API_KEY`

Sans `TENOR_API_KEY`, le projet utilise une clé de démo (OK pour une présentation, mais limitée).

Amuse-toi bien.
