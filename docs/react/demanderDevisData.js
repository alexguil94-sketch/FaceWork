export const quotePageContent = {
  studioName: "Digitalexis Studio",
  heroBadge: "Demander un devis",
  heroTitle: "Cadrez un budget digital premium avant le premier echange.",
  heroBody:
    "Cette page transforme une demande floue en estimation lisible. Le simulateur distingue les prestations ponctuelles, les accompagnements mensuels et les extras pour donner une projection serieuse, elegante et directement exploitable.",
  primaryCtaLabel: "Simuler mon devis",
  primaryCtaHref: "#simulateur-devis",
  secondaryCtaLabel: "Demander un rendez-vous",
  secondaryCtaHref: "#formulaire-contact",
  heroStats: [
    {
      value: "5 univers",
      label: "strategie, site web, SEO, social et extras",
    },
    {
      value: "Des 190 EUR",
      label: "pour poser un cadrage de depart credible",
    },
    {
      value: "Calcul live",
      label: "projection ponctuelle, mensuelle et globale",
    },
  ],
  heroOffers: [
    {
      title: "Strategie digitale",
      priceLabel: "A partir de 190 EUR",
      description:
        "Pour clarifier le message, les priorites et les bons leviers avant execution.",
    },
    {
      title: "Site vitrine premium",
      priceLabel: "A partir de 790 EUR",
      description:
        "Pour installer une presence en ligne claire, rassurante et prete a convertir.",
    },
    {
      title: "SEO",
      priceLabel: "A partir de 290 EUR",
      description:
        "Pour rendre les pages plus lisibles, plus pertinentes et mieux visibles.",
    },
    {
      title: "Reseaux sociaux",
      priceLabel: "A partir de 290 EUR / mois",
      description:
        "Pour garder un rythme editorial propre et une image plus reguliere.",
    },
  ],
  simulatorEyebrow: "Simulateur interactif",
  simulatorTitle: "Composez votre devis avec une lecture immediate du budget.",
  simulatorBody:
    "Chaque bloc peut etre active seul ou combine avec d'autres. Le recapitulatif se met a jour en direct et separe clairement les montants de lancement, les couts recurrents et la projection globale.",
  summaryNote:
    "Les montants affiches sont indicatifs. Le devis final est ajuste selon le perimetre, les contenus disponibles, les integrations et le niveau de finition attendu.",
  documentEyebrow: "Document",
  documentTitle: "Un devis presentable, partageable et pret a imprimer.",
  documentBody:
    "Le document se construit automatiquement a partir de votre selection. Il sert d'aperçu premium avant telechargement PDF, impression papier ou partage rapide.",
  formEyebrow: "Formulaire de contact",
  formTitle: "Transformez l'estimation en demande de devis structuree.",
  formBody:
    "Le formulaire reprend votre selection, votre budget estime et votre contexte projet. Il est pret a etre branche sur un CRM, un webhook, une Netlify Function ou une API maison.",
  faqEyebrow: "FAQ",
  faqTitle:
    "Questions frequentes sur les prix, les delais et la personnalisation.",
  faqBody:
    "Cette section rassure sur la methode, explique les tarifs et clarifie la difference entre estimation initiale et devis final.",
};

export const quoteStudioProfile = {
  legalName: "Digitalexis Studio",
  contactName: "Alexis Guillotin",
  email: "alexguil94@hotmail.fr",
  phone: "+33 7 67 03 34 08",
  location: "Paris, France",
  websiteLabel: "digitalexis-studio.org",
  validDays: 30,
  footerNote:
    "Devis indicatif prepare a partir du simulateur. Le document final est ajuste apres echange, validation du perimetre et arbitrage des options retenues.",
};

export const quoteProjectTypes = [
  "Projet mixte",
  "Strategie digitale",
  "Creation de site web",
  "Refonte de site",
  "SEO",
  "Reseaux sociaux",
  "Extras / maintenance",
];

export const quoteCategories = [
  {
    id: "strategie-digitale",
    title: "Strategie digitale",
    description:
      "Pour cadrer le positionnement, les priorites et le plan d'action avant execution.",
    items: [
      {
        id: "audit-express",
        title: "Audit express",
        description:
          "Lecture rapide du positionnement digital, points faibles visibles et priorites immediates.",
        min: 150,
        max: 300,
        pricingLabel: "150 a 300 EUR",
        fromLabel: "A partir de 190 EUR",
        billing: "one_time",
        kindLabel: "Ponctuel",
      },
      {
        id: "audit-complet-plan-action",
        title: "Audit complet + plan d'action",
        description:
          "Analyse plus poussee, recommandations structurees et feuille de route actionnable.",
        min: 350,
        max: 900,
        pricingLabel: "350 a 900 EUR",
        fromLabel: "A partir de 390 EUR",
        billing: "one_time",
        kindLabel: "Strategie",
        featured: true,
      },
      {
        id: "accompagnement-strategie-mensuel",
        title: "Accompagnement strategie digitale mensuel",
        description:
          "Suivi recurrent pour ajuster le cap, prioriser les chantiers et garder une execution coherente.",
        min: 250,
        max: 900,
        pricingLabel: "250 a 900 EUR / mois",
        fromLabel: "A partir de 290 EUR / mois",
        billing: "monthly",
        kindLabel: "Mensuel",
        quantityLabel: "Mois",
        defaultQuantity: 3,
        minQuantity: 1,
        maxQuantity: 12,
      },
      {
        id: "consulting-heure",
        title: "Consulting a l'heure",
        description:
          "Bloc de conseil cible pour arbitrage, cadrage technique ou revision strategique ponctuelle.",
        min: 40,
        max: 80,
        pricingLabel: "40 a 80 EUR / h",
        fromLabel: "A partir de 40 EUR / h",
        billing: "one_time",
        kindLabel: "A l'heure",
        quantityLabel: "Heures",
        defaultQuantity: 2,
        minQuantity: 1,
        maxQuantity: 20,
      },
    ],
  },
  {
    id: "creation-site-web",
    title: "Creation de site web",
    description:
      "Pour passer d'une simple presence a une vitrine claire, premium et plus convaincante.",
    items: [
      {
        id: "landing-page-simple",
        title: "Landing page simple",
        description:
          "Une page de vente ou de presentation avec structure claire, CTA et rendu propre sur mobile.",
        min: 300,
        max: 700,
        pricingLabel: "300 a 700 EUR",
        fromLabel: "A partir de 390 EUR",
        billing: "one_time",
        kindLabel: "Landing",
      },
      {
        id: "site-vitrine-1-3-pages",
        title: "Site vitrine 1 a 3 pages",
        description:
          "Base solide pour une entreprise qui veut une presence simple, propre et credible.",
        min: 700,
        max: 1500,
        pricingLabel: "700 a 1 500 EUR",
        fromLabel: "A partir de 790 EUR",
        billing: "one_time",
        kindLabel: "Principal",
        featured: true,
      },
      {
        id: "site-vitrine-pro-4-8-pages",
        title: "Site vitrine pro 4 a 8 pages",
        description:
          "Presentation plus complete de l'offre, des preuves, du positionnement et des points de contact.",
        min: 1500,
        max: 3000,
        pricingLabel: "1 500 a 3 000 EUR",
        fromLabel: "A partir de 1 590 EUR",
        billing: "one_time",
        kindLabel: "Premium",
        featured: true,
      },
      {
        id: "site-premium",
        title: "Site premium",
        description:
          "Rendu haut de gamme, direction visuelle plus poussee, structure conversion et execution soignee.",
        min: 2500,
        max: 5000,
        pricingLabel: "2 500 a 5 000 EUR",
        fromLabel: "A partir de 2 590 EUR",
        billing: "one_time",
        kindLabel: "Signature",
      },
      {
        id: "refonte-de-site",
        title: "Refonte de site",
        description:
          "Reprise de l'image, de l'architecture et des contenus pour redonner de la clarte au site existant.",
        min: 900,
        max: 3500,
        pricingLabel: "900 a 3 500 EUR",
        fromLabel: "A partir de 1 290 EUR",
        billing: "one_time",
        kindLabel: "Refonte",
        featured: true,
      },
      {
        id: "ecommerce-simple",
        title: "Site e-commerce simple",
        description:
          "Boutique claire avec tunnel simple, fiches produits et structure de vente propre.",
        min: 1800,
        max: 4500,
        pricingLabel: "1 800 a 4 500 EUR",
        fromLabel: "A partir de 1 990 EUR",
        billing: "one_time",
        kindLabel: "E-commerce",
      },
      {
        id: "ecommerce-avance",
        title: "Site e-commerce avance",
        description:
          "Projet plus dense avec catalogue, automatisations, variations, filtres et structure sur mesure.",
        min: 4500,
        max: 10000,
        pricingLabel: "4 500 a 10 000 EUR+",
        fromLabel: "A partir de 4 900 EUR",
        billing: "one_time",
        kindLabel: "Avance",
      },
    ],
  },
  {
    id: "seo",
    title: "SEO",
    description:
      "Pour rendre les pages plus pertinentes, plus lisibles et plus visibles sur les bonnes recherches.",
    items: [
      {
        id: "optimisation-seo-base",
        title: "Optimisation SEO de base",
        description:
          "Titles, meta descriptions, Hn, ajustements de contenus et hygiene on-page de depart.",
        min: 200,
        max: 600,
        pricingLabel: "200 a 600 EUR",
        fromLabel: "A partir de 290 EUR",
        billing: "one_time",
        kindLabel: "SEO",
        featured: true,
      },
      {
        id: "audit-seo-complet",
        title: "Audit SEO complet",
        description:
          "Analyse detaillee de la structure, des pages existantes, du contenu et des opportunites de priorisation.",
        min: 300,
        max: 900,
        pricingLabel: "300 a 900 EUR",
        fromLabel: "A partir de 390 EUR",
        billing: "one_time",
        kindLabel: "Audit",
      },
      {
        id: "pack-seo-mensuel",
        title: "Pack SEO mensuel",
        description:
          "Suivi progressif des pages prioritaires, ajustements, contenus et maillage interne.",
        min: 150,
        max: 700,
        pricingLabel: "150 a 700 EUR / mois",
        fromLabel: "A partir de 190 EUR / mois",
        billing: "monthly",
        kindLabel: "Mensuel",
        quantityLabel: "Mois",
        defaultQuantity: 3,
        minQuantity: 1,
        maxQuantity: 12,
      },
      {
        id: "redaction-page-seo",
        title: "Redaction page SEO",
        description:
          "Creation ou reecriture d'une page ciblee pour une recherche utile, avec intention et structure propre.",
        min: 50,
        max: 150,
        pricingLabel: "50 a 150 EUR / page",
        fromLabel: "A partir de 60 EUR / page",
        billing: "one_time",
        kindLabel: "Contenu",
        quantityLabel: "Pages",
        defaultQuantity: 2,
        minQuantity: 1,
        maxQuantity: 20,
      },
      {
        id: "google-business-profile",
        title: "Google Business Profile",
        description:
          "Creation ou optimisation de la fiche pour renforcer la visibilite locale et la confiance.",
        min: 80,
        max: 250,
        pricingLabel: "80 a 250 EUR",
        fromLabel: "A partir de 90 EUR",
        billing: "one_time",
        kindLabel: "Local",
      },
    ],
  },
  {
    id: "reseaux-sociaux",
    title: "Reseaux sociaux",
    description:
      "Pour poser une presence sociale propre, plus reguliere et mieux alignee avec l'image de marque.",
    items: [
      {
        id: "creation-optimisation-profil",
        title: "Creation ou optimisation de profil",
        description:
          "Mise a niveau du profil, des visuels, des informations et des points de contact.",
        min: 80,
        max: 250,
        pricingLabel: "80 a 250 EUR",
        fromLabel: "A partir de 90 EUR",
        billing: "one_time",
        kindLabel: "Profil",
      },
      {
        id: "pack-lancement-reseaux",
        title: "Pack lancement reseaux sociaux",
        description:
          "Base de demarrage avec organisation, premiers contenus et direction editoriale de depart.",
        min: 150,
        max: 500,
        pricingLabel: "150 a 500 EUR",
        fromLabel: "A partir de 190 EUR",
        billing: "one_time",
        kindLabel: "Lancement",
      },
      {
        id: "gestion-mensuelle-legere",
        title: "Gestion mensuelle legere",
        description:
          "Suivi simple pour garder une presence reguliere avec un volume raisonnable de contenus.",
        min: 200,
        max: 500,
        pricingLabel: "200 a 500 EUR / mois",
        fromLabel: "A partir de 290 EUR / mois",
        billing: "monthly",
        kindLabel: "Mensuel",
        quantityLabel: "Mois",
        defaultQuantity: 3,
        minQuantity: 1,
        maxQuantity: 12,
      },
      {
        id: "gestion-mensuelle-standard",
        title: "Gestion mensuelle standard",
        description:
          "Pilotage plus regulier, plus de contenus et meilleure tenue du rythme editorial.",
        min: 500,
        max: 1200,
        pricingLabel: "500 a 1 200 EUR / mois",
        fromLabel: "A partir de 590 EUR / mois",
        billing: "monthly",
        kindLabel: "Standard",
        quantityLabel: "Mois",
        defaultQuantity: 3,
        minQuantity: 1,
        maxQuantity: 12,
        featured: true,
      },
      {
        id: "calendrier-editorial",
        title: "Calendrier editorial",
        description:
          "Planning de contenus, angles, themes et rythme de publication pour garder de la coherence.",
        min: 120,
        max: 350,
        pricingLabel: "120 a 350 EUR",
        fromLabel: "A partir de 150 EUR",
        billing: "one_time",
        kindLabel: "Editorial",
      },
      {
        id: "visuel-simple-carrousel",
        title: "Visuel simple ou carrousel",
        description:
          "Visuel statique ou carrousel pour appuyer une prise de parole claire et propre.",
        min: 20,
        max: 80,
        pricingLabel: "20 a 80 EUR / visuel",
        fromLabel: "A partir de 20 EUR / visuel",
        billing: "one_time",
        kindLabel: "Visuel",
        quantityLabel: "Visuels",
        defaultQuantity: 4,
        minQuantity: 1,
        maxQuantity: 30,
      },
      {
        id: "montage-video-short",
        title: "Montage video short ou reel",
        description:
          "Montage court, rythme adapte au format et rendu plus propre pour la diffusion sociale.",
        min: 40,
        max: 150,
        pricingLabel: "40 a 150 EUR / video",
        fromLabel: "A partir de 50 EUR / video",
        billing: "one_time",
        kindLabel: "Video",
        quantityLabel: "Videos",
        defaultQuantity: 2,
        minQuantity: 1,
        maxQuantity: 20,
      },
    ],
  },
  {
    id: "extras",
    title: "Extras",
    description:
      "Pour completer la prestation principale avec les bons details visuels, techniques ou fonctionnels.",
    items: [
      {
        id: "nom-domaine-mise-en-ligne",
        title: "Nom de domaine + aide a la mise en ligne",
        description:
          "Aide au cadrage du domaine, parametres de base et mise en ligne accompagnee.",
        min: 30,
        max: 120,
        pricingLabel: "30 a 120 EUR",
        fromLabel: "A partir de 40 EUR",
        billing: "one_time",
        kindLabel: "Mise en ligne",
      },
      {
        id: "maintenance-site",
        title: "Maintenance site",
        description:
          "Petites corrections, surveillance simple et suivi continu pour garder le site propre.",
        min: 20,
        max: 150,
        pricingLabel: "20 a 150 EUR / mois",
        fromLabel: "A partir de 30 EUR / mois",
        billing: "monthly",
        kindLabel: "Mensuel",
        quantityLabel: "Mois",
        defaultQuantity: 6,
        minQuantity: 1,
        maxQuantity: 12,
      },
      {
        id: "sauvegardes-securite-mises-a-jour",
        title: "Sauvegardes, securite et mises a jour",
        description:
          "Routine de base pour garder un socle technique plus sain et plus rassurant.",
        min: 30,
        max: 100,
        pricingLabel: "30 a 100 EUR / mois",
        fromLabel: "A partir de 40 EUR / mois",
        billing: "monthly",
        kindLabel: "Support",
        quantityLabel: "Mois",
        defaultQuantity: 6,
        minQuantity: 1,
        maxQuantity: 12,
      },
      {
        id: "formulaire-avance-reservation",
        title: "Formulaire avance ou reservation",
        description:
          "Formulaire plus evolue, demandes qualifiees, prise de rendez-vous ou reservation simple.",
        min: 50,
        max: 250,
        pricingLabel: "50 a 250 EUR",
        fromLabel: "A partir de 60 EUR",
        billing: "one_time",
        kindLabel: "Fonction",
      },
      {
        id: "integration-avis-clients",
        title: "Integration d'avis clients",
        description:
          "Ajout d'une couche de preuve sociale pour rassurer et soutenir la conversion.",
        min: 30,
        max: 120,
        pricingLabel: "30 a 120 EUR",
        fromLabel: "A partir de 40 EUR",
        billing: "one_time",
        kindLabel: "Preuve",
      },
      {
        id: "galerie-photo-portfolio",
        title: "Galerie photo ou portfolio",
        description:
          "Mise en valeur d'images, projets ou references avec un rendu plus structure et plus propre.",
        min: 50,
        max: 250,
        pricingLabel: "50 a 250 EUR",
        fromLabel: "A partir de 70 EUR",
        billing: "one_time",
        kindLabel: "Portfolio",
      },
      {
        id: "favicon-mini-logo",
        title: "Favicon ou mini-logo",
        description:
          "Petit element de marque pour gagner en coherence sur le site et les onglets navigateur.",
        min: 20,
        max: 60,
        pricingLabel: "20 a 60 EUR",
        fromLabel: "A partir de 20 EUR",
        billing: "one_time",
        kindLabel: "Branding",
      },
      {
        id: "charte-graphique-legere",
        title: "Charte graphique legere",
        description:
          "Base visuelle simple pour cadrer couleurs, typographies et style de presentation.",
        min: 150,
        max: 500,
        pricingLabel: "150 a 500 EUR",
        fromLabel: "A partir de 190 EUR",
        billing: "one_time",
        kindLabel: "Identite",
      },
    ],
  },
];

export const quoteFaq = [
  {
    question: "Les prix affiches sont-ils definitifs ?",
    answer:
      "Non. Les montants servent de repere pour cadrer le projet. Le devis final est ajuste selon le perimetre, les contenus disponibles, les integrations et le niveau de finition attendu.",
  },
  {
    question: "Puis-je combiner site web, SEO et reseaux sociaux ?",
    answer:
      "Oui. Le simulateur est pense pour assembler plusieurs blocs: strategie, site vitrine, refonte, SEO, reseaux sociaux, maintenance et extras techniques.",
  },
  {
    question: "Comment sont gerees les prestations mensuelles ?",
    answer:
      "Les services mensuels affichent une fourchette par mois. La page distingue le budget recurrent et la projection sur la duree choisie.",
  },
  {
    question: "Quels sont les delais moyens de production ?",
    answer:
      "Ils dependent du type de mission et des contenus a produire. Une landing simple peut aller vite, alors qu'une refonte premium ou un e-commerce demande plus de cadrage et de validations.",
  },
  {
    question: "Le devis final peut-il etre personnalise ?",
    answer:
      "Oui. Le simulateur sert a poser une base. Ensuite, on peut retirer, regrouper ou ajouter des prestations pour coller au besoin reel et au budget vise.",
  },
];
