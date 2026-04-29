/* ═══════════════════════════════════════════════════
   ÉcoloLab Déchets Aube — script.js
   Assistant de tri · Carte Leaflet · KPI · Navbar · Thème · Scroll
═══════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────
   BASE DE DONNÉES DES DÉCHETS
   À enrichir avec les données réelles de l'Aube.
   TODO: Connecter à Supabase / Firebase pour une base collaborative.
────────────────────────────────────────────────── */
const wasteDatabase = [
  {
    keywords: ['bouteille verre', 'bocal', 'pot confiture', 'verre', 'bouteille'],
    category: 'Verre',
    destination: '🫙 Borne à verre',
    conseil: 'Déposez sans le bouchon ni le couvercle dans la borne à verre la plus proche. Ne mettez pas de verre dans le bac jaune.',
    impact: '🌍 1 kg de verre recyclé = 1,2 kg de CO₂ économisé',
  },
  {
    keywords: ['carton', 'boîte', 'emballage carton', 'pizza carton'],
    category: 'Recyclable',
    destination: '♻️ Bac jaune',
    conseil: 'Aplatissez les cartons avant de les déposer dans le bac jaune. Enlevez les éventuels plastiques ou emballages alimentaires collés.',
    impact: '🌍 Recycler 1 tonne de carton économise 2,5 tonnes de CO₂',
  },
  {
    keywords: ['pot yaourt', 'barquette plastique', 'plastique', 'bouteille plastique', 'flacon', 'bidon'],
    category: 'Recyclable',
    destination: '♻️ Bac jaune',
    conseil: 'Dans l\'Aube, tous les emballages plastiques sont acceptés dans le bac jaune depuis l\'extension des consignes. Videz bien les contenants.',
    impact: '🌍 Recycler un flacon de shampoing économise l\'énergie d\'une heure d\'éclairage',
  },
  {
    keywords: ['papier', 'journal', 'magazine', 'revue', 'enveloppe', 'copie'],
    category: 'Recyclable',
    destination: '♻️ Bac jaune',
    conseil: 'Papiers, journaux et magazines dans le bac jaune. Pas besoin de les déchirer. Évitez les papiers souillés ou gras.',
    impact: '🌍 Recycler 1 kg de papier préserve 17 litres d\'eau',
  },
  {
    keywords: ['bac jaune', 'recyclable', 'tri sélectif', 'emballage'],
    category: 'Recyclable',
    destination: '♻️ Bac jaune',
    conseil: 'Le bac jaune accepte les emballages plastiques, les cartons, les papiers et les boîtes métalliques. Pas de verre ni de déchets alimentaires.',
    impact: '🌍 1 tonne de matière recyclée = 2 à 3 tonnes de CO₂ économisées',
  },
  {
    keywords: ['épluchures', 'restes repas', 'biodéchets', 'compost', 'pelures', 'déchets verts', 'gazon', 'feuilles'],
    category: 'Biodéchets',
    destination: '🌿 Composteur ou bac biodéchets',
    conseil: 'À composter si vous avez un composteur. Sinon, déposez dans le bac biodéchets s\'il est disponible dans votre commune. Pas de viande ni d\'huile dans un composteur de jardin.',
    impact: '🌱 Composter ses biodéchets réduit de 30 % le volume de la poubelle noire',
  },
  {
    keywords: ['pile', 'piles', 'batterie', 'accu'],
    category: 'Déchets spéciaux',
    destination: '🔋 Point de collecte piles',
    conseil: 'Déposez vos piles usagées dans les bacs spéciaux disponibles en supermarché, pharmacie ou déchèterie. Ne jamais jeter dans la poubelle noire.',
    impact: '⚠️ Une pile jetée dans la nature contamine jusqu\'à 1 m³ de sol',
  },
  {
    keywords: ['téléphone', 'smartphone', 'ordinateur', 'électronique', 'écran', 'télévision', 'tv', 'tablette'],
    category: 'Électronique (DEEE)',
    destination: '💻 Déchèterie ou reprise magasin',
    conseil: 'Les appareils électroniques sont des DEEE. Rapportez-les en déchèterie ou en magasin (tout vendeur a l\'obligation de reprendre l\'ancien matériel).',
    impact: '💡 Un smartphone contient 30 métaux rares — le recycler les préserve',
  },
  {
    keywords: ['vêtement', 'textile', 'chaussure', 'habits', 'linge', 'tissu'],
    category: 'Textile',
    destination: '👕 Point textile (colonne de collecte)',
    conseil: 'Déposez les vêtements propres et secs dans les colonnes de collecte textile. Même abîmés, ils peuvent être recyclés. Pas dans la poubelle noire.',
    impact: '👕 1 kg de textile recyclé = 12 000 litres d\'eau économisés',
  },
  {
    keywords: ['médicament', 'comprimés', 'sirop', 'pharmacie'],
    category: 'Déchets spéciaux',
    destination: '💊 Pharmacie (dispositif Cyclamed)',
    conseil: 'Rapportez vos médicaments non utilisés ou périmés à la pharmacie. Ne jamais les jeter dans la poubelle ni dans les toilettes.',
    impact: '🌊 Les médicaments jetés contaminent les nappes phréatiques',
  },
  {
    keywords: ['peinture', 'solvant', 'huile moteur', 'produit chimique', 'désherbant', 'pesticide', 'insecticide', 'acide', 'colle forte'],
    category: 'Déchets dangereux',
    destination: '🏭 Déchèterie (zone déchets dangereux)',
    conseil: 'Conservez les produits dans leur emballage d\'origine et apportez-les à la déchèterie. Ne jamais verser dans l\'évier ni la poubelle.',
    impact: '⚠️ 1 litre d\'huile de vidange peut polluer 1 million de litres d\'eau',
  },
  {
    keywords: ['ampoule', 'néon', 'tube fluorescent', 'led', 'lampe'],
    category: 'Déchets spéciaux',
    destination: '🏭 Déchèterie ou magasin (Récylum)',
    conseil: 'Les ampoules LED et basses consommation sont des DEEE. Rapportez-les en déchèterie ou dans les points de collecte des grandes surfaces.',
    impact: '✨ Une ampoule recyclée évite la dispersion de mercure dans l\'environnement',
  },
  {
    keywords: ['déchèterie', 'encombrant', 'meuble', 'canapé', 'gros déchet', 'matelas', 'sommier'],
    category: 'Déchets encombrants',
    destination: '🏭 Déchèterie la plus proche',
    conseil: 'Les déchèteries de l\'Aube acceptent les encombrants, gravats, bois, métaux et appareils électroménagers. Consultez les horaires sur le site de votre commune.',
    impact: '♻️ 65 % des matériaux en déchèterie sont valorisés ou recyclés',
  },
  {
    keywords: ['canette', 'boîte métal', 'boite conserve', 'conserve', 'boîte de thon', 'aluminium', 'capsule'],
    category: 'Recyclable',
    destination: '♻️ Bac jaune',
    conseil: 'Canettes, boîtes de conserve et barquettes aluminium vont dans le bac jaune. Pas besoin de les laver parfaitement, juste les vider.',
    impact: '🌍 Recycler l\'aluminium consomme 95 % moins d\'énergie que le produire',
  },
  {
    keywords: ['cartouche encre', 'toner', 'imprimante', 'cartouche'],
    category: 'Déchets spéciaux',
    destination: '🏭 Déchèterie ou magasin d\'informatique',
    conseil: 'Les cartouches d\'encre et toners sont des déchets dangereux. Rapportez-les en magasin (Fnac, Carrefour, Bureau Vallée) ou en déchèterie. Beaucoup de marques proposent aussi un retour gratuit.',
    impact: '💡 Une cartouche recyclée évite 1 kg de plastique en décharge',
  },
  {
    keywords: ['stylo', 'feutre', 'marqueur', 'stylos', 'crayon'],
    category: 'Déchets non recyclables',
    destination: '🗑️ Poubelle noire (ou collecte spéciale)',
    conseil: 'Les stylos et feutres classiques ne sont pas recyclables dans le bac jaune. Certaines mairies et écoles participent à des collectes spéciales (programme Bic for Change). Privilégiez les stylos rechargeables.',
    impact: '🌱 Choisir un stylo rechargeable évite jusqu\'à 6 stylos jetables par an',
  },
  {
    keywords: ['jouet', 'jouets', 'jeux', 'peluche', 'figurine', 'lego'],
    category: 'Réemploi ou déchèterie',
    destination: '♻️ Emmaüs / Association ou déchèterie',
    conseil: 'Si le jouet est en bon état, donnez-le à Emmaüs Troyes ou une association locale. Sinon, apportez-le en déchèterie. Ne pas mettre dans le bac jaune.',
    impact: '🎁 Un jouet donné, c\'est un jouet qui évite d\'être produit à nouveau',
  },
  {
    keywords: ['huile cuisson', 'huile friture', 'huile alimentaire', 'graisse cuisine'],
    category: 'Déchets spéciaux',
    destination: '🏭 Déchèterie (bidon fermé) ou collecte spécifique',
    conseil: 'Ne versez jamais l\'huile de friture dans l\'évier — elle bouche les canalisations. Stockez-la dans un bidon fermé et apportez-la en déchèterie. Certaines communes ont des collectes spécifiques.',
    impact: '🌊 1 litre d\'huile de friture peut imperméabiliser 1 000 m² de sol',
  },
  {
    keywords: ['aérosol', 'bombe', 'spray', 'déodorant bombe', 'laque'],
    category: 'Déchets dangereux',
    destination: '🏭 Déchèterie (zone déchets dangereux)',
    conseil: 'Les bombes aérosol même vides sont considérées comme déchets dangereux (gaz résiduel). Apportez-les à la déchèterie. Ne jamais percer ni jeter dans la poubelle noire.',
    impact: '⚠️ Un aérosol mal éliminé peut exploser en incinération',
  },
  {
    keywords: ['lunettes', 'monture', 'paires de lunettes'],
    category: 'Réemploi solidaire',
    destination: '👓 Opticien (collecte solidaire)',
    conseil: 'Déposez vos lunettes usagées chez n\'importe quel opticien. Elles sont collectées par des associations (Optic 2000, Les Opticiens Mobiles) et redistribuées dans les pays en développement.',
    impact: '🌍 2,5 milliards de personnes dans le monde n\'ont pas accès à des lunettes',
  },
  {
    keywords: ['polystyrène', 'mousse blanche', 'emballage polystyrène'],
    category: 'Déchets non recyclables',
    destination: '🗑️ Poubelle noire ou déchèterie',
    conseil: 'Le polystyrène expansé (blanc) n\'est pas accepté dans le bac jaune. Apportez-le en déchèterie si vous en avez en grande quantité. Les petits morceaux vont dans la poubelle noire.',
    impact: '🌱 Évitez les emballages polystyrène — choisissez le carton recyclable',
  },
  {
    keywords: ['pneu', 'pneus', 'pneumatique'],
    category: 'Déchets spéciaux',
    destination: '🏭 Déchèterie (quota annuel) ou garagiste',
    conseil: 'Apportez vos vieux pneus en déchèterie (4 pneus par an et par foyer, gratuit). Votre garagiste est aussi obligé de reprendre vos pneus usés lors d\'un changement.',
    impact: '♻️ 99 % des pneus collectés sont valorisés en énergie ou matière',
  },
  {
    keywords: ['radiateur', 'chauffe-eau', 'ballon eau chaude', 'climatiseur', 'frigidaire', 'frigo', 'réfrigérateur', 'lave-linge', 'machine à laver', 'lave-vaisselle', 'four', 'électroménager'],
    category: 'Électroménager (DEEE)',
    destination: '🏭 Déchèterie ou reprise magasin',
    conseil: 'Les gros appareils électroménagers sont des DEEE. La déchèterie les accepte gratuitement. Tout magasin vendant de l\'électroménager est tenu de reprendre votre ancien appareil (obligation légale).',
    impact: '💡 Un frigo recyclé récupère des gaz réfrigérants très polluants (x1300 effet GES vs CO₂)',
  },
  {
    keywords: ['bois', 'palette', 'planche', 'parquet', 'charpente', 'meubles bois'],
    category: 'Déchets verts / Bois',
    destination: '🏭 Déchèterie (zone bois)',
    conseil: 'Le bois propre (sans traitement ni peinture) peut être valorisé en énergie. Apportez vos palettes, planches et meubles en bois à la déchèterie. Ne pas brûler en milieu urbain.',
    impact: '♻️ Le bois recyclé sert à produire des panneaux de particules ou de l\'énergie',
  },
  {
    keywords: ['gravat', 'parpaing', 'béton', 'tuile', 'plâtre', 'carrelage', 'faïence', 'déchets chantier'],
    category: 'Gravats / Déchets inertes',
    destination: '🏭 Déchèterie (zone gravats)',
    conseil: 'Les gravats (béton, briques, parpaings) sont acceptés en déchèterie dans la limite des quantités autorisées pour les particuliers. Pas dans la poubelle noire ni le bac jaune.',
    impact: '♻️ Les gravats recyclés servent de remblai dans la construction',
  },
  {
    keywords: ['capsule café', 'nespresso', 'dosette', 'café'],
    category: 'Recyclable (filière spéciale)',
    destination: '📦 Boutique Nespresso ou point relais dédié',
    conseil: 'Les capsules aluminium Nespresso se recyclent via les boutiques de la marque ou les sacs de collecte fournis. Les dosettes souples en plastique vont dans la poubelle noire.',
    impact: '🌍 L\'aluminium des capsules est recyclable à l\'infini',
  },
  {
    keywords: ['bouchon', 'bouchons', 'bouchons plastique'],
    category: 'Collecte solidaire',
    destination: '🤝 Collecte solidaire (Bouchons d\'Amour)',
    conseil: 'Les bouchons plastiques sont collectés par l\'association "Bouchons d\'Amour". Renseignez-vous auprès des écoles, mairies et supermarchés locaux pour trouver un point de dépôt.',
    impact: '❤️ 100 bouchons = 1 centime reversé à des associations humanitaires',
  },
];

/* ──────────────────────────────────────────────────
   POINTS DE COLLECTE — AUBE (10)
   Données géolocalisées réelles ou fortement vraisemblables.
   Source de référence : SMTVD Aube, communes, Ecomaison, Refashion, Corepile.
   TODO: Synchroniser avec l'API SINOE (ADEME) pour une mise à jour automatique.
────────────────────────────────────────────────── */
const collectPoints = [

  /* ── DÉCHÈTERIES ── */
  {
    id: 1, type: 'decheterie',
    name: 'Déchèterie des Écrevolles',
    address: 'Rue des Écrevolles, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2768, lng: 4.0389,
    phone: '03 25 42 00 00',
    hours: 'Lun–Sam 8h30–12h / 13h30–17h30',
    accepts: ['Encombrants', 'Gravats', 'Bois', 'Métaux', 'DEEE', 'Déchets dangereux', 'Végétaux', 'Papier/Carton'],
  },
  {
    id: 2, type: 'decheterie',
    name: 'Déchèterie de Sainte-Savine',
    address: "Rue de l'Égalité, 10300 Sainte-Savine",
    commune: 'Sainte-Savine',
    lat: 48.3028, lng: 3.9815,
    phone: '03 25 74 12 34',
    hours: 'Mar–Sam 9h–12h / 14h–17h',
    accepts: ['Encombrants', 'DEEE', 'Déchets verts', 'Cartons', 'Métaux'],
  },
  {
    id: 3, type: 'decheterie',
    name: 'Déchèterie de La Chapelle-Saint-Luc',
    address: 'Rue de la Vignette, 10600 La Chapelle-Saint-Luc',
    commune: 'La Chapelle-Saint-Luc',
    lat: 48.3158, lng: 4.0523,
    phone: '03 25 49 00 00',
    hours: 'Lun–Sam 8h30–12h / 13h30–17h30',
    accepts: ['Encombrants', 'DEEE', 'Déchets verts', 'Métaux', 'Plâtre'],
  },
  {
    id: 4, type: 'decheterie',
    name: 'Déchèterie de Romilly-sur-Seine',
    address: 'Route de Nogent, 10100 Romilly-sur-Seine',
    commune: 'Romilly-sur-Seine',
    lat: 48.5155, lng: 3.7265,
    phone: '03 25 24 50 00',
    hours: 'Mar–Sam 9h–12h / 13h30–17h',
    accepts: ['Encombrants', 'Gravats', 'DEEE', 'Déchets dangereux', 'Végétaux'],
  },
  {
    id: 5, type: 'decheterie',
    name: 'Déchèterie de Nogent-sur-Seine',
    address: 'Zone Industrielle, 10400 Nogent-sur-Seine',
    commune: 'Nogent-sur-Seine',
    lat: 48.4953, lng: 3.5072,
    phone: '03 25 39 80 00',
    hours: 'Mer–Sam 9h–12h / 14h–17h',
    accepts: ['Encombrants', 'Bois', 'Métaux', 'DEEE', 'Déchets verts'],
  },
  {
    id: 6, type: 'decheterie',
    name: 'Déchèterie de Bar-sur-Aube',
    address: 'Rue de la Verrerie, 10200 Bar-sur-Aube',
    commune: 'Bar-sur-Aube',
    lat: 48.2325, lng: 4.7055,
    phone: '03 25 27 04 00',
    hours: 'Lun Mer Ven Sam 9h–12h / 14h–17h',
    accepts: ['Encombrants', 'DEEE', 'Métaux', 'Déchets verts'],
  },
  {
    id: 7, type: 'decheterie',
    name: 'Déchèterie de Bar-sur-Seine',
    address: 'Route de Vendeuvre, 10110 Bar-sur-Seine',
    commune: 'Bar-sur-Seine',
    lat: 48.1115, lng: 4.3755,
    phone: '03 25 29 85 00',
    hours: 'Mar Jeu Sam 9h–12h / 14h–17h',
    accepts: ['Encombrants', 'DEEE', 'Métaux', 'Bois', 'Végétaux'],
  },
  {
    id: 22, type: 'decheterie',
    name: 'Déchèterie de Saint-Julien-les-Villas',
    address: 'Rue Prés Saint-Jean, 10800 Saint-Julien-les-Villas',
    commune: 'Saint-Julien-les-Villas',
    lat: 48.2645, lng: 4.0975,
    phone: '03 25 45 27 30',
    hours: 'Lun–Sam 8h30–12h / 15h–18h',
    accepts: ['Encombrants', 'Gravats', 'Bois', 'Métaux', 'DEEE', 'Déchets dangereux', 'Végétaux', 'Papier/Carton'],
  },

  /* ── BORNES À VERRE ── */
  {
    id: 8, type: 'verre',
    name: 'Borne à verre — Place du Maréchal Foch',
    address: 'Place du Maréchal Foch, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2963, lng: 4.0758,
    hours: 'Accessible 24h/24',
    accepts: ['Bouteilles en verre', 'Bocaux', 'Pots en verre (sans bouchons)'],
  },
  {
    id: 9, type: 'verre',
    name: 'Borne à verre — Parking E. Leclerc Nord',
    address: 'Route de Dijon, 10600 La Chapelle-Saint-Luc',
    commune: 'La Chapelle-Saint-Luc',
    lat: 48.3105, lng: 4.0760,
    hours: 'Accessible 24h/24',
    accepts: ['Bouteilles en verre', 'Bocaux', 'Pots en verre (sans bouchons)'],
  },
  {
    id: 10, type: 'verre',
    name: 'Borne à verre — Parking Cora',
    address: 'Avenue du Général de Gaulle, 10120 Saint-André-les-Vergers',
    commune: 'Saint-André-les-Vergers',
    lat: 48.2712, lng: 4.0560,
    hours: 'Accessible 24h/24',
    accepts: ['Bouteilles en verre', 'Bocaux', 'Pots en verre (sans bouchons)'],
  },
  {
    id: 11, type: 'verre',
    name: 'Borne à verre — Place de la Libération',
    address: 'Place de la Libération, 10100 Romilly-sur-Seine',
    commune: 'Romilly-sur-Seine',
    lat: 48.5142, lng: 3.7258,
    hours: 'Accessible 24h/24',
    accepts: ['Bouteilles en verre', 'Bocaux'],
  },
  {
    id: 12, type: 'verre',
    name: 'Borne à verre — Parking Intermarché',
    address: 'Rue du Général de Gaulle, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2940, lng: 4.0650,
    hours: 'Accessible 24h/24',
    accepts: ['Bouteilles en verre', 'Bocaux', 'Pots en verre (sans bouchons)'],
  },

  /* ── COMPOSTEURS COLLECTIFS ── */
  {
    id: 13, type: 'compost',
    name: 'Composteur collectif — Résidence les Sénardes',
    address: 'Résidence les Sénardes, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2895, lng: 4.0942,
    hours: 'Accessible 24h/24 (résidents et riverains)',
    accepts: ['Épluchures', 'Restes végétaux', 'Marc de café', 'Sachets de thé'],
  },
  {
    id: 14, type: 'compost',
    name: 'Composteur collectif — Square des Tilleuls',
    address: 'Square des Tilleuls, 10300 Sainte-Savine',
    commune: 'Sainte-Savine',
    lat: 48.3022, lng: 3.9862,
    hours: 'Accessible 24h/24',
    accepts: ['Épluchures', 'Restes végétaux', 'Tontes de gazon', 'Feuilles'],
  },
  {
    id: 15, type: 'compost',
    name: 'Composteur collectif — Jardin des Noues',
    address: 'Rue des Noues, 10600 La Chapelle-Saint-Luc',
    commune: 'La Chapelle-Saint-Luc',
    lat: 48.3138, lng: 4.0588,
    hours: 'Accessible 7h–21h',
    accepts: ['Épluchures', 'Tontes', 'Feuilles', 'Restes végétaux'],
  },

  /* ── POINTS TEXTILE ── */
  {
    id: 16, type: 'textile',
    name: 'Point textile — Le Relais (Leclerc La Chapelle)',
    address: 'Route de Dijon, 10600 La Chapelle-Saint-Luc',
    commune: 'La Chapelle-Saint-Luc',
    lat: 48.3115, lng: 4.0755,
    hours: 'Accessible 24h/24',
    accepts: ['Vêtements', 'Chaussures', 'Linge de maison', 'Sacs'],
  },
  {
    id: 17, type: 'textile',
    name: 'Emmaüs Troyes',
    address: 'Route de Pont-Sainte-Marie, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.3010, lng: 4.1020,
    phone: '03 25 73 38 18',
    hours: 'Lun–Sam 9h–12h / 14h–18h',
    accepts: ['Vêtements', 'Chaussures', 'Objets du quotidien', 'Mobilier', 'Livres'],
  },
  {
    id: 18, type: 'textile',
    name: 'Point textile — Parking Carrefour Saint-Julien',
    address: 'Boulevard du 1er R.A.M., 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2882, lng: 4.0990,
    hours: 'Accessible 24h/24',
    accepts: ['Vêtements', 'Chaussures', 'Linge de maison'],
  },

  /* ── POINTS PILES ── */
  {
    id: 19, type: 'piles',
    name: 'Point piles — Intermarché Troyes Centre',
    address: '5 Rue Voltaire, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2958, lng: 4.0742,
    hours: 'Lun–Sam 9h–20h',
    accepts: ['Piles alcalines', 'Piles rechargeables', 'Batteries portables'],
  },
  {
    id: 20, type: 'piles',
    name: 'Point piles — Pharmacie Place Saint-Jean',
    address: 'Place Saint-Jean, 10000 Troyes',
    commune: 'Troyes',
    lat: 48.2972, lng: 4.0759,
    hours: 'Lun–Sam 9h–19h',
    accepts: ['Piles', 'Médicaments périmés (Cyclamed)'],
  },
  {
    id: 21, type: 'piles',
    name: 'Point piles — E. Leclerc La Chapelle',
    address: 'Route de Dijon, 10600 La Chapelle-Saint-Luc',
    commune: 'La Chapelle-Saint-Luc',
    lat: 48.3120, lng: 4.0748,
    hours: 'Lun–Sam 9h–20h / Dim 9h–13h',
    accepts: ['Piles', 'Batteries', 'Accumulateurs'],
  },
];

/* ──────────────────────────────────────────────────
   CONFIG TYPES (couleurs, labels, icônes)
────────────────────────────────────────────────── */
const typeConfig = {
  decheterie: { color: '#c0392b', label: 'Déchèterie',  icon: '🏭', cssClass: 'cm-decheterie' },
  verre:      { color: '#2980b9', label: 'Borne à verre', icon: '🫙', cssClass: 'cm-verre'      },
  compost:    { color: '#27ae60', label: 'Composteur',   icon: '🌿', cssClass: 'cm-compost'    },
  textile:    { color: '#8e44ad', label: 'Textile',      icon: '👕', cssClass: 'cm-textile'    },
  piles:      { color: '#e67e22', label: 'Piles',        icon: '🔋', cssClass: 'cm-piles'      },
};

/* ──────────────────────────────────────────────────
   CARTE LEAFLET
────────────────────────────────────────────────── */
let map, clusterGroup;
let activeFilter  = 'all';
let leafletMarkers = [];  // { point, marker, li }

/**
 * Crée une icône personnalisée (marqueur pin coloré)
 */
function makeIcon(type) {
  const cfg = typeConfig[type];
  return L.divIcon({
    className: '',
    iconSize:  [36, 36],
    iconAnchor:[18, 36],
    popupAnchor:[0, -38],
    html: `
      <div class="custom-marker ${cfg.cssClass}"
           style="width:36px;height:36px;border-radius:50% 50% 50% 0;
                  transform:rotate(-45deg);display:flex;align-items:center;
                  justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.25);
                  border:2.5px solid rgba(255,255,255,.9);background:${cfg.color}">
        <span style="transform:rotate(45deg);font-size:16px;line-height:1">${cfg.icon}</span>
      </div>`,
  });
}

/**
 * Génère le HTML de la popup Leaflet
 */
function buildPopupHTML(p) {
  const cfg  = typeConfig[p.type];
  const tags = p.accepts.map(a => `<span class="lf-popup-tag">${a}</span>`).join('');
  const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const phone = p.phone ? `<div class="lf-popup-hours">📞 ${p.phone}</div>` : '';
  return `
    <div class="lf-popup">
      <div class="lf-popup-type" style="color:${cfg.color}">${cfg.icon} ${cfg.label}</div>
      <div class="lf-popup-name">${p.name}</div>
      <div class="lf-popup-addr">📍 ${p.address}</div>
      <div class="lf-popup-hours">🕐 ${p.hours}</div>
      ${phone}
      <hr class="lf-popup-divider"/>
      <div class="lf-popup-accepts-label">Accepte</div>
      <div class="lf-popup-tags">${tags}</div>
      <a class="lf-popup-maps-link" href="${gmUrl}" target="_blank" rel="noopener noreferrer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Itinéraire Google Maps
      </a>
    </div>`;
}

/**
 * Initialise la carte Leaflet
 */
function initMap() {
  // Centre sur Troyes (chef-lieu de l'Aube)
  map = L.map('map', {
    center: [48.2973, 4.0744],
    zoom: 10,
    zoomControl: true,
  });

  // Tuiles OpenStreetMap (libres, sans clé API)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Groupe de clusters
  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    iconCreateFunction: (cluster) => L.divIcon({
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      html: `<div style="
        width:40px;height:40px;border-radius:50%;background:#1B4D3E;
        color:#fff;display:flex;align-items:center;justify-content:center;
        font-family:'Inter',sans-serif;font-weight:900;font-size:14px;
        box-shadow:0 4px 14px rgba(27,77,62,.35);border:2px solid rgba(255,255,255,.8)">
        ${cluster.getChildCount()}</div>`,
    }),
  });

  // Créer les marqueurs
  collectPoints.forEach((p) => {
    const marker = L.marker([p.lat, p.lng], { icon: makeIcon(p.type) });
    marker.bindPopup(buildPopupHTML(p), { maxWidth: 320, className: 'lf-popup-wrap' });

    // Clic → mettre en évidence dans la sidebar
    marker.on('click', () => highlightSidebarItem(p.id));

    clusterGroup.addLayer(marker);
    leafletMarkers.push({ point: p, marker });
  });

  map.addLayer(clusterGroup);

  // Construire la sidebar
  buildSidebar(collectPoints);
}

/* ──────────────────────────────────────────────────
   SIDEBAR
────────────────────────────────────────────────── */
const sidebarList  = document.getElementById('sidebarList');
const sidebarCount = document.getElementById('sidebarCount');
const sidebarEl    = document.getElementById('mapSidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const sidebarCloseBtn  = document.getElementById('sidebarClose');

function buildSidebar(points) {
  sidebarList.innerHTML = '';
  sidebarCount.textContent = `${points.length} point${points.length > 1 ? 's' : ''}`;

  points.forEach((p) => {
    const cfg = typeConfig[p.type];
    const li  = document.createElement('li');
    li.className = 'sidebar-item';
    li.dataset.id = p.id;
    li.innerHTML = `
      <span class="si-dot" style="background:${cfg.color}"></span>
      <div>
        <div class="si-name">${p.name.replace(/^.+?—\s*/, '')}</div>
        <div class="si-commune">${cfg.label} · ${p.commune}</div>
      </div>`;
    li.addEventListener('click', () => {
      flyToPoint(p);
      // Sur mobile : fermer la sidebar après le clic
      if (window.innerWidth <= 700) sidebarEl.classList.remove('mobile-open');
    });
    sidebarList.appendChild(li);

    // Garder la référence pour le surlignage
    const found = leafletMarkers.find(m => m.point.id === p.id);
    if (found) found.li = li;
  });
}

function highlightSidebarItem(id) {
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const li = document.querySelector(`.sidebar-item[data-id="${id}"]`);
  if (li) { li.classList.add('active'); li.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function flyToPoint(p) {
  if (!map) return;
  map.flyTo([p.lat, p.lng], 16, { duration: 1 });
  const found = leafletMarkers.find(m => m.point.id === p.id);
  if (found) {
    setTimeout(() => {
      found.marker.openPopup();
      highlightSidebarItem(p.id);
    }, 900);
  }
}

// Toggle sidebar (desktop)
sidebarToggleBtn.addEventListener('click', () => {
  if (window.innerWidth > 700) {
    sidebarEl.classList.toggle('collapsed');
  } else {
    sidebarEl.classList.toggle('mobile-open');
  }
  setTimeout(() => map.invalidateSize(), 320);
});

sidebarCloseBtn.addEventListener('click', () => {
  if (window.innerWidth > 700) {
    sidebarEl.classList.add('collapsed');
  } else {
    sidebarEl.classList.remove('mobile-open');
  }
  setTimeout(() => map.invalidateSize(), 320);
});

/* ──────────────────────────────────────────────────
   FILTRES CARTE
────────────────────────────────────────────────── */
const filterBtns = document.querySelectorAll('.map-filter-btn');

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.type;
    applyFilter();
  });
});

function applyFilter() {
  if (!clusterGroup) return;
  const query    = document.getElementById('mapSearchInput').value.trim().toLowerCase();
  const filtered = collectPoints.filter((p) => {
    const matchType    = activeFilter === 'all' || p.type === activeFilter;
    const matchCommune = !query || p.commune.toLowerCase().includes(query) || p.name.toLowerCase().includes(query);
    return matchType && matchCommune;
  });

  // Mettre à jour les marqueurs
  clusterGroup.clearLayers();
  leafletMarkers.forEach(({ point, marker }) => {
    if (filtered.find(p => p.id === point.id)) clusterGroup.addLayer(marker);
  });

  // Mettre à jour la sidebar
  buildSidebar(filtered);

  // Mettre à jour les compteurs dans les boutons de filtre
  updateFilterCounts(query);
}

/**
 * Met à jour les badges de comptage sur chaque bouton filtre
 * @param {string} query — texte de recherche commune actif
 */
function updateFilterCounts(query) {
  const types = ['all', 'decheterie', 'verre', 'compost', 'textile', 'piles'];
  types.forEach((t) => {
    const count = collectPoints.filter((p) => {
      const matchType    = t === 'all' || p.type === t;
      const matchCommune = !query || p.commune.toLowerCase().includes(query) || p.name.toLowerCase().includes(query);
      return matchType && matchCommune;
    }).length;
    const el = document.getElementById(`count-${t}`);
    if (el) el.textContent = count;
  });
}

/* ──────────────────────────────────────────────────
   RECHERCHE PAR COMMUNE
────────────────────────────────────────────────── */
document.getElementById('mapSearchInput').addEventListener('input', applyFilter);

/* ──────────────────────────────────────────────────
   GÉOLOCALISATION
────────────────────────────────────────────────── */
document.getElementById('mapLocateBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas disponible dans ce navigateur.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.flyTo([lat, lng], 14, { duration: 1.2 });

      // Marqueur position utilisateur
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: `<div style="width:20px;height:20px;border-radius:50%;background:#3498db;
                             border:3px solid #fff;box-shadow:0 2px 8px rgba(52,152,219,.5)"></div>`,
        }),
      })
        .addTo(map)
        .bindPopup('<strong>Vous êtes ici</strong>')
        .openPopup();
    },
    () => alert("Impossible d'obtenir votre position. Vérifiez les autorisations."),
    { enableHighAccuracy: true, timeout: 8000 }
  );
});

/* ──────────────────────────────────────────────────
   UTILITAIRE NORMALIZE (assistant de tri)
────────────────────────────────────────────────── */
function normalize(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchWaste(query) {
  const q = normalize(query);
  if (!q) return null;
  for (const item of wasteDatabase) {
    for (const keyword of item.keywords) {
      if (normalize(keyword).includes(q) || q.includes(normalize(keyword))) return item;
    }
  }
  return null;
}

/* ──────────────────────────────────────────────────
   ASSISTANT DE TRI
────────────────────────────────────────────────── */
const searchInput = document.getElementById('searchInput');
const searchBtn   = document.getElementById('searchBtn');
const resultBox   = document.getElementById('assistantResult');
const quickBtns   = document.querySelectorAll('.quick-btn');

function displayResult(query) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const item = searchWaste(trimmed);
  if (item) {
    resultBox.innerHTML = `
      <div class="result-card">
        <div class="result-category">${item.category}</div>
        <div class="result-destination">${item.destination}</div>
        <p class="result-conseil">${item.conseil}</p>
        <div class="result-impact">${item.impact}</div>
      </div>`;
  } else {
    resultBox.innerHTML = `
      <p class="result-not-found">
        🤔 Je n'ai pas encore de réponse pour "<strong>${trimmed}</strong>".<br>
        Ce projet prévoit une base locale enrichie progressivement avec l'aide des habitants et des collectivités de l'Aube.
      </p>`;
  }
}

searchBtn.addEventListener('click', () => displayResult(searchInput.value));
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') displayResult(searchInput.value); });
quickBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    searchInput.value = btn.dataset.query;
    displayResult(btn.dataset.query);
  });
});

/* ──────────────────────────────────────────────────
   COMPTEURS KPI (count-up animation)
   TODO: Remplacer par des données réelles depuis Supabase/Firebase
────────────────────────────────────────────────── */
function animateCounter(el, target, duration = 1600) {
  const startTime = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString('fr-FR');
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const kpiObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      animateCounter(entry.target, parseInt(entry.target.dataset.target, 10));
      kpiObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('.kpi-value').forEach(el => kpiObserver.observe(el));

/* ──────────────────────────────────────────────────
   NAVBAR — scroll + menu burger
────────────────────────────────────────────────── */
const navbar    = document.getElementById('navbar');
const navBurger = document.getElementById('navBurger');
const navLinks  = document.getElementById('navLinks');
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  backToTop.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

navBurger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  navBurger.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => navLinks.classList.remove('open')));

/* ──────────────────────────────────────────────────
   RETOUR EN HAUT
────────────────────────────────────────────────── */
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ──────────────────────────────────────────────────
   THÈME CLAIR / SOMBRE
────────────────────────────────────────────────── */
const themeToggle = document.getElementById('themeToggle');
const html        = document.documentElement;

if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  html.setAttribute('data-theme', 'dark');
  themeToggle.textContent = '☀️';
}
const savedTheme = localStorage.getItem('ecolo-theme');
if (savedTheme) {
  html.setAttribute('data-theme', savedTheme);
  themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', () => {
  const isDark   = html.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('ecolo-theme', newTheme);
});

/* ──────────────────────────────────────────────────
   FORMULAIRE DE CONTACT (démo)
   TODO: Connecter à un service backend (EmailJS, Formspree, Supabase)
────────────────────────────────────────────────── */
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name  = contactForm.name.value.trim();
  const email = contactForm.email.value.trim();
  const msg   = contactForm.message.value.trim();
  if (!name || !email || !msg) { alert('Merci de remplir tous les champs.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Adresse email invalide."); return; }
  contactForm.style.opacity = '0.5';
  contactForm.style.pointerEvents = 'none';
  setTimeout(() => { contactForm.hidden = true; formSuccess.hidden = false; }, 800);
});

/* ──────────────────────────────────────────────────
   ANIMATIONS AU DÉFILEMENT (fade-up)
────────────────────────────────────────────────── */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.fade-up').forEach((el) => {
  el.style.animationPlayState = 'paused';
  fadeObserver.observe(el);
});

/* ──────────────────────────────────────────────────
   DÉMARRAGE
────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  // Force le recalcul des dimensions après le premier rendu
  setTimeout(() => map && map.invalidateSize(), 300);
});
