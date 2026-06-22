# ComptaClair — MVP

Cette version fonctionne avec sauvegarde locale, puis passe automatiquement en base Supabase quand l'utilisateur est connecté et que le schéma est installé.

## Fichiers

- `index.html` : structure de la page
- `style.css` : mise en page et responsive
- `script.js` : opérations, calculs, sauvegarde locale/base et export CSV

## Lancement

Ouvre `index.html` dans ton navigateur ou utilise l’extension Live Server dans VS Code.

## Base de données

Pour stocker les factures sans alourdir le navigateur :

1. Ouvre Supabase Dashboard > SQL Editor.
2. Exécute le fichier `../supabase/comptaclair.sql`.
3. Vérifie que `js/env.js` contient bien l'URL, la clé publishable/anon et le bucket `facework`.
4. Connecte-toi sur le site avant d'utiliser ComptaClair.

Les fichiers PDF/images sont envoyés dans Supabase Storage et les informations facture/devis sont enregistrées dans la table `comptaclair_invoices`. Si Supabase n'est pas disponible, l'application continue en stockage local avec une limite plus basse.

## Fonctions incluses

- ajout de recettes et de dépenses ;
- import de factures PDF/image reçues par email ;
- scan PDF/OCR pour préremplir type de document, référence, date, montant et TVA ;
- création automatique d’une dépense depuis une facture ;
- archivage des factures en base Supabase avec repli local ;
- ouverture, téléchargement et modification des factures enregistrées ;
- assistant croissance avec profil entreprise, revenus/dépenses, économies, prospects, messages, CRM de relance et radar d’aides publiques ;
- tableau de bord mensuel ;
- taux de cotisations configurable ;
- provision fiscale configurable ;
- estimation du montant disponible ;
- recherche et filtres ;
- suppression d’une opération ;
- sauvegarde locale de secours via `localStorage` ;
- export CSV ;
- mode clair/sombre ;
- responsive mobile.

## Attention

Les taux sont personnalisables et les résultats sont uniquement estimatifs.
Ce prototype ne remplace pas un expert-comptable ni les informations officielles.
