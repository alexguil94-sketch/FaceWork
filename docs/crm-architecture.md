# Architecture CRM / Facturation

## Stack retenue
- Frontend: HTML/CSS/JS statique integre au site FaceWork existant
- Auth et base de donnees: Supabase Auth + PostgreSQL + RLS
- Stockage documents: Supabase Storage (bucket `facework`)
- PDF: `jsPDF` + `jspdf-autotable` cote navigateur
- Fallback local: `localStorage` si Supabase n'est pas configure

## Pages admin CRM
- `app/crm-dashboard.html`: KPI, CA, activite recente, actions rapides
- `app/crm-clients.html`: CRUD clients + recherche + export CSV
- `app/crm-quotes.html`: liste, filtres, PDF, duplication, conversion en facture
- `app/crm-quote.html`: edition d'un devis, calculs live, apercu, PDF
- `app/crm-invoices.html`: liste, filtres, impression, suivi des restes dus
- `app/crm-invoice.html`: edition d'une facture, paiements, impression, PDF
- `app/crm-settings.html`: identite legale, TVA, mentions, numerotation, logo

## Composants UI
- Shell CRM avec sidebar premium et navigation admin protegee
- Hero panels, cartes KPI, bar chart mensuel
- Tableaux filtres / export CSV
- Modale client pour creation rapide depuis le CRM
- Editeurs devis/factures en split view:
  - formulaire principal
  - totaux automatiques
  - apercu document type PDF

## Base de donnees
Definie dans `supabase/crm.sql`.

Tables:
- `crm_settings`
- `crm_clients`
- `crm_sequences`
- `crm_quotes`
- `crm_quote_items`
- `crm_invoices`
- `crm_invoice_items`
- `crm_invoice_payments`

Fonctions SQL:
- `crm_reserve_document_number`
- `crm_convert_quote_to_invoice`
- `crm_seed_demo_data`
- recalculs automatiques devis / factures

## Numerotation
- Devis: `DEV-ANNEE-XXX`
- Factures: `FAC-ANNEE-XXX`
- Incrementation atomique par table `crm_sequences`
- Pas de doublon par entreprise / type / annee

## Securite
- Toutes les routes CRM sont traitees comme routes admin (`/app/crm*`)
- Policies RLS admin-only sur toutes les tables CRM
- Validation de base cote front avant sauvegarde
- Confirmation avant suppression

## Fichiers cle
- `css/crm.css`
- `js/crm.js`
- `supabase/crm.sql`
- `netlify.toml`
