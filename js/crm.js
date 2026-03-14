(function(){
  const api = window.fw || {};
  const { $, getUser } = api;
  const root = document.getElementById("crmRoot");
  const page = document.body?.dataset?.crmPage || "";
  if(!root || !$ || !page) return;

  const sb = (window.fwSupabase?.enabled && window.fwSupabase?.client) ? window.fwSupabase.client : null;
  const STORAGE_BUCKET = String(window.FW_ENV?.SUPABASE_BUCKET || "facework").trim() || "facework";
  const PARAMS = new URLSearchParams(window.location.search);
  let APP_COMPANY = String(getUser()?.company || window.fwSupabase?.companyDefault || "Entreprise").trim() || "Entreprise";
  const DEFAULT_CRM_LOGO_URL = new URL("../assets/favicon_DS.png", window.location.href).href;
  const NOW = ()=> new Date().toISOString();
  const TODAY = ()=> new Date().toISOString().slice(0, 10);

  const DEFAULT_SETTINGS = {
    company: APP_COMPANY,
    trade_name: "",
    legal_name: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "France",
    email: "",
    phone: "",
    siret: "",
    default_vat_rate: 0,
    vat_note: "TVA non applicable, article 293 B du CGI",
    currency: "EUR",
    payment_terms_default: "Paiement a 30 jours date de facture.",
    quote_validity_days: 30,
    default_notes: "",
    late_penalties: "Penalites de retard exigibles sans rappel : taux legal en vigueur majore.",
    recovery_indemnity: "Indemnite forfaitaire pour frais de recouvrement : 40 EUR pour les clients professionnels.",
    numbering_quote_prefix: "DEV",
    numbering_invoice_prefix: "FAC",
    numbering_padding: 3,
    primary_color: "#111111",
    logo_url: "",
    logo_storage_path: "",
    social_instagram_url: "https://www.instagram.com/mouket10/",
    social_facebook_url: "https://www.facebook.com/alexis.guillotin.3",
    social_linkedin_url: "https://www.linkedin.com/in/alexis-guillotin-9a2aa3b5/",
    social_whatsapp_url: "https://wa.me/33767033408",
    business_type: "micro",
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    clients: [],
    quotes: [],
    invoices: [],
    quoteForm: null,
    invoiceForm: null,
    listFilters: {
      search: "",
      status: "",
      clientId: "",
    },
  };

  const CLIENT_EXAMPLES = Object.freeze([
    {
      id: "business-studio",
      label: "Entreprise creative",
      description: "Studio ou agence qui commande un site, une landing page ou un accompagnement.",
      payload: {
        kind: "business",
        display_name: "Studio Horizon",
        first_name: "Claire",
        last_name: "Durand",
        company_name: "Studio Horizon",
        email: "hello@studio-horizon.fr",
        phone: "+33 1 80 00 00 00",
        client_siret: "80123456700017",
        address_line1: "48 avenue des Createurs",
        address_line2: "Batiment B - Bureau 12",
        postal_code: "69002",
        city: "Lyon",
        country: "France",
        notes: "Contact principal : Claire Durand. Validation des devis sous 72 h.",
      },
    },
    {
      id: "person-coach",
      label: "Independant",
      description: "Coach, consultante ou freelance facturee en nom propre.",
      payload: {
        kind: "person",
        display_name: "Marie-Madeleine Gautier",
        first_name: "Marie-Madeleine",
        last_name: "Gautier",
        company_name: "",
        email: "contact@marie-madeleine.fr",
        phone: "+33 6 11 22 33 44",
        client_siret: "",
        address_line1: "12 rue des Creatifs",
        address_line2: "",
        postal_code: "75011",
        city: "Paris",
        country: "France",
        notes: "Activite independante. Echanges rapides par email et WhatsApp.",
      },
    },
  ]);

  const QUOTE_EXAMPLES = Object.freeze([
    {
      id: "site-vitrine",
      label: "Site vitrine",
      description: "Ideal pour un devis de creation de site premium avec acompte et mise en ligne.",
      payload: {
        client_example_id: "business-studio",
        title: "Creation d'un site vitrine premium",
        discount_type: "none",
        discount_value: 0,
        deposit_amount: 680,
        payment_terms: "Acompte de 40% a la commande, solde a la mise en ligne.",
        notes: "Delai estime : 4 semaines. Deux cycles de retours inclus. Formation de prise en main comprise.",
        items: [
          { title: "Audit et arborescence", description: "Analyse de l'existant, objectifs, structure des pages et contenus attendus.", quantity: 1, unit_price: 340 },
          { title: "Design sur-mesure", description: "Direction artistique, maquette desktop/mobile et ajustements avant integration.", quantity: 1, unit_price: 890 },
          { title: "Integration du site", description: "Developpement responsive, animations legeres, formulaire de contact et optimisations.", quantity: 1, unit_price: 1470 },
          { title: "SEO de lancement", description: "Balises, vitesse, indexation et check technique avant mise en ligne.", quantity: 1, unit_price: 240 },
        ],
      },
    },
    {
      id: "social-media",
      label: "Communication mensuelle",
      description: "Modele pratique pour une mission de contenu, calendrier editorial et publication.",
      payload: {
        client_example_id: "business-studio",
        title: "Accompagnement communication digitale mensuelle",
        discount_type: "percent",
        discount_value: 10,
        deposit_amount: 0,
        payment_terms: "Paiement a reception par virement bancaire, avant le 5 du mois suivant.",
        notes: "Calendrier editorial valide en debut de mois. Fichiers sources fournis. Reporting simplifie inclus.",
        items: [
          { title: "Strategie editoriale", description: "Preparation du planning, angles de contenus et repartition des formats.", quantity: 1, unit_price: 220 },
          { title: "Creation de 12 contenus", description: "Textes, visuels ou carrousels prets a publier sur Instagram, Facebook ou LinkedIn.", quantity: 1, unit_price: 540 },
          { title: "Programmation et suivi", description: "Mise en ligne, ajustements et retour synthese sur la performance du mois.", quantity: 1, unit_price: 180 },
        ],
      },
    },
    {
      id: "audit-coaching",
      label: "Audit + atelier",
      description: "Exemple simple pour une mission courte de cadrage, conseil et feuille de route.",
      payload: {
        client_example_id: "person-coach",
        title: "Audit digital et atelier de cadrage",
        discount_type: "none",
        discount_value: 0,
        deposit_amount: 250,
        payment_terms: "Acompte de 250 EUR a la reservation, solde a la livraison du plan d'action.",
        notes: "Livrable remis sous 5 jours ouvres apres l'atelier. Priorites, quick wins et recommandations incluses.",
        items: [
          { title: "Audit complet", description: "Analyse du site, de la proposition de valeur, du parcours et des points de friction.", quantity: 1, unit_price: 420 },
          { title: "Atelier de cadrage (3h)", description: "Session de travail, tri des priorites et clarification des actions a lancer.", quantity: 1, unit_price: 330 },
          { title: "Feuille de route 30 jours", description: "Plan d'action concret avec priorites, messages cles et prochaines etapes.", quantity: 1, unit_price: 190 },
        ],
      },
    },
  ]);

  const INVOICE_EXAMPLES = Object.freeze([
    {
      id: "monthly-service",
      label: "Mensualite envoyee",
      description: "Facture de prestation recurrente sans paiement encore recu.",
      payload: {
        client_example_id: "business-studio",
        title: "Maintenance et communication mensuelle",
        status: "sent",
        due_in_days: 15,
        discount_type: "none",
        discount_value: 0,
        deposit_amount: 0,
        payment_terms: "Paiement a reception par virement, au plus tard sous 15 jours.",
        notes: "Prestation du mois en cours. Merci d'indiquer la reference de facture dans le libelle du virement.",
        items: [
          { title: "Maintenance technique", description: "Mises a jour, sauvegardes, surveillance et support prioritaire.", quantity: 1, unit_price: 260 },
          { title: "Animation reseaux sociaux", description: "Preparation, design et programmation de 8 contenus mensuels.", quantity: 1, unit_price: 420 },
        ],
        payments: [],
      },
    },
    {
      id: "project-partial",
      label: "Projet avec acompte",
      description: "Facture avec premier reglement deja enregistre et solde restant du.",
      payload: {
        client_example_id: "business-studio",
        title: "Facture intermediaire - creation site vitrine",
        status: "sent",
        due_in_days: 7,
        discount_type: "none",
        discount_value: 0,
        deposit_amount: 780,
        payment_terms: "Acompte deja recu. Solde payable a reception par virement bancaire.",
        notes: "Le solde correspond a la mise en ligne et aux derniers ajustements valides.",
        items: [
          { title: "Conception UX/UI", description: "Maquettes desktop/mobile et validation du parcours utilisateur.", quantity: 1, unit_price: 960 },
          { title: "Developpement et integration", description: "Integration responsive, contenus, formulaires et optimisations.", quantity: 1, unit_price: 1240 },
        ],
        payments: [
          { amount: 780, paid_at: TODAY(), method: "virement", reference: "ACOMPTE-SITE-2026", notes: "Acompte verse a la commande." },
        ],
      },
    },
    {
      id: "workshop-paid",
      label: "Atelier regle",
      description: "Exemple simple de facture totalement payee avec preuve de reglement.",
      payload: {
        client_example_id: "person-coach",
        title: "Atelier de cadrage digital",
        status: "paid",
        due_in_days: 0,
        discount_type: "none",
        discount_value: 0,
        deposit_amount: 0,
        payment_terms: "Reglement a reception.",
        notes: "Facture acquittee. Support de synthese envoye au client apres l'atelier.",
        items: [
          { title: "Animation atelier (3h)", description: "Session de cadrage, priorisation et recommandations actionnables.", quantity: 1, unit_price: 390 },
          { title: "Compte rendu et plan d'action", description: "Restitution ecrite avec quick wins et prochaines etapes.", quantity: 1, unit_price: 160 },
        ],
        payments: [
          { amount: 550, paid_at: TODAY(), method: "virement", reference: "REG-ATELIER-2026", notes: "Facture soldee." },
        ],
      },
    },
  ]);

  function toast(title, desc){
    window.fwToast?.(title, desc || "");
  }

  function setLoading(message){
    root.innerHTML = `<section class="crm-panel"><div class="crm-kicker">Chargement</div><h1 class="crm-title">${escapeHtml(message || "Chargement...")}</h1><p class="crm-muted">Preparation de l'espace CRM.</p></section>`;
  }

  function showFatal(err){
    console.error("[CRM]", err);
    const msg = errorMessage(err);
    root.innerHTML = `<section class="crm-panel"><div class="crm-kicker">Erreur</div><h1 class="crm-title">Impossible d'ouvrir le CRM</h1><p class="crm-muted">${escapeHtml(msg)}</p><div class="crm-actions"><a class="btn primary" href="crm-dashboard.html">Retour au tableau de bord</a></div></section>`;
    toast("CRM", msg);
  }

  function runAction(label, fn){
    return async (...args)=>{
      try{
        await fn(...args);
      }catch(error){
        console.error("[CRM action]", {
          label,
          code: error?.code || "",
          message: error?.message || String(error || ""),
          details: error?.details || null,
          hint: error?.hint || null,
          error,
        });
        toast(label, errorMessage(error));
      }
    };
  }

  function errorMessage(error){
    const code = String(error?.code || "").trim();
    const msg = String(error?.message || error?.error_description || error || "Erreur CRM").trim();
    if(code === "42P01" || /crm_/i.test(msg) && /does not exist|relation/i.test(msg)){
      return "Applique d'abord le fichier supabase/crm.sql dans Supabase SQL Editor.";
    }
    if(code === "PGRST116"){
      return "Aucune donnee CRM trouvee. Commence par remplir les parametres ou importer les exemples.";
    }
    if(code === "P0001" || /^(forbidden|not_authenticated|profile_missing|invalid_company|quote_not_found|invoice_not_found)$/i.test(msg)){
      if(/^forbidden$/i.test(msg)){
        return "Le CRM Supabase est reserve aux admins. Verifie la colonne `profiles.role` pour cet utilisateur.";
      }
      if(/^not_authenticated$/i.test(msg)){
        return "Session Supabase absente ou expiree. Reconnecte-toi puis recharge le CRM.";
      }
      if(/^profile_missing$/i.test(msg)){
        return "Profil Supabase introuvable pour cet utilisateur. Reconnecte-toi pour resynchroniser le profil.";
      }
      if(/^invalid_company$/i.test(msg)){
        return "L'entreprise du document ne correspond pas au profil Supabase courant.";
      }
      if(/^quote_not_found$/i.test(msg)){
        return "Le devis cible est introuvable dans Supabase.";
      }
      if(/^invoice_not_found$/i.test(msg)){
        return "La facture cible est introuvable dans Supabase.";
      }
    }
    if(code === "22P02"){
      return "Un identifiant CRM est invalide. Recharge la page puis reselectionne le client ou le document.";
    }
    if(code === "23503"){
      return "Le client ou le document lie n'existe pas dans Supabase. Recharge les donnees puis reessaie.";
    }
    if(code === "42501" || /row-level security|permission denied/i.test(msg)){
      return "Acces CRM refuse par Supabase. Verifie la session active et les policies RLS.";
    }
    return msg || "Erreur CRM";
  }

  function currentAppCompany(){
    return String(getUser()?.company || window.fwSupabase?.companyDefault || "Entreprise").trim() || "Entreprise";
  }

  function isAdminUser(user){
    return String(user?.role || "").trim().toLowerCase() === "admin";
  }

  function authRedirectHref(){
    const p = window.location.pathname || "";
    const inSubdir =
      p.includes("/app/") ||
      p.includes("/guides/") ||
      p.includes("/tutos/") ||
      p.includes("/exercices/") ||
      p.includes("/langages/");
    return inSubdir ? "../login.html" : "login.html";
  }

  function adminFallbackHref(){
    const p = window.location.pathname || "";
    const inSubdir =
      p.includes("/app/") ||
      p.includes("/guides/") ||
      p.includes("/tutos/") ||
      p.includes("/exercices/") ||
      p.includes("/langages/");
    return inSubdir ? "../app/feed.html" : "app/feed.html";
  }

  function applyCompanyContext(){
    APP_COMPANY = currentAppCompany();
    DEFAULT_SETTINGS.company = APP_COMPANY;
    state.settings.company = APP_COMPANY;
  }

  async function ensureCrmAccess(){
    if(!sb){
      applyCompanyContext();
      return true;
    }

    const ok = await window.fwSupabase?.requireAuth?.({ redirectTo: authRedirectHref() });
    if(!ok) return false;

    applyCompanyContext();

    if(!isAdminUser(getUser())){
      window.location.href = adminFallbackHref();
      return false;
    }
    return true;
  }

  function safeNumber(value){
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function roundMoney(value){
    return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function parseDate(dateStr){
    const s = String(dateStr || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : TODAY();
  }

  function addDays(dateStr, days){
    const d = new Date(parseDate(dateStr));
    d.setDate(d.getDate() + Number(days || 0));
    return d.toISOString().slice(0, 10);
  }

  function fmtDate(dateStr){
    const s = String(dateStr || "").trim();
    if(!s) return "-";
    const d = new Date(`${s}T00:00:00`);
    if(Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d);
  }

  function fmtDateTime(dateStr){
    const s = String(dateStr || "").trim();
    if(!s) return "-";
    const d = new Date(s);
    if(Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d);
  }

  function fmtMoney(value, currency){
    const code = String(currency || state.settings?.currency || "EUR").toUpperCase();
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(roundMoney(value));
  }

  function slugify(value){
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  function escapeHtml(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function uuid(){
    if(window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function initials(text){
    return String(text || "FW")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part)=> part.charAt(0).toUpperCase())
      .join("") || "FW";
  }

  function clientDisplayName(client){
    if(!client) return "";
    return String(client.display_name || "").trim()
      || String(client.company_name || "").trim()
      || `${String(client.first_name || "").trim()} ${String(client.last_name || "").trim()}`.trim()
      || "Client";
  }

  function companyDisplayName(settings){
    return String(settings?.trade_name || settings?.legal_name || APP_COMPANY).trim() || APP_COMPANY;
  }

  function effectiveLogoUrl(settings){
    const raw = String(settings?.logo_url || "").trim();
    return raw || DEFAULT_CRM_LOGO_URL;
  }

  function clientAddress(client){
    return [
      client?.address_line1 || "",
      client?.address_line2 || "",
      [client?.postal_code || "", client?.city || ""].filter(Boolean).join(" "),
      client?.country || "",
    ].filter(Boolean).join("\n");
  }

  function clientExampleCardsHtml(){
    return CLIENT_EXAMPLES.map((example)=> `
      <article class="crm-example-card">
        <div class="crm-pill">${escapeHtml(example.label)}</div>
        <strong>${escapeHtml(example.payload.display_name)}</strong>
        <p>${escapeHtml(example.description)}</p>
        <button class="btn crm-btn-quiet" type="button" data-client-example="${escapeHtml(example.id)}">Utiliser cet exemple</button>
      </article>
    `).join("");
  }

  function quoteExampleCardsHtml(){
    return QUOTE_EXAMPLES.map((example)=> {
      const subtotal = roundMoney((example.payload.items || []).reduce((sum, item)=> sum + roundMoney(item.quantity * item.unit_price), 0));
      const tags = (example.payload.items || []).map((item)=> `<span>${escapeHtml(item.title)}</span>`).join("");
      return `
        <article class="crm-example-card">
          <div class="crm-inline" style="justify-content:space-between">
            <div class="crm-pill">${escapeHtml(example.label)}</div>
            <div class="crm-example-amount">${escapeHtml(fmtMoney(subtotal, state.settings.currency))}</div>
          </div>
          <strong>${escapeHtml(example.payload.title)}</strong>
          <p>${escapeHtml(example.description)}</p>
          <div class="crm-example-tags">${tags}</div>
          <div class="crm-example-actions">
            <button class="btn crm-btn-quiet" type="button" data-quote-example="${escapeHtml(example.id)}">Appliquer</button>
            <button class="btn crm-btn-quiet" type="button" data-quote-example-client="${escapeHtml(example.id)}">Client + exemple</button>
            <button class="btn primary" type="button" data-quote-example-pdf="${escapeHtml(example.id)}">Client + PDF</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function invoiceExampleCardsHtml(){
    return INVOICE_EXAMPLES.map((example)=> {
      const subtotal = roundMoney((example.payload.items || []).reduce((sum, item)=> sum + roundMoney(item.quantity * item.unit_price), 0));
      const paymentTotal = roundMoney((example.payload.payments || []).reduce((sum, payment)=> sum + roundMoney(payment.amount || 0), 0));
      const tags = (example.payload.items || []).map((item)=> `<span>${escapeHtml(item.title)}</span>`).join("");
      return `
        <article class="crm-example-card">
          <div class="crm-inline" style="justify-content:space-between">
            <div class="crm-pill">${escapeHtml(example.label)}</div>
            <div class="crm-example-amount">${escapeHtml(fmtMoney(subtotal, state.settings.currency))}</div>
          </div>
          <strong>${escapeHtml(example.payload.title)}</strong>
          <p>${escapeHtml(example.description)}</p>
          <div class="crm-example-tags">${tags}<span>Echeance: J+${escapeHtml(example.payload.due_in_days || 0)}</span><span>Paiements: ${escapeHtml(fmtMoney(paymentTotal, state.settings.currency))}</span></div>
          <div class="crm-example-actions">
            <button class="btn crm-btn-quiet" type="button" data-invoice-example="${escapeHtml(example.id)}">Appliquer</button>
            <button class="btn crm-btn-quiet" type="button" data-invoice-example-client="${escapeHtml(example.id)}">Client + exemple</button>
            <button class="btn primary" type="button" data-invoice-example-pdf="${escapeHtml(example.id)}">Client + PDF</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function setFieldValue(field, value){
    if(!field) return;
    if(field.type === "checkbox"){
      field.checked = !!value;
      return;
    }
    field.value = value == null ? "" : String(value);
  }

  function applyFormValues(form, values){
    if(!form || !values || typeof values !== "object") return;
    Object.entries(values).forEach(([name, value])=>{
      setFieldValue(form.querySelector(`[name="${name}"]`), value);
    });
  }

  function applyClientExample(form, exampleId){
    const example = CLIENT_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example || !form) return;
    applyFormValues(form, example.payload);
    form.querySelector("[name='display_name']")?.focus();
  }

  function findClientFromExample(exampleId){
    const example = CLIENT_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) return null;
    const email = String(example.payload.email || "").trim().toLowerCase();
    const display = slugify(example.payload.display_name || "");
    const companyName = slugify(example.payload.company_name || "");
    return state.clients.find((client)=> {
      const clientEmail = String(client.email || "").trim().toLowerCase();
      if(email && clientEmail === email) return true;
      if(display && slugify(clientDisplayName(client)) === display) return true;
      if(companyName && slugify(client.company_name || "") === companyName) return true;
      return false;
    }) || null;
  }

  async function ensureClientFromExample(exampleId){
    const example = CLIENT_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) throw new Error("Exemple client introuvable.");
    const existing = findClientFromExample(exampleId);
    if(existing) return existing;
    const saved = await repo.saveClient(example.payload);
    state.clients = await repo.listClients();
    return state.clients.find((client)=> client.id === saved.id) || saved;
  }

  function applyQuoteExample(exampleId){
    const example = QUOTE_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) return;
    const current = collectQuoteFormData();
    state.quoteForm = computeQuote({
      ...current,
      title: example.payload.title,
      discount_type: example.payload.discount_type,
      discount_value: example.payload.discount_value,
      deposit_amount: example.payload.deposit_amount,
      vat_rate: roundMoney(current.vat_rate ?? state.settings.default_vat_rate ?? 0),
      payment_terms: example.payload.payment_terms,
      notes: example.payload.notes,
      accepted: false,
      accepted_name: "",
      accepted_signature: "",
      accepted_at: "",
      items: (example.payload.items || []).map((item, index)=> normalizeItem(item, index)),
    });
    renderQuoteEditorPage();
    toast("Devis", `${example.label} pre-rempli. Ajuste les champs si besoin.`);
  }

  async function applyQuoteExampleWithClient(exampleId, options = {}){
    const example = QUOTE_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) return null;
    const client = await ensureClientFromExample(example.payload.client_example_id || "");
    const current = collectQuoteFormData();
    state.quoteForm = computeQuote({
      ...current,
      client_id: client.id,
      client,
      title: example.payload.title,
      discount_type: example.payload.discount_type,
      discount_value: example.payload.discount_value,
      deposit_amount: example.payload.deposit_amount,
      vat_rate: roundMoney(current.vat_rate ?? state.settings.default_vat_rate ?? 0),
      payment_terms: example.payload.payment_terms,
      notes: example.payload.notes,
      accepted: false,
      accepted_name: "",
      accepted_signature: "",
      accepted_at: "",
      items: (example.payload.items || []).map((item, index)=> normalizeItem(item, index)),
    });

    if(!options?.generatePdf){
      renderQuoteEditorPage();
      toast("Devis", `${example.label} et client exemple pre-remplis.`);
      return state.quoteForm;
    }

    const saved = await repo.saveQuote({ ...state.quoteForm, status: "draft" });
    state.quoteForm = await generatePdf("quote", saved, { print: false });
    state.quotes = await repo.listQuotes();
    renderQuoteEditorPage();
    toast("PDF", `Devis ${example.label.toLowerCase()} genere avec son client exemple.`);
    return state.quoteForm;
  }

  function applyInvoiceExample(exampleId){
    const example = INVOICE_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) return;
    const current = collectInvoiceFormData();
    state.invoiceForm = computeInvoice({
      ...current,
      title: example.payload.title,
      status: example.payload.status,
      issue_date: current.issue_date || TODAY(),
      due_date: addDays(current.issue_date || TODAY(), Number(example.payload.due_in_days || 0)),
      discount_type: example.payload.discount_type,
      discount_value: example.payload.discount_value,
      deposit_amount: example.payload.deposit_amount,
      vat_rate: roundMoney(current.vat_rate ?? state.settings.default_vat_rate ?? 0),
      payment_terms: example.payload.payment_terms,
      notes: example.payload.notes,
      items: (example.payload.items || []).map((item, index)=> normalizeItem(item, index)),
      payments: (example.payload.payments || []).map((payment, index)=> normalizePayment(payment, index)),
    });
    renderInvoiceEditorPage();
    toast("Facture", `${example.label} pre-rempli. Ajuste les champs si besoin.`);
  }

  async function applyInvoiceExampleWithClient(exampleId, options = {}){
    const example = INVOICE_EXAMPLES.find((entry)=> entry.id === String(exampleId || ""));
    if(!example) return null;
    const client = await ensureClientFromExample(example.payload.client_example_id || "");
    const current = collectInvoiceFormData();
    state.invoiceForm = computeInvoice({
      ...current,
      client_id: client.id,
      client,
      title: example.payload.title,
      status: example.payload.status,
      issue_date: current.issue_date || TODAY(),
      due_date: addDays(current.issue_date || TODAY(), Number(example.payload.due_in_days || 0)),
      discount_type: example.payload.discount_type,
      discount_value: example.payload.discount_value,
      deposit_amount: example.payload.deposit_amount,
      vat_rate: roundMoney(current.vat_rate ?? state.settings.default_vat_rate ?? 0),
      payment_terms: example.payload.payment_terms,
      notes: example.payload.notes,
      items: (example.payload.items || []).map((item, index)=> normalizeItem(item, index)),
      payments: (example.payload.payments || []).map((payment, index)=> normalizePayment(payment, index)),
    });

    if(!options?.generatePdf){
      renderInvoiceEditorPage();
      toast("Facture", `${example.label} et client exemple pre-remplis.`);
      return state.invoiceForm;
    }

    const saved = await repo.saveInvoice({ ...state.invoiceForm, status: state.invoiceForm.status || "draft" });
    state.invoiceForm = await generatePdf("invoice", saved, { print: false });
    state.invoices = await repo.listInvoices();
    renderInvoiceEditorPage();
    toast("PDF", `Facture ${example.label.toLowerCase()} generee avec son client exemple.`);
    return state.invoiceForm;
  }

  function normalizeClient(input){
    const raw = input || {};
    const kind = String(raw.kind || "business");
    return {
      id: String(raw.id || uuid()),
      company: APP_COMPANY,
      kind: kind === "person" ? "person" : "business",
      display_name: clientDisplayName(raw),
      first_name: String(raw.first_name || "").trim(),
      last_name: String(raw.last_name || "").trim(),
      company_name: String(raw.company_name || "").trim(),
      email: String(raw.email || "").trim(),
      phone: String(raw.phone || "").trim(),
      address_line1: String(raw.address_line1 || "").trim(),
      address_line2: String(raw.address_line2 || "").trim(),
      postal_code: String(raw.postal_code || "").trim(),
      city: String(raw.city || "").trim(),
      country: String(raw.country || "France").trim() || "France",
      client_siret: String(raw.client_siret || "").trim(),
      notes: String(raw.notes || "").trim(),
      created_at: raw.created_at || NOW(),
      updated_at: raw.updated_at || NOW(),
    };
  }

  function normalizeItem(item, index){
    const raw = item || {};
    const normalized = {
      id: String(raw.id || uuid()),
      sort_order: Number(raw.sort_order || index + 1),
      title: String(raw.title || "").trim() || `Prestation ${index + 1}`,
      description: String(raw.description || "").trim(),
      quantity: roundMoney(raw.quantity || 1) || 1,
      unit_price: roundMoney(raw.unit_price || 0),
      line_total: 0,
    };
    normalized.line_total = roundMoney(normalized.quantity * normalized.unit_price);
    return normalized;
  }

  function normalizePayment(payment, index){
    const raw = payment || {};
    return {
      id: String(raw.id || uuid()),
      amount: roundMoney(raw.amount || 0),
      paid_at: parseDate(raw.paid_at || TODAY()),
      method: String(raw.method || "virement").trim() || "virement",
      reference: String(raw.reference || "").trim(),
      notes: String(raw.notes || "").trim(),
      created_at: raw.created_at || NOW(),
      sort_order: Number(raw.sort_order || index + 1),
    };
  }

  function calcDiscount(subtotal, discountType, discountValue){
    const sub = roundMoney(subtotal);
    const value = roundMoney(discountValue);
    if(discountType === "percent"){
      return roundMoney(sub * Math.min(value, 100) / 100);
    }
    if(discountType === "fixed"){
      return Math.min(sub, value);
    }
    return 0;
  }

  function computeQuote(doc){
    const items = (doc.items || []).map(normalizeItem);
    const subtotal = roundMoney(items.reduce((sum, item)=> sum + item.line_total, 0));
    const discount_amount = calcDiscount(subtotal, doc.discount_type, doc.discount_value);
    const taxable = Math.max(subtotal - discount_amount, 0);
    const vat_rate = roundMoney(doc.vat_rate || 0);
    const vat_amount = roundMoney(taxable * vat_rate / 100);
    const total_amount = roundMoney(taxable + vat_amount);
    const deposit_amount = roundMoney(doc.deposit_amount || 0);
    return {
      ...doc,
      items,
      subtotal_amount: subtotal,
      discount_amount,
      vat_rate,
      vat_amount,
      total_amount,
      deposit_amount,
      amount_due: roundMoney(Math.max(total_amount - deposit_amount, 0)),
    };
  }

  function invoiceEffectiveStatus(invoice){
    const status = String(invoice.status || "draft");
    if(status === "cancelled" || status === "paid" || status === "draft") return status;
    const dueDate = String(invoice.due_date || "");
    const remaining = roundMoney(invoice.amount_due || 0);
    if(remaining <= 0 && roundMoney(invoice.total_amount || 0) > 0) return "paid";
    if(dueDate && dueDate < TODAY()) return "overdue";
    return status || "sent";
  }

  function computeInvoice(doc){
    const items = (doc.items || []).map(normalizeItem);
    const payments = (doc.payments || []).map(normalizePayment).filter((payment)=> payment.amount > 0);
    const subtotal = roundMoney(items.reduce((sum, item)=> sum + item.line_total, 0));
    const discount_amount = calcDiscount(subtotal, doc.discount_type, doc.discount_value);
    const taxable = Math.max(subtotal - discount_amount, 0);
    const vat_rate = roundMoney(doc.vat_rate || 0);
    const vat_amount = roundMoney(taxable * vat_rate / 100);
    const total_amount = roundMoney(taxable + vat_amount);
    const amount_paid = roundMoney(payments.reduce((sum, payment)=> sum + payment.amount, 0));
    const next = {
      ...doc,
      items,
      payments,
      subtotal_amount: subtotal,
      discount_amount,
      vat_rate,
      vat_amount,
      total_amount,
      amount_paid,
      amount_due: roundMoney(Math.max(total_amount - amount_paid, 0)),
    };
    next.status = invoiceEffectiveStatus(next);
    return next;
  }

  function baseQuote(settings){
    return computeQuote({
      id: "",
      number: "",
      title: "",
      client_id: "",
      status: "draft",
      issue_date: TODAY(),
      valid_until: addDays(TODAY(), Number(settings.quote_validity_days || 30)),
      payment_terms: settings.payment_terms_default || "",
      notes: settings.default_notes || "",
      discount_type: "none",
      discount_value: 0,
      deposit_amount: 0,
      vat_rate: roundMoney(settings.default_vat_rate || 0),
      accepted: false,
      accepted_name: "",
      accepted_signature: "",
      accepted_at: "",
      sent_at: "",
      pdf_url: "",
      pdf_path: "",
      converted_invoice_id: "",
      items: [
        normalizeItem({ title: "Prestation principale", quantity: 1, unit_price: 0 }, 0),
      ],
    });
  }

  function baseInvoice(settings){
    return computeInvoice({
      id: "",
      number: "",
      title: "",
      client_id: "",
      source_quote_id: "",
      status: "draft",
      issue_date: TODAY(),
      due_date: addDays(TODAY(), 30),
      payment_terms: settings.payment_terms_default || "",
      notes: settings.default_notes || "",
      discount_type: "none",
      discount_value: 0,
      deposit_amount: 0,
      vat_rate: roundMoney(settings.default_vat_rate || 0),
      sent_at: "",
      paid_at: "",
      cancelled_at: "",
      pdf_url: "",
      pdf_path: "",
      items: [
        normalizeItem({ title: "Prestation facturee", quantity: 1, unit_price: 0 }, 0),
      ],
      payments: [],
    });
  }

  function csvEscape(value){
    return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  }

  function exportCsv(filename, rows){
    const content = rows.map((row)=> row.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 30000);
  }

  function readAsDataUrl(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result || ""));
      reader.onerror = ()=> reject(new Error("Lecture du fichier impossible."));
      reader.readAsDataURL(file);
    });
  }

  function parseSbUrl(raw){
    const value = String(raw || "").trim();
    const match = value.match(/^sb:\/\/([^/]+)\/(.+)$/i);
    if(!match) return null;
    return { bucket: match[1], path: match[2] };
  }

  function storageKey(name){
    return `fwCrm:${APP_COMPANY}:${name}`;
  }

  function readLs(name, fallback){
    try{
      const value = localStorage.getItem(storageKey(name));
      if(!value) return clone(fallback);
      return JSON.parse(value);
    }catch(error){
      return clone(fallback);
    }
  }

  function writeLs(name, value){
    localStorage.setItem(storageKey(name), JSON.stringify(value));
  }

  function sortByDateDesc(list, field){
    return [...list].sort((a, b)=> String(b?.[field] || "").localeCompare(String(a?.[field] || "")));
  }

  function createLocalRepo(){
    function getSettings(){
      return { ...DEFAULT_SETTINGS, ...(readLs("settings", null) || {}), company: APP_COMPANY };
    }

    function saveSettings(payload){
      const next = { ...getSettings(), ...(payload || {}), company: APP_COMPANY, updated_at: NOW() };
      writeLs("settings", next);
      return next;
    }

    function nextNumber(type, issueDate){
      const settings = getSettings();
      const year = Number(String(issueDate || TODAY()).slice(0, 4)) || new Date().getFullYear();
      const prefix = type === "quote" ? settings.numbering_quote_prefix : settings.numbering_invoice_prefix;
      const counters = readLs("counters", {});
      const key = `${type}-${year}`;
      const next = Number(counters[key] || 0) + 1;
      counters[key] = next;
      writeLs("counters", counters);
      return `${prefix}-${year}-${String(next).padStart(Number(settings.numbering_padding || 3), "0")}`;
    }

    function listClients(){
      return sortByDateDesc((readLs("clients", []) || []).map(normalizeClient), "updated_at");
    }

    function getClient(id){
      return listClients().find((client)=> client.id === String(id || "")) || null;
    }

    function saveClient(payload){
      const clients = listClients();
      const normalized = normalizeClient({
        ...payload,
        id: payload?.id || uuid(),
        created_at: payload?.created_at || NOW(),
        updated_at: NOW(),
      });
      const index = clients.findIndex((client)=> client.id === normalized.id);
      if(index >= 0) clients[index] = normalized;
      else clients.unshift(normalized);
      writeLs("clients", clients);
      return normalized;
    }

    function deleteClient(id){
      const clientId = String(id || "");
      const hasDocs = listQuotes().some((doc)=> doc.client_id === clientId) || listInvoices().some((doc)=> doc.client_id === clientId);
      if(hasDocs){
        throw new Error("Ce client est lie a un devis ou une facture.");
      }
      writeLs("clients", listClients().filter((client)=> client.id !== clientId));
      return true;
    }

    function enrichQuote(raw){
      const settings = getSettings();
      const quote = computeQuote({
        ...raw,
        issue_date: parseDate(raw.issue_date || TODAY()),
        valid_until: parseDate(raw.valid_until || addDays(raw.issue_date || TODAY(), Number(settings.quote_validity_days || 30))),
        items: Array.isArray(raw.items) ? raw.items : [],
      });
      quote.client = getClient(quote.client_id);
      return quote;
    }

    function listQuotes(){
      return sortByDateDesc((readLs("quotes", []) || []).map(enrichQuote), "issue_date");
    }

    function getQuote(id){
      return listQuotes().find((quote)=> quote.id === String(id || "")) || null;
    }

    function saveQuote(payload){
      const settings = getSettings();
      const quotes = readLs("quotes", []);
      const existing = payload?.id ? quotes.find((quote)=> quote.id === payload.id) : null;
      const base = {
        ...(existing || {}),
        ...payload,
        id: existing?.id || payload?.id || uuid(),
        company: APP_COMPANY,
        number: existing?.number || payload?.number || nextNumber("quote", payload?.issue_date),
        issue_date: parseDate(payload?.issue_date || TODAY()),
        valid_until: parseDate(payload?.valid_until || addDays(payload?.issue_date || TODAY(), Number(settings.quote_validity_days || 30))),
        payment_terms: String(payload?.payment_terms || settings.payment_terms_default || "").trim(),
        notes: String(payload?.notes ?? settings.default_notes ?? "").trim(),
        status: String(payload?.status || existing?.status || "draft"),
        discount_type: String(payload?.discount_type || "none"),
        discount_value: roundMoney(payload?.discount_value || 0),
        deposit_amount: roundMoney(payload?.deposit_amount || 0),
        vat_rate: roundMoney(payload?.vat_rate ?? settings.default_vat_rate ?? 0),
        accepted: !!payload?.accepted,
        accepted_name: String(payload?.accepted_name || "").trim(),
        accepted_signature: String(payload?.accepted_signature || "").trim(),
        accepted_at: payload?.accepted ? (payload?.accepted_at || NOW()) : "",
        sent_at: payload?.status === "sent" && !existing?.sent_at ? NOW() : (payload?.sent_at || existing?.sent_at || ""),
        items: (payload?.items || []).map(normalizeItem),
        updated_at: NOW(),
        created_at: existing?.created_at || NOW(),
      };
      const computed = computeQuote(base);
      const nextQuotes = quotes.filter((quote)=> quote.id !== computed.id);
      nextQuotes.unshift(computed);
      writeLs("quotes", nextQuotes);
      return enrichQuote(computed);
    }

    function deleteQuote(id){
      writeLs("quotes", readLs("quotes", []).filter((quote)=> quote.id !== String(id || "")));
      return true;
    }

    function duplicateQuote(id){
      const quote = getQuote(id);
      if(!quote) throw new Error("Devis introuvable.");
      return saveQuote({
        ...quote,
        id: "",
        number: "",
        status: "draft",
        sent_at: "",
        accepted: false,
        accepted_at: "",
        accepted_name: "",
        accepted_signature: "",
        converted_invoice_id: "",
        pdf_url: "",
        pdf_path: "",
      });
    }

    function enrichInvoice(raw){
      const invoice = computeInvoice({
        ...raw,
        issue_date: parseDate(raw.issue_date || TODAY()),
        due_date: parseDate(raw.due_date || addDays(raw.issue_date || TODAY(), 30)),
        items: Array.isArray(raw.items) ? raw.items : [],
        payments: Array.isArray(raw.payments) ? raw.payments : [],
      });
      invoice.client = getClient(invoice.client_id);
      invoice.source_quote = invoice.source_quote_id ? getQuote(invoice.source_quote_id) : null;
      return invoice;
    }

    function listInvoices(){
      return sortByDateDesc((readLs("invoices", []) || []).map(enrichInvoice), "issue_date");
    }

    function getInvoice(id){
      return listInvoices().find((invoice)=> invoice.id === String(id || "")) || null;
    }

    function saveInvoice(payload){
      const settings = getSettings();
      const invoices = readLs("invoices", []);
      const existing = payload?.id ? invoices.find((invoice)=> invoice.id === payload.id) : null;
      const draft = {
        ...(existing || {}),
        ...payload,
        id: existing?.id || payload?.id || uuid(),
        company: APP_COMPANY,
        number: existing?.number || payload?.number || nextNumber("invoice", payload?.issue_date),
        issue_date: parseDate(payload?.issue_date || TODAY()),
        due_date: parseDate(payload?.due_date || addDays(payload?.issue_date || TODAY(), 30)),
        payment_terms: String(payload?.payment_terms || settings.payment_terms_default || "").trim(),
        notes: String(payload?.notes ?? settings.default_notes ?? "").trim(),
        status: String(payload?.status || existing?.status || "draft"),
        discount_type: String(payload?.discount_type || "none"),
        discount_value: roundMoney(payload?.discount_value || 0),
        deposit_amount: roundMoney(payload?.deposit_amount || 0),
        vat_rate: roundMoney(payload?.vat_rate ?? settings.default_vat_rate ?? 0),
        items: (payload?.items || []).map(normalizeItem),
        payments: (payload?.payments || []).map(normalizePayment).filter((payment)=> payment.amount > 0),
        sent_at: payload?.status === "sent" && !existing?.sent_at ? NOW() : (payload?.sent_at || existing?.sent_at || ""),
        updated_at: NOW(),
        created_at: existing?.created_at || NOW(),
      };
      const computed = computeInvoice(draft);
      if(computed.status === "cancelled") computed.cancelled_at = computed.cancelled_at || NOW();
      const nextInvoices = invoices.filter((invoice)=> invoice.id !== computed.id);
      nextInvoices.unshift(computed);
      writeLs("invoices", nextInvoices);
      return enrichInvoice(computed);
    }

    function deleteInvoice(id){
      writeLs("invoices", readLs("invoices", []).filter((invoice)=> invoice.id !== String(id || "")));
      return true;
    }

    function duplicateInvoice(id){
      const invoice = getInvoice(id);
      if(!invoice) throw new Error("Facture introuvable.");
      return saveInvoice({
        ...invoice,
        id: "",
        number: "",
        status: "draft",
        sent_at: "",
        paid_at: "",
        cancelled_at: "",
        source_quote_id: "",
        payments: [],
        pdf_url: "",
        pdf_path: "",
      });
    }

    function convertQuoteToInvoice(quoteId, overrides){
      const quote = getQuote(quoteId);
      if(!quote) throw new Error("Devis introuvable.");
      const existing = listInvoices().find((invoice)=> invoice.source_quote_id === quote.id);
      if(existing) return existing;
      const invoice = saveInvoice({
        client_id: quote.client_id,
        source_quote_id: quote.id,
        title: quote.title || `Facture - ${quote.number}`,
        status: overrides?.status || "draft",
        issue_date: overrides?.issue_date || TODAY(),
        due_date: overrides?.due_date || addDays(overrides?.issue_date || TODAY(), 30),
        payment_terms: quote.payment_terms,
        notes: quote.notes,
        discount_type: quote.discount_type,
        discount_value: quote.discount_value,
        deposit_amount: quote.deposit_amount,
        vat_rate: quote.vat_rate,
        items: quote.items,
        payments: [],
      });
      const quotes = readLs("quotes", []);
      writeLs("quotes", quotes.map((doc)=> doc.id === quote.id ? { ...doc, status: "converted", converted_invoice_id: invoice.id, updated_at: NOW() } : doc));
      return getInvoice(invoice.id);
    }

    function seedDemoData(){
      if(listClients().length) return { ok: false, message: "already_seeded" };
      saveSettings({
        trade_name: "Marie-Madeleine Gautier Digital",
        legal_name: "Marie-Madeleine Gautier",
        city: "Paris",
        email: "bonjour@marie-madeleine.fr",
        phone: "+33 6 00 00 00 00",
        siret: "123 456 789 00012",
        default_vat_rate: 0,
        business_type: "micro",
      });
      const marie = saveClient({
        kind: "person",
        first_name: "Marie-Madeleine",
        last_name: "Gautier",
        display_name: "Marie-Madeleine Gautier",
        email: "contact@marie-madeleine.fr",
        phone: "+33 6 11 22 33 44",
        address_line1: "12 rue des Creatifs",
        postal_code: "75011",
        city: "Paris",
        country: "France",
        notes: "Cliente premium pre-remplie pour les devis rapides.",
      });
      const studio = saveClient({
        kind: "business",
        company_name: "Studio Horizon",
        display_name: "Studio Horizon",
        email: "hello@studio-horizon.fr",
        phone: "+33 1 80 00 00 00",
        address_line1: "48 avenue des Champs",
        postal_code: "69002",
        city: "Lyon",
        country: "France",
        client_siret: "80123456700017",
      });
      saveQuote({
        client_id: marie.id,
        title: "Refonte site vitrine + accompagnement digital",
        status: "sent",
        issue_date: TODAY(),
        valid_until: addDays(TODAY(), 30),
        payment_terms: "Acompte de 30% a la commande, solde a la livraison.",
        notes: "Prevoir une session de passation et une mini-formation.",
        discount_type: "percent",
        discount_value: 5,
        deposit_amount: 450,
        vat_rate: 0,
        items: [
          { title: "Audit digital initial", description: "Analyse du site actuel, positionnement et recommandations.", quantity: 1, unit_price: 280 },
          { title: "Creation du site vitrine", description: "Maquettage, developpement, responsive et optimisations.", quantity: 1, unit_price: 1200 },
          { title: "Pack communication sociale", description: "Calendrier editorial et templates de publication.", quantity: 1, unit_price: 320 },
        ],
      });
      saveInvoice({
        client_id: studio.id,
        title: "Maintenance et contenu mensuel",
        status: "sent",
        issue_date: addDays(TODAY(), -20),
        due_date: addDays(TODAY(), 10),
        payment_terms: "Paiement a reception par virement bancaire.",
        notes: "Facture recurrente exemple.",
        vat_rate: 0,
        items: [
          { title: "Maintenance technique", description: "Mises a jour, sauvegardes et monitoring.", quantity: 1, unit_price: 240 },
          { title: "Production de contenus", description: "Conception de 4 publications premium.", quantity: 1, unit_price: 310 },
        ],
        payments: [
          { amount: 200, paid_at: addDays(TODAY(), -5), method: "virement", reference: "VIR-STH-2026", notes: "Acompte deja recu." },
        ],
      });
      return { ok: true, message: "seeded" };
    }

    return {
      mode: "local",
      getSettings,
      saveSettings,
      listClients,
      getClient,
      saveClient,
      deleteClient,
      listQuotes,
      getQuote,
      saveQuote,
      deleteQuote,
      duplicateQuote,
      listInvoices,
      getInvoice,
      saveInvoice,
      deleteInvoice,
      duplicateInvoice,
      convertQuoteToInvoice,
      seedDemoData,
    };
  }

  function quoteRow(payload){
    return {
      company: APP_COMPANY,
      client_id: payload.client_id,
      title: String(payload.title || "").trim(),
      status: String(payload.status || "draft"),
      issue_date: parseDate(payload.issue_date || TODAY()),
      valid_until: parseDate(payload.valid_until || TODAY()),
      payment_terms: String(payload.payment_terms || "").trim(),
      notes: String(payload.notes || "").trim(),
      discount_type: String(payload.discount_type || "none"),
      discount_value: roundMoney(payload.discount_value || 0),
      deposit_amount: roundMoney(payload.deposit_amount || 0),
      vat_rate: roundMoney(payload.vat_rate || 0),
      accepted: !!payload.accepted,
      accepted_name: String(payload.accepted_name || "").trim(),
      accepted_signature: String(payload.accepted_signature || "").trim(),
      accepted_at: payload.accepted ? (payload.accepted_at || NOW()) : null,
      sent_at: payload.status === "sent" ? (payload.sent_at || NOW()) : payload.sent_at || null,
      pdf_url: String(payload.pdf_url || "").trim(),
      pdf_path: String(payload.pdf_path || "").trim(),
      converted_invoice_id: String(payload.converted_invoice_id || "").trim() || null,
    };
  }

  function invoiceRow(payload){
    return {
      company: APP_COMPANY,
      client_id: payload.client_id,
      source_quote_id: String(payload.source_quote_id || "").trim() || null,
      title: String(payload.title || "").trim(),
      status: String(payload.status || "draft"),
      issue_date: parseDate(payload.issue_date || TODAY()),
      due_date: parseDate(payload.due_date || TODAY()),
      payment_terms: String(payload.payment_terms || "").trim(),
      notes: String(payload.notes || "").trim(),
      discount_type: String(payload.discount_type || "none"),
      discount_value: roundMoney(payload.discount_value || 0),
      deposit_amount: roundMoney(payload.deposit_amount || 0),
      vat_rate: roundMoney(payload.vat_rate || 0),
      sent_at: payload.status === "sent" ? (payload.sent_at || NOW()) : payload.sent_at || null,
      cancelled_at: payload.status === "cancelled" ? (payload.cancelled_at || NOW()) : payload.cancelled_at || null,
      pdf_url: String(payload.pdf_url || "").trim(),
      pdf_path: String(payload.pdf_path || "").trim(),
    };
  }

  function itemsRows(ownerId, items, kind){
    return (items || []).map((item, index)=> ({
      company: APP_COMPANY,
      [`${kind}_id`]: ownerId,
      sort_order: index + 1,
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim(),
      quantity: roundMoney(item.quantity || 0),
      unit_price: roundMoney(item.unit_price || 0),
    }));
  }

  function paymentsRows(invoiceId, payments){
    return (payments || [])
      .map(normalizePayment)
      .filter((payment)=> payment.amount > 0)
      .map((payment)=> ({
        company: APP_COMPANY,
        invoice_id: invoiceId,
        amount: roundMoney(payment.amount),
        paid_at: parseDate(payment.paid_at || TODAY()),
        method: String(payment.method || "virement").trim() || "virement",
        reference: String(payment.reference || "").trim(),
        notes: String(payment.notes || "").trim(),
      }));
  }

  function createSupabaseRepo(){
    async function getSettings(){
      const { data, error } = await sb
        .from("crm_settings")
        .select("*")
        .eq("company", APP_COMPANY)
        .maybeSingle();
      if(error && error.code !== "PGRST116") throw error;
      return { ...DEFAULT_SETTINGS, ...(data || {}), company: APP_COMPANY };
    }

    async function saveSettings(payload){
      const row = { ...DEFAULT_SETTINGS, ...(payload || {}), company: APP_COMPANY };
      const { data, error } = await sb
        .from("crm_settings")
        .upsert(row, { onConflict: "company" })
        .select("*")
        .single();
      if(error) throw error;
      return { ...DEFAULT_SETTINGS, ...(data || {}), company: APP_COMPANY };
    }

    async function listClients(){
      const { data, error } = await sb
        .from("crm_clients")
        .select("*")
        .eq("company", APP_COMPANY)
        .order("updated_at", { ascending: false });
      if(error) throw error;
      return (data || []).map(normalizeClient);
    }

    async function getClient(id){
      const { data, error } = await sb
        .from("crm_clients")
        .select("*")
        .eq("company", APP_COMPANY)
        .eq("id", id)
        .maybeSingle();
      if(error && error.code !== "PGRST116") throw error;
      return data ? normalizeClient(data) : null;
    }

    async function saveClient(payload){
      const row = normalizeClient(payload);
      if(payload?.id){
        const { data, error } = await sb
          .from("crm_clients")
          .update(row)
          .eq("company", APP_COMPANY)
          .eq("id", payload.id)
          .select("*")
          .single();
        if(error) throw error;
        return normalizeClient(data);
      }
      const { data, error } = await sb
        .from("crm_clients")
        .insert(row)
        .select("*")
        .single();
      if(error) throw error;
      return normalizeClient(data);
    }

    async function deleteClient(id){
      const { error } = await sb
        .from("crm_clients")
        .delete()
        .eq("company", APP_COMPANY)
        .eq("id", id);
      if(error) throw error;
      return true;
    }

    async function listQuotes(){
      const [quotesRes, itemsRes, clientsRes] = await Promise.all([
        sb.from("crm_quotes").select("*").eq("company", APP_COMPANY).order("issue_date", { ascending: false }),
        sb.from("crm_quote_items").select("*").eq("company", APP_COMPANY).order("sort_order", { ascending: true }),
        sb.from("crm_clients").select("*").eq("company", APP_COMPANY),
      ]);
      if(quotesRes.error) throw quotesRes.error;
      if(itemsRes.error) throw itemsRes.error;
      if(clientsRes.error) throw clientsRes.error;
      const itemsByQuote = new Map();
      (itemsRes.data || []).forEach((item)=>{
        const key = String(item.quote_id || "");
        if(!itemsByQuote.has(key)) itemsByQuote.set(key, []);
        itemsByQuote.get(key).push(item);
      });
      const clientsById = new Map((clientsRes.data || []).map((client)=> [String(client.id), normalizeClient(client)]));
      return (quotesRes.data || []).map((quote)=> {
        const items = (itemsByQuote.get(String(quote.id || "")) || []).map(normalizeItem);
        const computed = computeQuote({ ...quote, items, client: clientsById.get(String(quote.client_id || "")) || null });
        computed.client = clientsById.get(String(computed.client_id || "")) || null;
        return computed;
      });
    }

    async function getQuote(id){
      const [quoteRes, itemsRes, clientRes] = await Promise.all([
        sb.from("crm_quotes").select("*").eq("company", APP_COMPANY).eq("id", id).maybeSingle(),
        sb.from("crm_quote_items").select("*").eq("company", APP_COMPANY).eq("quote_id", id).order("sort_order", { ascending: true }),
        sb.from("crm_quotes").select("client_id").eq("company", APP_COMPANY).eq("id", id).maybeSingle(),
      ]);
      if(quoteRes.error && quoteRes.error.code !== "PGRST116") throw quoteRes.error;
      if(!quoteRes.data) return null;
      if(itemsRes.error) throw itemsRes.error;
      const clientId = String(clientRes.data?.client_id || quoteRes.data.client_id || "");
      let client = null;
      if(clientId){
        client = await getClient(clientId);
      }
      return computeQuote({ ...quoteRes.data, items: itemsRes.data || [], client });
    }

    async function saveQuote(payload){
      let quoteId = String(payload?.id || "");
      const row = quoteRow(payload);
      if(quoteId){
        const { error } = await sb.from("crm_quotes").update(row).eq("company", APP_COMPANY).eq("id", quoteId);
        if(error) throw error;
      }else{
        const { data, error } = await sb.from("crm_quotes").insert(row).select("id").single();
        if(error) throw error;
        quoteId = String(data?.id || "");
      }
      const { error: deleteError } = await sb.from("crm_quote_items").delete().eq("company", APP_COMPANY).eq("quote_id", quoteId);
      if(deleteError) throw deleteError;
      const rows = itemsRows(quoteId, payload?.items || [], "quote");
      if(rows.length){
        const { error: insertError } = await sb.from("crm_quote_items").insert(rows);
        if(insertError) throw insertError;
      }
      return getQuote(quoteId);
    }

    async function deleteQuote(id){
      const { error } = await sb.from("crm_quotes").delete().eq("company", APP_COMPANY).eq("id", id);
      if(error) throw error;
      return true;
    }

    async function duplicateQuote(id){
      const quote = await getQuote(id);
      if(!quote) throw new Error("Devis introuvable.");
      return saveQuote({
        ...quote,
        id: "",
        number: "",
        status: "draft",
        sent_at: "",
        accepted: false,
        accepted_at: "",
        accepted_name: "",
        accepted_signature: "",
        converted_invoice_id: "",
        pdf_url: "",
        pdf_path: "",
      });
    }

    async function listInvoices(){
      const [invoicesRes, itemsRes, paymentsRes, clientsRes, quotesRes] = await Promise.all([
        sb.from("crm_invoices").select("*").eq("company", APP_COMPANY).order("issue_date", { ascending: false }),
        sb.from("crm_invoice_items").select("*").eq("company", APP_COMPANY).order("sort_order", { ascending: true }),
        sb.from("crm_invoice_payments").select("*").eq("company", APP_COMPANY).order("paid_at", { ascending: false }),
        sb.from("crm_clients").select("*").eq("company", APP_COMPANY),
        sb.from("crm_quotes").select("*").eq("company", APP_COMPANY),
      ]);
      if(invoicesRes.error) throw invoicesRes.error;
      if(itemsRes.error) throw itemsRes.error;
      if(paymentsRes.error) throw paymentsRes.error;
      if(clientsRes.error) throw clientsRes.error;
      if(quotesRes.error) throw quotesRes.error;
      const itemsByInvoice = new Map();
      (itemsRes.data || []).forEach((item)=>{
        const key = String(item.invoice_id || "");
        if(!itemsByInvoice.has(key)) itemsByInvoice.set(key, []);
        itemsByInvoice.get(key).push(item);
      });
      const paymentsByInvoice = new Map();
      (paymentsRes.data || []).forEach((payment)=>{
        const key = String(payment.invoice_id || "");
        if(!paymentsByInvoice.has(key)) paymentsByInvoice.set(key, []);
        paymentsByInvoice.get(key).push(payment);
      });
      const clientsById = new Map((clientsRes.data || []).map((client)=> [String(client.id), normalizeClient(client)]));
      const quotesById = new Map((quotesRes.data || []).map((quote)=> [String(quote.id), quote]));
      return (invoicesRes.data || []).map((invoice)=>{
        const computed = computeInvoice({
          ...invoice,
          items: itemsByInvoice.get(String(invoice.id || "")) || [],
          payments: paymentsByInvoice.get(String(invoice.id || "")) || [],
        });
        computed.client = clientsById.get(String(computed.client_id || "")) || null;
        computed.source_quote = quotesById.get(String(computed.source_quote_id || "")) || null;
        return computed;
      });
    }

    async function getInvoice(id){
      const [invoiceRes, itemsRes, paymentsRes] = await Promise.all([
        sb.from("crm_invoices").select("*").eq("company", APP_COMPANY).eq("id", id).maybeSingle(),
        sb.from("crm_invoice_items").select("*").eq("company", APP_COMPANY).eq("invoice_id", id).order("sort_order", { ascending: true }),
        sb.from("crm_invoice_payments").select("*").eq("company", APP_COMPANY).eq("invoice_id", id).order("paid_at", { ascending: false }),
      ]);
      if(invoiceRes.error && invoiceRes.error.code !== "PGRST116") throw invoiceRes.error;
      if(!invoiceRes.data) return null;
      if(itemsRes.error) throw itemsRes.error;
      if(paymentsRes.error) throw paymentsRes.error;
      const client = invoiceRes.data.client_id ? await getClient(invoiceRes.data.client_id) : null;
      const sourceQuote = invoiceRes.data.source_quote_id ? await getQuote(invoiceRes.data.source_quote_id) : null;
      return computeInvoice({ ...invoiceRes.data, items: itemsRes.data || [], payments: paymentsRes.data || [], client, source_quote: sourceQuote });
    }

    async function saveInvoice(payload){
      let invoiceId = String(payload?.id || "");
      const row = invoiceRow(payload);
      if(invoiceId){
        const { error } = await sb.from("crm_invoices").update(row).eq("company", APP_COMPANY).eq("id", invoiceId);
        if(error) throw error;
      }else{
        const { data, error } = await sb.from("crm_invoices").insert(row).select("id").single();
        if(error) throw error;
        invoiceId = String(data?.id || "");
      }
      const { error: deleteItemsError } = await sb.from("crm_invoice_items").delete().eq("company", APP_COMPANY).eq("invoice_id", invoiceId);
      if(deleteItemsError) throw deleteItemsError;
      const itemRows = itemsRows(invoiceId, payload?.items || [], "invoice");
      if(itemRows.length){
        const { error: insertItemsError } = await sb.from("crm_invoice_items").insert(itemRows);
        if(insertItemsError) throw insertItemsError;
      }
      const { error: deletePaymentsError } = await sb.from("crm_invoice_payments").delete().eq("company", APP_COMPANY).eq("invoice_id", invoiceId);
      if(deletePaymentsError) throw deletePaymentsError;
      const paymentRows = paymentsRows(invoiceId, payload?.payments || []);
      if(paymentRows.length){
        const { error: insertPaymentsError } = await sb.from("crm_invoice_payments").insert(paymentRows);
        if(insertPaymentsError) throw insertPaymentsError;
      }
      return getInvoice(invoiceId);
    }

    async function deleteInvoice(id){
      const { error } = await sb.from("crm_invoices").delete().eq("company", APP_COMPANY).eq("id", id);
      if(error) throw error;
      return true;
    }

    async function duplicateInvoice(id){
      const invoice = await getInvoice(id);
      if(!invoice) throw new Error("Facture introuvable.");
      return saveInvoice({
        ...invoice,
        id: "",
        number: "",
        status: "draft",
        source_quote_id: "",
        sent_at: "",
        paid_at: "",
        cancelled_at: "",
        payments: [],
        pdf_url: "",
        pdf_path: "",
      });
    }

    async function convertQuoteToInvoice(quoteId, overrides){
      const args = {
        _quote_id: quoteId,
        _issue_date: overrides?.issue_date || TODAY(),
        _due_date: overrides?.due_date || addDays(overrides?.issue_date || TODAY(), 30),
        _status: overrides?.status || "draft",
      };
      const { data, error } = await sb.rpc("crm_convert_quote_to_invoice", args);
      if(error) throw error;
      return getInvoice(data);
    }

    async function seedDemoData(){
      const { data, error } = await sb.rpc("crm_seed_demo_data");
      if(error) throw error;
      return data || { ok: true };
    }

    return {
      mode: "supabase",
      getSettings,
      saveSettings,
      listClients,
      getClient,
      saveClient,
      deleteClient,
      listQuotes,
      getQuote,
      saveQuote,
      deleteQuote,
      duplicateQuote,
      listInvoices,
      getInvoice,
      saveInvoice,
      deleteInvoice,
      duplicateInvoice,
      convertQuoteToInvoice,
      seedDemoData,
    };
  }

  const repo = sb ? createSupabaseRepo() : createLocalRepo();

  function statusClass(status){
    const value = String(status || "draft").toLowerCase();
    return value;
  }

  function statusLabel(status){
    const value = String(status || "draft").toLowerCase();
    const labels = {
      draft: "Brouillon",
      sent: "Envoye",
      pending: "En attente",
      accepted: "Accepte",
      rejected: "Refuse",
      expired: "Expire",
      converted: "Transforme",
      paid: "Payee",
      overdue: "En retard",
      cancelled: "Annulee",
    };
    return labels[value] || value;
  }

  function statusBadge(status){
    const value = String(status || "draft").toLowerCase();
    return `<span class="crm-status ${escapeHtml(statusClass(value))}">${escapeHtml(statusLabel(value))}</span>`;
  }

  function companyBlockHtml(settings){
    const lines = [
      settings.trade_name || settings.legal_name || APP_COMPANY,
      settings.legal_name && settings.legal_name !== settings.trade_name ? settings.legal_name : "",
      settings.address_line1 || "",
      settings.address_line2 || "",
      [settings.postal_code || "", settings.city || ""].filter(Boolean).join(" "),
      settings.country || "",
      settings.email || "",
      settings.phone || "",
      settings.siret ? `SIRET : ${settings.siret}` : "",
    ].filter(Boolean);
    return lines.map((line)=> `<div>${escapeHtml(line)}</div>`).join("");
  }

  function clientBlockHtml(client){
    if(!client){
      return "<div>Client non renseigne</div>";
    }
    const lines = [
      clientDisplayName(client),
      client.kind === "business" ? client.company_name : "",
      clientAddress(client),
      client.email || "",
      client.phone || "",
      client.client_siret ? `SIRET : ${client.client_siret}` : "",
    ].filter(Boolean);
    return lines.map((line)=> `<div>${escapeHtml(line)}</div>`).join("");
  }

  function quoteDisplayStatus(quote){
    if(quote.accepted) return "accepted";
    const validUntil = String(quote.valid_until || "");
    if(quote.status === "sent" && validUntil && validUntil < TODAY()) return "expired";
    return quote.status || "draft";
  }

  function totalsRowsHtml(doc, kind){
    const settings = state.settings || DEFAULT_SETTINGS;
    const rows = [
      ["Sous-total", fmtMoney(doc.subtotal_amount || 0, settings.currency)],
      ["Remise", fmtMoney(doc.discount_amount || 0, settings.currency)],
      [`TVA (${roundMoney(doc.vat_rate || 0)}%)`, fmtMoney(doc.vat_amount || 0, settings.currency)],
      ["Total TTC", fmtMoney(doc.total_amount || 0, settings.currency)],
    ];
    if(kind === "quote"){
      rows.push(["Acompte demande", fmtMoney(doc.deposit_amount || 0, settings.currency)]);
      rows.push(["Reste a payer", fmtMoney(doc.amount_due || 0, settings.currency)]);
    }else{
      rows.push(["Montant regle", fmtMoney(doc.amount_paid || 0, settings.currency)]);
      rows.push(["Reste du", fmtMoney(doc.amount_due || 0, settings.currency)]);
    }
    return rows.map(([label, value], index)=> `<div class="crm-total-row ${index === rows.length - 1 ? "final" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  function legalBlockHtml(settings){
    const lines = [
      settings.vat_note || "",
      settings.late_penalties || "",
      settings.recovery_indemnity || "",
    ].filter(Boolean);
    return lines.map((line)=> `<div>${escapeHtml(line)}</div>`).join("");
  }

  function renderDocumentPreview(kind, rawDoc){
    const settings = state.settings || DEFAULT_SETTINGS;
    const doc = kind === "quote" ? computeQuote(rawDoc) : computeInvoice(rawDoc);
    const client = doc.client || state.clients.find((entry)=> entry.id === doc.client_id) || null;
    const displayStatus = kind === "quote" ? quoteDisplayStatus(doc) : invoiceEffectiveStatus(doc);
    const title = kind === "quote" ? "Devis" : "Facture";
    const dateLabel = kind === "quote" ? "Valable jusqu'au" : "Echeance";
    const brandName = companyDisplayName(settings);
    const logoUrl = effectiveLogoUrl(settings);

    const rows = (doc.items || []).map((item)=> `
      <tr>
        <td>
          <strong>${escapeHtml(item.title)}</strong>
          ${item.description ? `<div style="margin-top:6px;color:rgba(18,18,18,.62)">${escapeHtml(item.description)}</div>` : ""}
        </td>
        <td>${escapeHtml(String(item.quantity))}</td>
        <td>${escapeHtml(fmtMoney(item.unit_price || 0, settings.currency))}</td>
        <td>${escapeHtml(fmtMoney(item.line_total || 0, settings.currency))}</td>
      </tr>
    `).join("");

    return `
      <div class="crm-doc-preview">
        <div class="crm-doc-head">
          <div class="crm-doc-brand">
            <div class="crm-doc-brand-row">
              <div class="crm-doc-brand-copy">
                <span class="crm-doc-chip">${escapeHtml(title)}</span>
                <strong>${escapeHtml(brandName)}</strong>
              </div>
              <img class="crm-doc-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(brandName)}"/>
            </div>
            <div style="color:rgba(18,18,18,.64); line-height:1.65">${companyBlockHtml(settings)}</div>
          </div>
          <div class="crm-doc-block" style="min-width:240px">
            <h4>${escapeHtml(title)}</h4>
            <div><strong>Numero :</strong> ${escapeHtml(doc.number || "Automatique")}</div>
            <div><strong>Date :</strong> ${escapeHtml(fmtDate(doc.issue_date))}</div>
            <div><strong>${escapeHtml(dateLabel)} :</strong> ${escapeHtml(fmtDate(kind === "quote" ? doc.valid_until : doc.due_date))}</div>
            <div><strong>Statut :</strong> ${escapeHtml(statusLabel(displayStatus))}</div>
          </div>
        </div>
        <div class="crm-doc-grid">
          <div class="crm-doc-block">
            <h4>Emetteur</h4>
            ${companyBlockHtml(settings)}
          </div>
          <div class="crm-doc-block">
            <h4>Client</h4>
            ${clientBlockHtml(client)}
          </div>
        </div>
        <table class="crm-doc-table">
          <thead>
            <tr>
              <th>Prestation</th>
              <th>Qt</th>
              <th>PU</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="4">Aucune ligne</td></tr>`}</tbody>
        </table>
        <div class="crm-doc-foot">
          <div class="crm-doc-block">
            <h4>Notes et conditions</h4>
            <div class="crm-doc-legal">${escapeHtml(doc.notes || settings.default_notes || "Aucune note.")}</div>
            <div class="crm-doc-legal" style="margin-top:14px">${escapeHtml(doc.payment_terms || settings.payment_terms_default || "")}</div>
            <div class="crm-doc-legal" style="margin-top:14px">${legalBlockHtml(settings)}</div>
            ${kind === "quote" && doc.accepted ? `<div class="crm-doc-legal" style="margin-top:14px"><strong>Accepte par :</strong> ${escapeHtml(doc.accepted_name || "")}${doc.accepted_signature ? `<br/><strong>Signature :</strong> ${escapeHtml(doc.accepted_signature)}` : ""}</div>` : ""}
          </div>
          <div class="crm-doc-block">
            <h4>Recapitulatif</h4>
            <div class="crm-totals">${totalsRowsHtml(doc, kind)}</div>
          </div>
        </div>
      </div>
    `;
  }

  async function fetchAsDataUrl(url){
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result || ""));
      reader.onerror = ()=> reject(new Error("Chargement du logo impossible."));
      reader.readAsDataURL(blob);
    });
  }

  async function resolveLogoDataUrl(){
    const settings = state.settings || DEFAULT_SETTINGS;
    const raw = effectiveLogoUrl(settings);
    if(!raw) return "";
    if(raw.startsWith("data:")) return raw;
    const sbUrl = parseSbUrl(raw);
    if(sbUrl && sb){
      const { data, error } = await sb.storage.from(sbUrl.bucket).download(sbUrl.path);
      if(error) throw error;
      return new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = ()=> resolve(String(reader.result || ""));
        reader.onerror = ()=> reject(new Error("Lecture du logo impossible."));
        reader.readAsDataURL(data);
      });
    }
    return fetchAsDataUrl(raw);
  }

  async function buildPdfBlob(kind, rawDoc){
    const doc = kind === "quote" ? computeQuote(rawDoc) : computeInvoice(rawDoc);
    const settings = state.settings || DEFAULT_SETTINGS;
    const pdfCtor = window.jspdf?.jsPDF;
    if(typeof pdfCtor !== "function"){
      throw new Error("jsPDF non disponible.");
    }
    const pdf = new pdfCtor({ unit: "pt", format: "a4" });
    const margin = 42;
    const width = pdf.internal.pageSize.getWidth();
    const accent = String(settings.primary_color || "#111111").trim() || "#111111";

    pdf.setFillColor(accent);
    pdf.rect(0, 0, width, 18, "F");

    try{
      const logo = await resolveLogoDataUrl();
      if(logo){
        pdf.addImage(logo, "PNG", margin, 36, 72, 72, undefined, "FAST");
      }
    }catch(error){
      console.warn("[CRM] logo skipped", error);
    }

    pdf.setTextColor(20, 20, 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(kind === "quote" ? "DEVIS" : "FACTURE", margin, 54);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Numero : ${doc.number || "Automatique"}`, width - margin - 180, 42);
    pdf.text(`Date : ${fmtDate(doc.issue_date)}`, width - margin - 180, 58);
    pdf.text(`${kind === "quote" ? "Validite" : "Echeance"} : ${fmtDate(kind === "quote" ? doc.valid_until : doc.due_date)}`, width - margin - 180, 74);

    const companyLines = [
      settings.trade_name || settings.legal_name || APP_COMPANY,
      settings.address_line1 || "",
      settings.address_line2 || "",
      [settings.postal_code || "", settings.city || ""].filter(Boolean).join(" "),
      settings.country || "",
      settings.email || "",
      settings.phone || "",
      settings.siret ? `SIRET : ${settings.siret}` : "",
    ].filter(Boolean);

    const client = doc.client || state.clients.find((entry)=> entry.id === doc.client_id) || null;
    const clientLines = [
      clientDisplayName(client),
      client?.address_line1 || "",
      client?.address_line2 || "",
      [client?.postal_code || "", client?.city || ""].filter(Boolean).join(" "),
      client?.country || "",
      client?.email || "",
      client?.phone || "",
      client?.client_siret ? `SIRET : ${client.client_siret}` : "",
    ].filter(Boolean);

    pdf.setFont("helvetica", "bold");
    pdf.text("Votre entreprise", margin, 140);
    pdf.text("Client", width / 2 + 10, 140);
    pdf.setFont("helvetica", "normal");
    companyLines.forEach((line, index)=> pdf.text(line, margin, 158 + (index * 14)));
    clientLines.forEach((line, index)=> pdf.text(line, width / 2 + 10, 158 + (index * 14)));

    pdf.autoTable({
      startY: 276,
      margin: { left: margin, right: margin },
      head: [["Prestation", "Quantite", "Prix unitaire", "Total"]],
      body: (doc.items || []).map((item)=> ([
        `${item.title}${item.description ? `\n${item.description}` : ""}`,
        String(item.quantity),
        fmtMoney(item.unit_price || 0, settings.currency),
        fmtMoney(item.line_total || 0, settings.currency),
      ])),
      theme: "grid",
      headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 8, textColor: [25, 25, 25] },
      columnStyles: { 1: { halign: "center", cellWidth: 70 }, 2: { halign: "right", cellWidth: 110 }, 3: { halign: "right", cellWidth: 110 } },
    });

    let y = pdf.lastAutoTable.finalY + 22;
    pdf.setFont("helvetica", "bold");
    pdf.text("Recapitulatif", width - 210, y);
    y += 18;
    const totalRows = [
      ["Sous-total", fmtMoney(doc.subtotal_amount || 0, settings.currency)],
      ["Remise", fmtMoney(doc.discount_amount || 0, settings.currency)],
      [`TVA (${roundMoney(doc.vat_rate || 0)}%)`, fmtMoney(doc.vat_amount || 0, settings.currency)],
      ["Total TTC", fmtMoney(doc.total_amount || 0, settings.currency)],
      [kind === "quote" ? "Acompte" : "Regle", fmtMoney(kind === "quote" ? doc.deposit_amount || 0 : doc.amount_paid || 0, settings.currency)],
      [kind === "quote" ? "Reste a payer" : "Reste du", fmtMoney(doc.amount_due || 0, settings.currency)],
    ];
    pdf.setFont("helvetica", "normal");
    totalRows.forEach((row, index)=>{
      const isFinal = index === totalRows.length - 1;
      if(isFinal) pdf.setFont("helvetica", "bold");
      pdf.text(row[0], width - 210, y);
      pdf.text(row[1], width - margin, y, { align: "right" });
      y += isFinal ? 18 : 16;
      if(isFinal) pdf.setFont("helvetica", "normal");
    });

    y += 12;
    pdf.setFont("helvetica", "bold");
    pdf.text("Conditions", margin, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(doc.payment_terms || settings.payment_terms_default || "", width - (margin * 2)), margin, y);
    y += 34;
    pdf.text(pdf.splitTextToSize(doc.notes || settings.default_notes || "", width - (margin * 2)), margin, y);
    y += 48;
    const legalText = [settings.vat_note, settings.late_penalties, settings.recovery_indemnity].filter(Boolean).join("  |  ");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(legalText, width - (margin * 2)), margin, Math.min(y, 780));

    return pdf.output("blob");
  }

  function triggerBlobDownload(blob, filename, shouldPrint){
    const url = URL.createObjectURL(blob);
    const opened = shouldPrint ? window.open(url, "_blank", "noopener,noreferrer") : null;
    if(shouldPrint && opened){
      setTimeout(()=>{
        try{ opened.print(); }catch(error){ /* ignore */ }
      }, 900);
    }
    if(!shouldPrint){
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(()=> URL.revokeObjectURL(url), 60000);
  }

  async function storePdf(kind, doc, blob){
    if(!sb || !doc?.id) return doc;
    const path = `${slugify(APP_COMPANY) || "entreprise"}/crm/${kind === "quote" ? "devis" : "factures"}/${slugify(doc.number || `${kind}-${doc.id}`)}.pdf`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: "application/pdf",
    });
    if(error) throw error;
    const next = { ...doc, pdf_url: `sb://${STORAGE_BUCKET}/${path}`, pdf_path: path };
    return kind === "quote" ? repo.saveQuote(next) : repo.saveInvoice(next);
  }

  async function openStoredPdf(doc, shouldPrint){
    const sbUrl = parseSbUrl(doc?.pdf_url || "");
    if(!sbUrl || !sb){
      return false;
    }
    const { data, error } = await sb.storage.from(sbUrl.bucket).download(sbUrl.path);
    if(error) throw error;
    triggerBlobDownload(data, `${slugify(doc.number || "document")}.pdf`, shouldPrint);
    return true;
  }

  async function generatePdf(kind, doc, options){
    const blob = await buildPdfBlob(kind, doc);
    let nextDoc = doc;
    try{
      nextDoc = await storePdf(kind, doc, blob);
    }catch(error){
      console.warn("[CRM] pdf storage skipped", error);
      toast("PDF", "PDF genere localement. Stockage Supabase indisponible.");
    }
    triggerBlobDownload(blob, `${slugify(nextDoc.number || `${kind}-document`) || kind}.pdf`, !!options?.print);
    return nextDoc;
  }

  async function loadBaseCollections(){
    const [settings, clients, quotes, invoices] = await Promise.all([
      repo.getSettings(),
      repo.listClients(),
      repo.listQuotes(),
      repo.listInvoices(),
    ]);
    state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    state.clients = clients || [];
    state.quotes = quotes || [];
    state.invoices = invoices || [];
  }

  function findMarieClient(){
    return state.clients.find((client)=> slugify(clientDisplayName(client)).includes("marie-madeleine-gautier")) || null;
  }

  async function ensureMarieClient(){
    const existing = findMarieClient();
    if(existing) return existing;
    const created = await repo.saveClient({
      kind: "person",
      first_name: "Marie-Madeleine",
      last_name: "Gautier",
      display_name: "Marie-Madeleine Gautier",
      email: "contact@marie-madeleine.fr",
      country: "France",
      notes: "Client pre-rempli cree automatiquement depuis le CRM.",
    });
    state.clients = await repo.listClients();
    return created;
  }

  function renderDashboardPage(){
    const sentQuotes = state.quotes.filter((quote)=> quote.status === "sent" || quote.status === "pending");
    const paidInvoices = state.invoices.filter((invoice)=> invoiceEffectiveStatus(invoice) === "paid");
    const unpaidInvoices = state.invoices.filter((invoice)=> {
      const status = invoiceEffectiveStatus(invoice);
      return status !== "paid" && status !== "cancelled";
    });
    const revenue = state.invoices
      .filter((invoice)=> invoice.status !== "cancelled")
      .reduce((sum, invoice)=> sum + roundMoney(invoice.total_amount || 0), 0);

    const monthly = new Map();
    for(let i = 11; i >= 0; i -= 1){
      const date = new Date();
      date.setMonth(date.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, 0);
    }
    state.invoices.forEach((invoice)=>{
      if(invoice.status === "cancelled") return;
      const key = String(invoice.issue_date || "").slice(0, 7);
      if(monthly.has(key)){
        monthly.set(key, monthly.get(key) + roundMoney(invoice.total_amount || 0));
      }
    });
    const maxMonthly = Math.max(...Array.from(monthly.values()), 1);
    const monthlyBars = Array.from(monthly.entries()).map(([key, amount])=>{
      const height = Math.max(14, Math.round((amount / maxMonthly) * 180));
      const label = key.slice(5).replace("-", "/");
      return `<div class="crm-bar"><div class="crm-bar-fill" style="height:${height}px"></div><div class="crm-bar-label">${escapeHtml(label)}</div></div>`;
    }).join("");

    const recentClients = state.clients.slice(0, 5).map((client)=> `
      <div class="crm-list-card">
        <h3>${escapeHtml(clientDisplayName(client))}</h3>
        <p>${escapeHtml(client.email || client.phone || client.city || "Client recent")}</p>
      </div>
    `).join("");

    const quoteRows = state.quotes.slice(0, 5).map((quote)=> `
      <tr>
        <td><div class="row-title">${escapeHtml(quote.number)}</div><div class="row-meta">${escapeHtml(clientDisplayName(quote.client || {}))}</div></td>
        <td>${escapeHtml(fmtDate(quote.issue_date))}</td>
        <td>${statusBadge(quoteDisplayStatus(quote))}</td>
        <td>${escapeHtml(fmtMoney(quote.total_amount || 0, state.settings.currency))}</td>
      </tr>
    `).join("");

    const invoiceRows = state.invoices.slice(0, 5).map((invoice)=> `
      <tr>
        <td><div class="row-title">${escapeHtml(invoice.number)}</div><div class="row-meta">${escapeHtml(clientDisplayName(invoice.client || {}))}</div></td>
        <td>${escapeHtml(fmtDate(invoice.issue_date))}</td>
        <td>${statusBadge(invoiceEffectiveStatus(invoice))}</td>
        <td>${escapeHtml(fmtMoney(invoice.amount_due || 0, state.settings.currency))}</td>
      </tr>
    `).join("");

    root.innerHTML = `
      <section class="crm-panel crm-hero">
        <div class="crm-kicker">Business digital</div>
        <h1>CRM freelance premium pour devis, factures et suivi client.</h1>
        <p>Le flux est optimise pour la creation rapide, la numerotation automatique, les calculs et la generation de PDF propres.</p>
        <div class="crm-actions">
          <a class="btn primary" href="crm-quote.html">Nouveau devis</a>
          <a class="btn crm-btn-quiet" href="crm-invoice.html">Nouvelle facture</a>
          <button class="btn crm-btn-quiet" type="button" id="crmDashboardSeed">Importer des exemples</button>
          <button class="btn crm-btn-quiet" type="button" id="crmDashboardMarie">Devis Marie-Madeleine Gautier</button>
        </div>
      </section>

      <section class="crm-grid cols-4">
        <article class="crm-stat"><div class="crm-stat-label">Devis</div><div class="crm-stat-value">${state.quotes.length}</div><div class="crm-stat-sub">${sentQuotes.length} en attente ou envoyes</div></article>
        <article class="crm-stat"><div class="crm-stat-label">Factures</div><div class="crm-stat-value">${state.invoices.length}</div><div class="crm-stat-sub">${paidInvoices.length} reglees, ${unpaidInvoices.length} a suivre</div></article>
        <article class="crm-stat"><div class="crm-stat-label">CA total</div><div class="crm-stat-value">${escapeHtml(fmtMoney(revenue, state.settings.currency))}</div><div class="crm-stat-sub">Total facture hors annulations</div></article>
        <article class="crm-stat"><div class="crm-stat-label">Clients</div><div class="crm-stat-value">${state.clients.length}</div><div class="crm-stat-sub">Entreprises et particuliers actifs</div></article>
      </section>

      <section class="crm-grid cols-2">
        <article class="crm-panel">
          <div class="crm-inline" style="justify-content:space-between">
            <div>
              <div class="crm-kicker">Chiffre d'affaires</div>
              <h2 class="crm-title" style="font-size:28px">12 mois glissants</h2>
            </div>
            <a class="btn crm-btn-quiet" href="crm-invoices.html">Voir les factures</a>
          </div>
          <div class="crm-chart"><div class="crm-bars">${monthlyBars}</div></div>
        </article>
        <article class="crm-panel">
          <div class="crm-inline" style="justify-content:space-between">
            <div>
              <div class="crm-kicker">Clients recents</div>
              <h2 class="crm-title" style="font-size:28px">Base clients</h2>
            </div>
            <a class="btn crm-btn-quiet" href="crm-clients.html">Gerer</a>
          </div>
          <div class="crm-list">${recentClients || `<div class="crm-empty">Aucun client pour le moment.</div>`}</div>
        </article>
      </section>

      <section class="crm-grid cols-2">
        <article class="crm-panel">
          <div class="crm-inline" style="justify-content:space-between">
            <div><div class="crm-kicker">Derniers devis</div><h2 class="crm-title" style="font-size:28px">Pipeline commercial</h2></div>
            <a class="btn crm-btn-quiet" href="crm-quotes.html">Tous les devis</a>
          </div>
          <div class="crm-table-wrap">
            <table class="crm-table"><thead><tr><th>Devis</th><th>Date</th><th>Statut</th><th>Total</th></tr></thead><tbody>${quoteRows || `<tr><td colspan="4">Aucun devis.</td></tr>`}</tbody></table>
          </div>
        </article>
        <article class="crm-panel">
          <div class="crm-inline" style="justify-content:space-between">
            <div><div class="crm-kicker">Dernieres factures</div><h2 class="crm-title" style="font-size:28px">Encaissements</h2></div>
            <a class="btn crm-btn-quiet" href="crm-invoices.html">Toutes les factures</a>
          </div>
          <div class="crm-table-wrap">
            <table class="crm-table"><thead><tr><th>Facture</th><th>Date</th><th>Statut</th><th>Reste du</th></tr></thead><tbody>${invoiceRows || `<tr><td colspan="4">Aucune facture.</td></tr>`}</tbody></table>
          </div>
        </article>
      </section>
    `;

    $("#crmDashboardSeed", root)?.addEventListener("click", async ()=>{
      try{
        const result = await repo.seedDemoData();
        if(result?.ok === false && result?.message === "already_seeded"){
          toast("Exemples", "Des donnees existent deja.");
          return;
        }
        await loadBaseCollections();
        renderDashboardPage();
        toast("Exemples", "Donnees d'exemple importees.");
      }catch(error){
        showFatal(error);
      }
    });

    $("#crmDashboardMarie", root)?.addEventListener("click", async ()=>{
      const marie = await ensureMarieClient();
      window.location.href = `crm-quote.html?client=${encodeURIComponent(marie.id)}`;
    });
  }

  function openClientModal(client, afterSave){
    const current = normalizeClient(client || {});
    const overlay = document.createElement("div");
    overlay.className = "crm-modal";
    overlay.innerHTML = `
      <div class="crm-modal-card">
        <div class="crm-inline" style="justify-content:space-between; margin-bottom:16px">
          <div>
            <div class="crm-kicker">${current.id && client ? "Edition" : "Nouveau client"}</div>
            <h2 class="crm-title" style="font-size:28px">${current.id && client ? "Modifier le client" : "Ajouter un client"}</h2>
          </div>
          <button class="btn crm-btn-quiet" type="button" data-close>Fermer</button>
        </div>
        <section class="crm-form-section" style="margin-bottom:16px">
          <h3>Exemples de fiches client</h3>
          <p>Utilise un modele realiste puis ajuste simplement le nom, l'email, l'adresse ou les notes.</p>
          <div class="crm-example-grid">${clientExampleCardsHtml()}</div>
        </section>
        <form class="crm-form" id="crmClientForm">
          <div class="crm-grid cols-2">
            <div class="crm-field"><label>Type</label><select name="kind"><option value="business"${current.kind === "business" ? " selected" : ""}>Entreprise</option><option value="person"${current.kind === "person" ? " selected" : ""}>Particulier</option></select></div>
            <div class="crm-field"><label>Nom affiche</label><input name="display_name" value="${escapeHtml(current.display_name)}" placeholder="Ex : Studio Horizon ou Marie-Madeleine Gautier" required/></div>
          </div>
          <div class="crm-grid cols-3">
            <div class="crm-field"><label>Prenom</label><input name="first_name" value="${escapeHtml(current.first_name)}" placeholder="Ex : Claire"/></div>
            <div class="crm-field"><label>Nom</label><input name="last_name" value="${escapeHtml(current.last_name)}" placeholder="Ex : Durand"/></div>
            <div class="crm-field"><label>Entreprise</label><input name="company_name" value="${escapeHtml(current.company_name)}" placeholder="Ex : Studio Horizon"/></div>
          </div>
          <div class="crm-grid cols-3">
            <div class="crm-field"><label>Email</label><input name="email" type="email" value="${escapeHtml(current.email)}" placeholder="Ex : hello@studio-horizon.fr"/></div>
            <div class="crm-field"><label>Telephone</label><input name="phone" value="${escapeHtml(current.phone)}" placeholder="Ex : +33 6 11 22 33 44"/></div>
            <div class="crm-field"><label>SIRET client</label><input name="client_siret" value="${escapeHtml(current.client_siret)}" placeholder="Ex : 80123456700017"/></div>
          </div>
          <div class="crm-grid cols-2">
            <div class="crm-field"><label>Adresse</label><input name="address_line1" value="${escapeHtml(current.address_line1)}" placeholder="Ex : 48 avenue des Createurs"/></div>
            <div class="crm-field"><label>Complement</label><input name="address_line2" value="${escapeHtml(current.address_line2)}" placeholder="Ex : Batiment B - Bureau 12"/></div>
          </div>
          <div class="crm-grid cols-3">
            <div class="crm-field"><label>Code postal</label><input name="postal_code" value="${escapeHtml(current.postal_code)}" placeholder="Ex : 69002"/></div>
            <div class="crm-field"><label>Ville</label><input name="city" value="${escapeHtml(current.city)}" placeholder="Ex : Lyon"/></div>
            <div class="crm-field"><label>Pays</label><input name="country" value="${escapeHtml(current.country)}" placeholder="France"/></div>
          </div>
          <div class="crm-field"><label>Notes</label><textarea name="notes" placeholder="Ex : contact principal, delai de validation, infos de facturation, contraintes de planning">${escapeHtml(current.notes)}</textarea></div>
          <div class="crm-actions">
            <button class="btn primary" type="submit">Enregistrer</button>
            <button class="btn crm-btn-quiet" type="button" data-close>Annuler</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelectorAll("[data-close]").forEach((button)=> button.addEventListener("click", ()=> overlay.remove()));
    overlay.addEventListener("click", (event)=>{
      if(event.target === overlay) overlay.remove();
    });
    overlay.querySelectorAll("[data-client-example]").forEach((button)=> button.addEventListener("click", ()=>{
      applyClientExample($("#crmClientForm", overlay), button.getAttribute("data-client-example"));
    }));
    $("#crmClientForm", overlay)?.addEventListener("submit", async (event)=>{
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const payload = {
        ...current,
        id: client?.id || "",
        kind: String(form.get("kind") || "business"),
        display_name: String(form.get("display_name") || "").trim(),
        first_name: String(form.get("first_name") || "").trim(),
        last_name: String(form.get("last_name") || "").trim(),
        company_name: String(form.get("company_name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        client_siret: String(form.get("client_siret") || "").trim(),
        address_line1: String(form.get("address_line1") || "").trim(),
        address_line2: String(form.get("address_line2") || "").trim(),
        postal_code: String(form.get("postal_code") || "").trim(),
        city: String(form.get("city") || "").trim(),
        country: String(form.get("country") || "").trim() || "France",
        notes: String(form.get("notes") || "").trim(),
      };
      if(!payload.display_name){
        toast("Client", "Le nom affiche est obligatoire.");
        return;
      }
      try{
        const savedClient = await repo.saveClient(payload);
        state.clients = await repo.listClients();
        overlay.remove();
        if(typeof afterSave === "function"){
          await afterSave(savedClient);
        }else{
          renderClientsPage();
        }
        toast("Client", "Fiche client enregistree.");
      }catch(error){
        toast("Client", errorMessage(error));
      }
    });
  }

  function renderClientsPage(){
    const search = slugify(state.listFilters.search || "");
    const filtered = state.clients.filter((client)=>{
      if(!search) return true;
      return slugify([
        clientDisplayName(client),
        client.email,
        client.phone,
        client.city,
        client.client_siret,
      ].join(" ")).includes(search);
    });
    const rows = filtered.map((client)=> `
      <tr>
        <td><div class="row-title">${escapeHtml(clientDisplayName(client))}</div><div class="row-meta">${escapeHtml(client.kind === "business" ? (client.company_name || "Entreprise") : "Particulier")}</div></td>
        <td>${escapeHtml(client.email || "-")}</td>
        <td>${escapeHtml(client.phone || "-")}</td>
        <td>${escapeHtml([client.postal_code || "", client.city || ""].filter(Boolean).join(" ") || "-")}</td>
        <td>
          <div class="crm-actions">
            <button class="btn small crm-btn-quiet" type="button" data-edit="${escapeHtml(client.id)}">Modifier</button>
            <button class="btn small crm-btn-quiet" type="button" data-quote="${escapeHtml(client.id)}">Nouveau devis</button>
            <button class="btn small crm-btn-quiet" type="button" data-delete="${escapeHtml(client.id)}">Supprimer</button>
          </div>
        </td>
      </tr>
    `).join("");
    root.innerHTML = `
      <section class="crm-panel crm-hero">
        <div class="crm-kicker">Clients</div>
        <h1>Base clients centralisee avec creation rapide et recherche immediate.</h1>
        <p>Chaque fiche stocke les coordonnees, l'adresse, le SIRET client et les notes utiles avant emission d'un devis ou d'une facture.</p>
      </section>

      <section class="crm-panel">
        <div class="crm-toolbar" style="justify-content:space-between">
          <div class="crm-inline">
            <input class="input" id="crmClientSearch" placeholder="Rechercher un client" value="${escapeHtml(state.listFilters.search || "")}" style="min-width:260px"/>
          </div>
          <div class="crm-actions">
            <button class="btn crm-btn-quiet" type="button" id="crmClientExport">Exporter CSV</button>
            <button class="btn primary" type="button" id="crmClientNew">Ajouter un client</button>
          </div>
        </div>
        <div class="crm-table-wrap" style="margin-top:16px">
          <table class="crm-table">
            <thead><tr><th>Client</th><th>Email</th><th>Telephone</th><th>Ville</th><th>Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">Aucun client.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;

    $("#crmClientSearch", root)?.addEventListener("input", (event)=>{
      state.listFilters.search = String(event.target.value || "");
      renderClientsPage();
    });
    $("#crmClientNew", root)?.addEventListener("click", ()=> openClientModal(null));
    $("#crmClientExport", root)?.addEventListener("click", ()=>{
      exportCsv("clients.csv", [
        ["Nom", "Email", "Telephone", "Adresse", "SIRET", "Notes"],
        ...filtered.map((client)=> [
          clientDisplayName(client),
          client.email || "",
          client.phone || "",
          clientAddress(client).replaceAll("\n", ", "),
          client.client_siret || "",
          client.notes || "",
        ]),
      ]);
    });
    root.querySelectorAll("[data-edit]").forEach((button)=>{
      button.addEventListener("click", ()=>{
        const client = state.clients.find((entry)=> entry.id === button.getAttribute("data-edit"));
        openClientModal(client || null);
      });
    });
    root.querySelectorAll("[data-quote]").forEach((button)=>{
      button.addEventListener("click", ()=>{
        window.location.href = `crm-quote.html?client=${encodeURIComponent(button.getAttribute("data-quote"))}`;
      });
    });
    root.querySelectorAll("[data-delete]").forEach((button)=>{
      button.addEventListener("click", async ()=>{
        const id = button.getAttribute("data-delete");
        const client = state.clients.find((entry)=> entry.id === id);
        if(!window.confirm(`Supprimer ${clientDisplayName(client)} ?`)) return;
        try{
          await repo.deleteClient(id);
          state.clients = await repo.listClients();
          renderClientsPage();
          toast("Client", "Client supprime.");
        }catch(error){
          toast("Client", errorMessage(error));
        }
      });
    });

    if(PARAMS.get("action") === "new"){
      openClientModal(null);
    }
  }

  function buildQuoteFilters(quotes){
    const search = slugify(state.listFilters.search || "");
    return quotes.filter((quote)=>{
      const status = quoteDisplayStatus(quote);
      if(state.listFilters.status && status !== state.listFilters.status) return false;
      if(state.listFilters.clientId && quote.client_id !== state.listFilters.clientId) return false;
      if(!search) return true;
      return slugify([
        quote.number,
        quote.title,
        clientDisplayName(quote.client || {}),
        quote.notes,
      ].join(" ")).includes(search);
    });
  }

  function renderQuotesPage(){
    const filtered = buildQuoteFilters(state.quotes);
    const clientOptions = state.clients.map((client)=> `<option value="${escapeHtml(client.id)}"${state.listFilters.clientId === client.id ? " selected" : ""}>${escapeHtml(clientDisplayName(client))}</option>`).join("");
    const rows = filtered.map((quote)=> `
      <tr>
        <td><div class="row-title">${escapeHtml(quote.number)}</div><div class="row-meta">${escapeHtml(quote.title || clientDisplayName(quote.client || {}))}</div></td>
        <td>${escapeHtml(clientDisplayName(quote.client || {}))}</td>
        <td>${escapeHtml(fmtDate(quote.issue_date))}</td>
        <td>${statusBadge(quoteDisplayStatus(quote))}</td>
        <td>${escapeHtml(fmtMoney(quote.total_amount || 0, state.settings.currency))}</td>
        <td>
          <div class="crm-actions">
            <a class="btn small crm-btn-quiet" href="crm-quote.html?id=${encodeURIComponent(quote.id)}">Ouvrir</a>
            <button class="btn small crm-btn-quiet" type="button" data-pdf="${escapeHtml(quote.id)}">PDF</button>
            <button class="btn small crm-btn-quiet" type="button" data-convert="${escapeHtml(quote.id)}">Transformer</button>
            <button class="btn small crm-btn-quiet" type="button" data-duplicate="${escapeHtml(quote.id)}">Dupliquer</button>
            <button class="btn small crm-btn-quiet" type="button" data-delete="${escapeHtml(quote.id)}">Supprimer</button>
          </div>
        </td>
      </tr>
    `).join("");

    root.innerHTML = `
      <section class="crm-panel crm-hero">
        <div class="crm-kicker">Devis</div>
        <h1>Creation, suivi, conversion en facture et PDF en un seul flux.</h1>
        <p>Les numeros sont generes automatiquement et l'historique reste propre, sans doublons, sur toute l'annee.</p>
      </section>

      <section class="crm-panel">
        <div class="crm-toolbar" style="justify-content:space-between">
          <div class="crm-filterbar">
            <input class="input" id="crmQuoteSearch" placeholder="Recherche texte" value="${escapeHtml(state.listFilters.search || "")}" style="min-width:220px"/>
            <select class="input" id="crmQuoteStatus"><option value="">Tous statuts</option><option value="draft">Brouillon</option><option value="sent">Envoye</option><option value="accepted">Accepte</option><option value="expired">Expire</option><option value="converted">Transforme</option></select>
            <select class="input" id="crmQuoteClient"><option value="">Tous clients</option>${clientOptions}</select>
          </div>
          <div class="crm-actions">
            <button class="btn crm-btn-quiet" type="button" id="crmQuoteExport">Exporter CSV</button>
            <a class="btn primary" href="crm-quote.html">Nouveau devis</a>
          </div>
        </div>
        <div class="crm-table-wrap" style="margin-top:16px">
          <table class="crm-table">
            <thead><tr><th>Devis</th><th>Client</th><th>Date</th><th>Statut</th><th>Total</th><th>Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6">Aucun devis.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;

    $("#crmQuoteStatus", root).value = state.listFilters.status || "";
    $("#crmQuoteSearch", root)?.addEventListener("input", (event)=>{
      state.listFilters.search = String(event.target.value || "");
      renderQuotesPage();
    });
    $("#crmQuoteStatus", root)?.addEventListener("change", (event)=>{
      state.listFilters.status = String(event.target.value || "");
      renderQuotesPage();
    });
    $("#crmQuoteClient", root)?.addEventListener("change", (event)=>{
      state.listFilters.clientId = String(event.target.value || "");
      renderQuotesPage();
    });
    $("#crmQuoteExport", root)?.addEventListener("click", ()=>{
      exportCsv("devis.csv", [
        ["Numero", "Client", "Date", "Statut", "Total", "Notes"],
        ...filtered.map((quote)=> [
          quote.number,
          clientDisplayName(quote.client || {}),
          fmtDate(quote.issue_date),
          statusLabel(quoteDisplayStatus(quote)),
          fmtMoney(quote.total_amount || 0, state.settings.currency),
          quote.notes || "",
        ]),
      ]);
    });
    root.querySelectorAll("[data-pdf]").forEach((button)=> button.addEventListener("click", async ()=>{
      const quote = state.quotes.find((entry)=> entry.id === button.getAttribute("data-pdf"));
      if(!quote) return;
      try{
        if(quote.pdf_url && await openStoredPdf(quote, false)) return;
      }catch(error){
        console.warn(error);
      }
      const next = await generatePdf("quote", quote, { print: false });
      if(next?.id){
        state.quotes = await repo.listQuotes();
        renderQuotesPage();
      }
    }));
    root.querySelectorAll("[data-convert]").forEach((button)=> button.addEventListener("click", async ()=>{
      try{
        const invoice = await repo.convertQuoteToInvoice(button.getAttribute("data-convert"), { issue_date: TODAY(), due_date: addDays(TODAY(), 30), status: "draft" });
        toast("Facture", "Devis transforme en facture.");
        window.location.href = `crm-invoice.html?id=${encodeURIComponent(invoice.id)}`;
      }catch(error){
        toast("Facture", errorMessage(error));
      }
    }));
    root.querySelectorAll("[data-duplicate]").forEach((button)=> button.addEventListener("click", async ()=>{
      const cloneDoc = await repo.duplicateQuote(button.getAttribute("data-duplicate"));
      window.location.href = `crm-quote.html?id=${encodeURIComponent(cloneDoc.id)}`;
    }));
    root.querySelectorAll("[data-delete]").forEach((button)=> button.addEventListener("click", async ()=>{
      if(!window.confirm("Supprimer ce devis ?")) return;
      await repo.deleteQuote(button.getAttribute("data-delete"));
      state.quotes = await repo.listQuotes();
      renderQuotesPage();
      toast("Devis", "Devis supprime.");
    }));
  }

  function buildInvoiceFilters(invoices){
    const search = slugify(state.listFilters.search || "");
    return invoices.filter((invoice)=>{
      const status = invoiceEffectiveStatus(invoice);
      if(state.listFilters.status && status !== state.listFilters.status) return false;
      if(state.listFilters.clientId && invoice.client_id !== state.listFilters.clientId) return false;
      if(!search) return true;
      return slugify([
        invoice.number,
        invoice.title,
        clientDisplayName(invoice.client || {}),
        invoice.notes,
      ].join(" ")).includes(search);
    });
  }

  function renderInvoicesPage(){
    const filtered = buildInvoiceFilters(state.invoices);
    const clientOptions = state.clients.map((client)=> `<option value="${escapeHtml(client.id)}"${state.listFilters.clientId === client.id ? " selected" : ""}>${escapeHtml(clientDisplayName(client))}</option>`).join("");
    const rows = filtered.map((invoice)=> `
      <tr>
        <td><div class="row-title">${escapeHtml(invoice.number)}</div><div class="row-meta">${escapeHtml(invoice.title || clientDisplayName(invoice.client || {}))}</div></td>
        <td>${escapeHtml(clientDisplayName(invoice.client || {}))}</td>
        <td>${escapeHtml(fmtDate(invoice.issue_date))}</td>
        <td>${statusBadge(invoiceEffectiveStatus(invoice))}</td>
        <td>${escapeHtml(fmtMoney(invoice.amount_due || 0, state.settings.currency))}</td>
        <td>
          <div class="crm-actions">
            <a class="btn small crm-btn-quiet" href="crm-invoice.html?id=${encodeURIComponent(invoice.id)}">Ouvrir</a>
            <button class="btn small crm-btn-quiet" type="button" data-pdf="${escapeHtml(invoice.id)}">PDF</button>
            <button class="btn small crm-btn-quiet" type="button" data-print="${escapeHtml(invoice.id)}">Imprimer</button>
            <button class="btn small crm-btn-quiet" type="button" data-duplicate="${escapeHtml(invoice.id)}">Dupliquer</button>
            <button class="btn small crm-btn-quiet" type="button" data-delete="${escapeHtml(invoice.id)}">Supprimer</button>
          </div>
        </td>
      </tr>
    `).join("");

    root.innerHTML = `
      <section class="crm-panel crm-hero">
        <div class="crm-kicker">Factures</div>
        <h1>Facturation, suivi des paiements et impression professionnelle.</h1>
        <p>Chaque facture suit son echeance, son montant regle, son reste du et son PDF telechargeable ou imprimable.</p>
      </section>
      <section class="crm-panel">
        <div class="crm-toolbar" style="justify-content:space-between">
          <div class="crm-filterbar">
            <input class="input" id="crmInvoiceSearch" placeholder="Recherche texte" value="${escapeHtml(state.listFilters.search || "")}" style="min-width:220px"/>
            <select class="input" id="crmInvoiceStatus"><option value="">Tous statuts</option><option value="draft">Brouillon</option><option value="sent">Envoyee</option><option value="paid">Payee</option><option value="overdue">En retard</option><option value="cancelled">Annulee</option></select>
            <select class="input" id="crmInvoiceClient"><option value="">Tous clients</option>${clientOptions}</select>
          </div>
          <div class="crm-actions">
            <button class="btn crm-btn-quiet" type="button" id="crmInvoiceExport">Exporter CSV</button>
            <a class="btn primary" href="crm-invoice.html">Nouvelle facture</a>
          </div>
        </div>
        <div class="crm-table-wrap" style="margin-top:16px">
          <table class="crm-table">
            <thead><tr><th>Facture</th><th>Client</th><th>Date</th><th>Statut</th><th>Reste du</th><th>Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6">Aucune facture.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    `;

    $("#crmInvoiceStatus", root).value = state.listFilters.status || "";
    $("#crmInvoiceSearch", root)?.addEventListener("input", (event)=>{
      state.listFilters.search = String(event.target.value || "");
      renderInvoicesPage();
    });
    $("#crmInvoiceStatus", root)?.addEventListener("change", (event)=>{
      state.listFilters.status = String(event.target.value || "");
      renderInvoicesPage();
    });
    $("#crmInvoiceClient", root)?.addEventListener("change", (event)=>{
      state.listFilters.clientId = String(event.target.value || "");
      renderInvoicesPage();
    });
    $("#crmInvoiceExport", root)?.addEventListener("click", ()=>{
      exportCsv("factures.csv", [
        ["Numero", "Client", "Date", "Statut", "Total TTC", "Reste du"],
        ...filtered.map((invoice)=> [
          invoice.number,
          clientDisplayName(invoice.client || {}),
          fmtDate(invoice.issue_date),
          statusLabel(invoiceEffectiveStatus(invoice)),
          fmtMoney(invoice.total_amount || 0, state.settings.currency),
          fmtMoney(invoice.amount_due || 0, state.settings.currency),
        ]),
      ]);
    });
    root.querySelectorAll("[data-pdf]").forEach((button)=> button.addEventListener("click", async ()=>{
      const invoice = state.invoices.find((entry)=> entry.id === button.getAttribute("data-pdf"));
      if(!invoice) return;
      try{
        if(invoice.pdf_url && await openStoredPdf(invoice, false)) return;
      }catch(error){
        console.warn(error);
      }
      await generatePdf("invoice", invoice, { print: false });
      state.invoices = await repo.listInvoices();
      renderInvoicesPage();
    }));
    root.querySelectorAll("[data-print]").forEach((button)=> button.addEventListener("click", async ()=>{
      const invoice = state.invoices.find((entry)=> entry.id === button.getAttribute("data-print"));
      if(!invoice) return;
      try{
        if(invoice.pdf_url && await openStoredPdf(invoice, true)) return;
      }catch(error){
        console.warn(error);
      }
      await generatePdf("invoice", invoice, { print: true });
      state.invoices = await repo.listInvoices();
      renderInvoicesPage();
    }));
    root.querySelectorAll("[data-duplicate]").forEach((button)=> button.addEventListener("click", async ()=>{
      const cloneDoc = await repo.duplicateInvoice(button.getAttribute("data-duplicate"));
      window.location.href = `crm-invoice.html?id=${encodeURIComponent(cloneDoc.id)}`;
    }));
    root.querySelectorAll("[data-delete]").forEach((button)=> button.addEventListener("click", async ()=>{
      if(!window.confirm("Supprimer cette facture ?")) return;
      await repo.deleteInvoice(button.getAttribute("data-delete"));
      state.invoices = await repo.listInvoices();
      renderInvoicesPage();
      toast("Facture", "Facture supprimee.");
    }));
  }

  function clientOptionsHtml(selectedId){
    return state.clients.map((client)=> `
      <option value="${escapeHtml(client.id)}"${String(selectedId || "") === client.id ? " selected" : ""}>${escapeHtml(clientDisplayName(client))}</option>
    `).join("");
  }

  function quoteItemsHtml(items){
    return (items || []).map((item, index)=> `
      <div class="crm-item" data-index="${index}">
        <div class="crm-item-head">
          <strong>Ligne ${index + 1}</strong>
          <button class="btn small crm-btn-quiet" type="button" data-remove-item="${index}">Retirer</button>
        </div>
        <div class="crm-item-grid">
          <div class="crm-field"><label>Titre</label><input data-item="title" value="${escapeHtml(item.title)}" placeholder="Ex : Creation page d'accueil sur-mesure"/></div>
          <div class="crm-field"><label>Description</label><input data-item="description" value="${escapeHtml(item.description)}" placeholder="Ex : maquettage, integration responsive, ajustements et livraison"/></div>
          <div class="crm-field"><label>Quantite</label><input data-item="quantity" type="number" step="0.01" min="0" value="${escapeHtml(item.quantity)}"/></div>
          <div class="crm-field"><label>Prix unitaire</label><input data-item="unit_price" type="number" step="0.01" min="0" value="${escapeHtml(item.unit_price)}"/></div>
          <div class="crm-field"><label>Total ligne</label><input value="${escapeHtml(fmtMoney(item.line_total || 0, state.settings.currency))}" disabled/></div>
        </div>
      </div>
    `).join("");
  }

  function collectQuoteFormData(){
    const form = $("#crmQuoteForm", root);
    const items = Array.from(root.querySelectorAll("[data-index]")).map((node, index)=> normalizeItem({
      title: node.querySelector("[data-item='title']")?.value || "",
      description: node.querySelector("[data-item='description']")?.value || "",
      quantity: node.querySelector("[data-item='quantity']")?.value || 0,
      unit_price: node.querySelector("[data-item='unit_price']")?.value || 0,
    }, index));
    const next = computeQuote({
      ...(state.quoteForm || baseQuote(state.settings)),
      id: state.quoteForm?.id || "",
      title: form.querySelector("[name='title']")?.value || "",
      client_id: form.querySelector("[name='client_id']")?.value || "",
      issue_date: form.querySelector("[name='issue_date']")?.value || TODAY(),
      valid_until: form.querySelector("[name='valid_until']")?.value || addDays(TODAY(), 30),
      status: form.querySelector("[name='status']")?.value || "draft",
      payment_terms: form.querySelector("[name='payment_terms']")?.value || "",
      notes: form.querySelector("[name='notes']")?.value || "",
      discount_type: form.querySelector("[name='discount_type']")?.value || "none",
      discount_value: form.querySelector("[name='discount_value']")?.value || 0,
      deposit_amount: form.querySelector("[name='deposit_amount']")?.value || 0,
      vat_rate: form.querySelector("[name='vat_rate']")?.value || 0,
      accepted: !!form.querySelector("[name='accepted']")?.checked,
      accepted_name: form.querySelector("[name='accepted_name']")?.value || "",
      accepted_signature: form.querySelector("[name='accepted_signature']")?.value || "",
      items,
      client: state.clients.find((client)=> client.id === (form.querySelector("[name='client_id']")?.value || "")) || null,
    });
    state.quoteForm = next;
    return next;
  }

  function refreshQuotePanels(){
    const doc = collectQuoteFormData();
    $("#crmQuoteTotals", root).innerHTML = totalsRowsHtml(doc, "quote");
    $("#crmQuotePreview", root).innerHTML = renderDocumentPreview("quote", doc);
  }

  function renderQuoteEditorPage(){
    const quote = state.quoteForm || baseQuote(state.settings);
    const linkedBanner = quote.converted_invoice_id ? `
      <section class="crm-banner">
        <div><strong>Ce devis est deja lie a une facture.</strong><div class="crm-muted">Lien conserve avec la facture creee depuis ce devis.</div></div>
        <a class="btn crm-btn-quiet" href="crm-invoice.html?id=${encodeURIComponent(quote.converted_invoice_id)}">Ouvrir la facture</a>
      </section>
    ` : "";

    root.innerHTML = `
      ${linkedBanner}
      <div class="crm-split">
        <section class="crm-main">
          <section class="crm-panel crm-hero">
            <div class="crm-kicker">${quote.id ? "Edition devis" : "Nouveau devis"}</div>
            <h1>${escapeHtml(quote.number || "Devis auto")} pour une activite freelance premium.</h1>
            <p>Le calcul des lignes, remises, TVA, acompte et total final est instantane. Les PDF et la conversion en facture restent disponibles depuis cette vue.</p>
            <div class="crm-actions">
              <button class="btn primary" type="button" id="crmQuoteSaveDraft">Enregistrer brouillon</button>
              <button class="btn crm-btn-quiet" type="button" id="crmQuoteSend">Marquer envoye</button>
              <button class="btn crm-btn-quiet" type="button" id="crmQuotePdf">Generer PDF</button>
              <button class="btn crm-btn-quiet" type="button" id="crmQuoteConvert">Transformer en facture</button>
              <button class="btn crm-btn-quiet" type="button" id="crmQuoteDuplicate"${quote.id ? "" : " disabled"}>Dupliquer</button>
            </div>
          </section>

          <form class="crm-form" id="crmQuoteForm">
            <section class="crm-form-section">
              <h2>Exemples prets a remplir</h2>
              <p>Choisis un modele de devis, puis remplace seulement le client, les montants ou les notes si necessaire.</p>
              <div class="crm-example-grid">${quoteExampleCardsHtml()}</div>
            </section>

            <section class="crm-form-section">
              <h2>Client et cadre</h2>
              <p>Selection rapide d'un client existant ou creation immediate depuis le devis.</p>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Client</label><select name="client_id"><option value="">Choisir un client</option>${clientOptionsHtml(quote.client_id)}</select></div>
                <div class="crm-field"><label>Titre du devis</label><input name="title" value="${escapeHtml(quote.title)}" placeholder="Ex : Creation site vitrine + accompagnement digital"/></div>
              </div>
              <div class="crm-actions">
                <button class="btn crm-btn-quiet" type="button" id="crmQuoteNewClient">Creer un client</button>
                <button class="btn crm-btn-quiet" type="button" id="crmQuoteMarie">Client Marie-Madeleine Gautier</button>
              </div>
              <div class="crm-grid cols-3" style="margin-top:14px">
                <div class="crm-field"><label>Numero</label><input value="${escapeHtml(quote.number || "Automatique")}" disabled/></div>
                <div class="crm-field"><label>Date</label><input name="issue_date" type="date" value="${escapeHtml(quote.issue_date)}"/></div>
                <div class="crm-field"><label>Validite</label><input name="valid_until" type="date" value="${escapeHtml(quote.valid_until)}"/></div>
              </div>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label>Statut</label><select name="status"><option value="draft"${quote.status === "draft" ? " selected" : ""}>Brouillon</option><option value="sent"${quote.status === "sent" ? " selected" : ""}>Envoye</option><option value="pending"${quote.status === "pending" ? " selected" : ""}>En attente</option><option value="accepted"${quote.status === "accepted" ? " selected" : ""}>Accepte</option><option value="rejected"${quote.status === "rejected" ? " selected" : ""}>Refuse</option></select></div>
                <div class="crm-field"><label>Remise</label><select name="discount_type"><option value="none"${quote.discount_type === "none" ? " selected" : ""}>Aucune</option><option value="percent"${quote.discount_type === "percent" ? " selected" : ""}>Pourcentage</option><option value="fixed"${quote.discount_type === "fixed" ? " selected" : ""}>Montant fixe</option></select></div>
                <div class="crm-field"><label>Valeur remise</label><input name="discount_value" type="number" min="0" step="0.01" value="${escapeHtml(quote.discount_value)}" placeholder="Ex : 10 pour 10% ou 150 pour 150 EUR"/></div>
              </div>
            </section>

            <section class="crm-form-section">
              <h2>Lignes de prestation</h2>
              <p>Ajoute, retire ou modifie les lignes pour construire automatiquement le devis.</p>
              <div class="crm-items" id="crmQuoteItems">${quoteItemsHtml(quote.items)}</div>
              <div class="crm-actions"><button class="btn crm-btn-quiet" type="button" id="crmQuoteAddItem">Ajouter une ligne</button></div>
            </section>

            <section class="crm-form-section">
              <h2>Conditions et acceptation</h2>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label>TVA (%)</label><input name="vat_rate" type="number" min="0" step="0.01" value="${escapeHtml(quote.vat_rate)}"/></div>
                <div class="crm-field"><label>Acompte</label><input name="deposit_amount" type="number" min="0" step="0.01" value="${escapeHtml(quote.deposit_amount)}"/></div>
                <div class="crm-field"><label>Conditions de paiement</label><input name="payment_terms" value="${escapeHtml(quote.payment_terms)}" placeholder="Ex : acompte de 40% a la commande, solde a la livraison"/></div>
              </div>
              <div class="crm-field"><label>Notes</label><textarea name="notes" placeholder="Ex : delai estime, nombre d'allers-retours inclus, livrables prevus, exclusions">${escapeHtml(quote.notes)}</textarea></div>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label><input name="accepted" type="checkbox"${quote.accepted ? " checked" : ""} style="width:auto;min-height:auto;margin-right:8px"/>Devis accepte</label></div>
                <div class="crm-field"><label>Nom signataire</label><input name="accepted_name" value="${escapeHtml(quote.accepted_name)}" placeholder="Ex : Claire Durand"/></div>
                <div class="crm-field"><label>Signature libre</label><input name="accepted_signature" value="${escapeHtml(quote.accepted_signature)}" placeholder="Nom, initiales ou signature texte"/></div>
              </div>
            </section>
          </form>
        </section>

        <aside class="crm-summary">
          <section class="crm-summary-card">
            <div class="crm-kicker">Calculs auto</div>
            <div class="crm-totals" id="crmQuoteTotals">${totalsRowsHtml(quote, "quote")}</div>
          </section>
          <section class="crm-summary-card">
            <div class="crm-kicker">Apercu document</div>
            <div id="crmQuotePreview">${renderDocumentPreview("quote", quote)}</div>
          </section>
        </aside>
      </div>
    `;

    const form = $("#crmQuoteForm", root);
    form?.addEventListener("input", ()=> refreshQuotePanels());
    form?.addEventListener("change", ()=> refreshQuotePanels());
    root.querySelectorAll("[data-quote-example]").forEach((button)=> button.addEventListener("click", ()=>{
      applyQuoteExample(button.getAttribute("data-quote-example"));
    }));
    root.querySelectorAll("[data-quote-example-client]").forEach((button)=> button.addEventListener("click", runAction("Devis", async ()=>{
      await applyQuoteExampleWithClient(button.getAttribute("data-quote-example-client"));
    })));
    root.querySelectorAll("[data-quote-example-pdf]").forEach((button)=> button.addEventListener("click", runAction("PDF", async ()=>{
      await applyQuoteExampleWithClient(button.getAttribute("data-quote-example-pdf"), { generatePdf: true });
    })));
    $("#crmQuoteAddItem", root)?.addEventListener("click", ()=>{
      collectQuoteFormData();
      state.quoteForm.items.push(normalizeItem({ title: `Prestation ${state.quoteForm.items.length + 1}`, quantity: 1, unit_price: 0 }, state.quoteForm.items.length));
      renderQuoteEditorPage();
    });
    root.querySelectorAll("[data-remove-item]").forEach((button)=> button.addEventListener("click", ()=>{
      collectQuoteFormData();
      const index = Number(button.getAttribute("data-remove-item"));
      state.quoteForm.items = state.quoteForm.items.filter((_, itemIndex)=> itemIndex !== index);
      if(!state.quoteForm.items.length){
        state.quoteForm.items = [normalizeItem({ title: "Prestation principale", quantity: 1, unit_price: 0 }, 0)];
      }
      renderQuoteEditorPage();
    }));
    $("#crmQuoteNewClient", root)?.addEventListener("click", ()=>{
      openClientModal(null, async (savedClient)=>{
        state.clients = await repo.listClients();
        state.quoteForm.client_id = savedClient.id;
        state.quoteForm.client = savedClient;
        renderQuoteEditorPage();
      });
    });
    $("#crmQuoteMarie", root)?.addEventListener("click", async ()=>{
      const marie = await ensureMarieClient();
      state.quoteForm.client_id = marie.id;
      state.quoteForm.client = marie;
      renderQuoteEditorPage();
    });
    $("#crmQuoteSaveDraft", root)?.addEventListener("click", runAction("Devis", async ()=>{
      const saved = await repo.saveQuote({ ...collectQuoteFormData(), status: "draft" });
      state.quoteForm = saved;
      state.quotes = await repo.listQuotes();
      renderQuoteEditorPage();
      toast("Devis", "Brouillon enregistre.");
    }));
    $("#crmQuoteSend", root)?.addEventListener("click", runAction("Devis", async ()=>{
      const saved = await repo.saveQuote({ ...collectQuoteFormData(), status: "sent" });
      state.quoteForm = saved;
      state.quotes = await repo.listQuotes();
      renderQuoteEditorPage();
      toast("Devis", "Devis marque comme envoye.");
    }));
    $("#crmQuotePdf", root)?.addEventListener("click", runAction("PDF", async ()=>{
      const saved = await repo.saveQuote(collectQuoteFormData());
      state.quoteForm = await generatePdf("quote", saved, { print: false });
      state.quotes = await repo.listQuotes();
      renderQuoteEditorPage();
      toast("PDF", "PDF du devis genere.");
    }));
    $("#crmQuoteConvert", root)?.addEventListener("click", runAction("Facture", async ()=>{
      const saved = await repo.saveQuote(collectQuoteFormData());
      const invoice = await repo.convertQuoteToInvoice(saved.id, { issue_date: TODAY(), due_date: addDays(TODAY(), 30), status: "draft" });
      toast("Facture", "Devis transforme en facture.");
      window.location.href = `crm-invoice.html?id=${encodeURIComponent(invoice.id)}`;
    }));
    $("#crmQuoteDuplicate", root)?.addEventListener("click", runAction("Devis", async ()=>{
      const duplicated = await repo.duplicateQuote(state.quoteForm.id);
      window.location.href = `crm-quote.html?id=${encodeURIComponent(duplicated.id)}`;
    }));
  }

  function paymentRowsHtml(payments){
    return (payments || []).map((payment, index)=> `
      <div class="crm-payment-item" data-payment-index="${index}">
        <div class="crm-grid cols-3" style="width:100%">
          <div class="crm-field"><label>Montant</label><input data-payment="amount" type="number" min="0" step="0.01" value="${escapeHtml(payment.amount)}"/></div>
          <div class="crm-field"><label>Date</label><input data-payment="paid_at" type="date" value="${escapeHtml(payment.paid_at)}"/></div>
          <div class="crm-field"><label>Mode</label><input data-payment="method" value="${escapeHtml(payment.method)}" placeholder="Ex : virement, carte, cheque"/></div>
        </div>
        <div class="crm-grid cols-2" style="width:100%">
          <div class="crm-field"><label>Reference</label><input data-payment="reference" value="${escapeHtml(payment.reference)}" placeholder="Ex : VIR-CLIENT-2026-041"/></div>
          <div class="crm-field"><label>Notes</label><input data-payment="notes" value="${escapeHtml(payment.notes)}" placeholder="Ex : acompte recu, solde facture, paiement en 2 fois"/></div>
        </div>
        <button class="btn small crm-btn-quiet" type="button" data-remove-payment="${index}">Retirer</button>
      </div>
    `).join("");
  }

  function collectInvoiceFormData(){
    const form = $("#crmInvoiceForm", root);
    const items = Array.from(root.querySelectorAll("[data-index]")).map((node, index)=> normalizeItem({
      title: node.querySelector("[data-item='title']")?.value || "",
      description: node.querySelector("[data-item='description']")?.value || "",
      quantity: node.querySelector("[data-item='quantity']")?.value || 0,
      unit_price: node.querySelector("[data-item='unit_price']")?.value || 0,
    }, index));
    const payments = Array.from(root.querySelectorAll("[data-payment-index]")).map((node, index)=> normalizePayment({
      amount: node.querySelector("[data-payment='amount']")?.value || 0,
      paid_at: node.querySelector("[data-payment='paid_at']")?.value || TODAY(),
      method: node.querySelector("[data-payment='method']")?.value || "virement",
      reference: node.querySelector("[data-payment='reference']")?.value || "",
      notes: node.querySelector("[data-payment='notes']")?.value || "",
    }, index));
    const next = computeInvoice({
      ...(state.invoiceForm || baseInvoice(state.settings)),
      id: state.invoiceForm?.id || "",
      title: form.querySelector("[name='title']")?.value || "",
      client_id: form.querySelector("[name='client_id']")?.value || "",
      source_quote_id: form.querySelector("[name='source_quote_id']")?.value || "",
      issue_date: form.querySelector("[name='issue_date']")?.value || TODAY(),
      due_date: form.querySelector("[name='due_date']")?.value || addDays(TODAY(), 30),
      status: form.querySelector("[name='status']")?.value || "draft",
      payment_terms: form.querySelector("[name='payment_terms']")?.value || "",
      notes: form.querySelector("[name='notes']")?.value || "",
      discount_type: form.querySelector("[name='discount_type']")?.value || "none",
      discount_value: form.querySelector("[name='discount_value']")?.value || 0,
      deposit_amount: form.querySelector("[name='deposit_amount']")?.value || 0,
      vat_rate: form.querySelector("[name='vat_rate']")?.value || 0,
      items,
      payments,
      client: state.clients.find((client)=> client.id === (form.querySelector("[name='client_id']")?.value || "")) || null,
    });
    state.invoiceForm = next;
    return next;
  }

  function refreshInvoicePanels(){
    const doc = collectInvoiceFormData();
    $("#crmInvoiceTotals", root).innerHTML = totalsRowsHtml(doc, "invoice");
    $("#crmInvoicePreview", root).innerHTML = renderDocumentPreview("invoice", doc);
  }

  function renderInvoiceEditorPage(){
    const invoice = state.invoiceForm || baseInvoice(state.settings);
    const sourceBanner = invoice.source_quote_id ? `
      <section class="crm-banner">
        <div><strong>Facture liee a un devis d'origine.</strong><div class="crm-muted">Le lien quote -> facture est conserve pour l'historique.</div></div>
        <a class="btn crm-btn-quiet" href="crm-quote.html?id=${encodeURIComponent(invoice.source_quote_id)}">Ouvrir le devis source</a>
      </section>
    ` : "";

    root.innerHTML = `
      ${sourceBanner}
      <div class="crm-split">
        <section class="crm-main">
          <section class="crm-panel crm-hero">
            <div class="crm-kicker">${invoice.id ? "Edition facture" : "Nouvelle facture"}</div>
            <h1>${escapeHtml(invoice.number || "Facture auto")} avec suivi des paiements et impression.</h1>
            <p>Le reste du est mis a jour automatiquement selon les paiements ajoutes dans cette facture.</p>
            <div class="crm-actions">
              <button class="btn primary" type="button" id="crmInvoiceSaveDraft">Enregistrer</button>
              <button class="btn crm-btn-quiet" type="button" id="crmInvoiceSend">Marquer envoyee</button>
              <button class="btn crm-btn-quiet" type="button" id="crmInvoicePdf">Generer PDF</button>
              <button class="btn crm-btn-quiet" type="button" id="crmInvoicePrint">Imprimer</button>
              <button class="btn crm-btn-quiet" type="button" id="crmInvoiceDuplicate"${invoice.id ? "" : " disabled"}>Dupliquer</button>
            </div>
          </section>

          <form class="crm-form" id="crmInvoiceForm">
            <section class="crm-form-section">
              <h2>Exemples prets a remplir</h2>
              <p>Choisis un modele de facture avec echeance et paiements deja structures, puis ajuste seulement les donnees utiles.</p>
              <div class="crm-example-grid">${invoiceExampleCardsHtml()}</div>
            </section>

            <section class="crm-form-section">
              <h2>Client et calendrier</h2>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Client</label><select name="client_id"><option value="">Choisir un client</option>${clientOptionsHtml(invoice.client_id)}</select></div>
                <div class="crm-field"><label>Titre</label><input name="title" value="${escapeHtml(invoice.title)}" placeholder="Ex : Maintenance mensuelle, creation site, atelier, etc."/></div>
              </div>
              <div class="crm-actions">
                <button class="btn crm-btn-quiet" type="button" id="crmInvoiceNewClient">Creer un client</button>
                <button class="btn crm-btn-quiet" type="button" id="crmInvoiceMarie">Client Marie-Madeleine Gautier</button>
              </div>
              <div class="crm-grid cols-4">
                <div class="crm-field"><label>Numero</label><input value="${escapeHtml(invoice.number || "Automatique")}" disabled/></div>
                <div class="crm-field"><label>Date</label><input name="issue_date" type="date" value="${escapeHtml(invoice.issue_date)}"/></div>
                <div class="crm-field"><label>Echeance</label><input name="due_date" type="date" value="${escapeHtml(invoice.due_date)}"/></div>
                <div class="crm-field"><label>Statut</label><select name="status"><option value="draft"${invoice.status === "draft" ? " selected" : ""}>Brouillon</option><option value="sent"${invoice.status === "sent" ? " selected" : ""}>Envoyee</option><option value="paid"${invoice.status === "paid" ? " selected" : ""}>Payee</option><option value="overdue"${invoice.status === "overdue" ? " selected" : ""}>En retard</option><option value="cancelled"${invoice.status === "cancelled" ? " selected" : ""}>Annulee</option></select></div>
              </div>
              <input type="hidden" name="source_quote_id" value="${escapeHtml(invoice.source_quote_id || "")}"/>
            </section>

            <section class="crm-form-section">
              <h2>Lignes facturees</h2>
              <div class="crm-items" id="crmInvoiceItems">${quoteItemsHtml(invoice.items)}</div>
              <div class="crm-actions"><button class="btn crm-btn-quiet" type="button" id="crmInvoiceAddItem">Ajouter une ligne</button></div>
            </section>

            <section class="crm-form-section">
              <h2>Paiements et reglements</h2>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label>Remise</label><select name="discount_type"><option value="none"${invoice.discount_type === "none" ? " selected" : ""}>Aucune</option><option value="percent"${invoice.discount_type === "percent" ? " selected" : ""}>Pourcentage</option><option value="fixed"${invoice.discount_type === "fixed" ? " selected" : ""}>Montant fixe</option></select></div>
                <div class="crm-field"><label>Valeur remise</label><input name="discount_value" type="number" min="0" step="0.01" value="${escapeHtml(invoice.discount_value)}" placeholder="Ex : 10 pour 10% ou 80 pour 80 EUR"/></div>
                <div class="crm-field"><label>TVA (%)</label><input name="vat_rate" type="number" min="0" step="0.01" value="${escapeHtml(invoice.vat_rate)}"/></div>
              </div>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Acompte / acompte attendu</label><input name="deposit_amount" type="number" min="0" step="0.01" value="${escapeHtml(invoice.deposit_amount)}" placeholder="Ex : 780 si un acompte est attendu ou deja verse"/></div>
                <div class="crm-field"><label>Conditions de paiement</label><input name="payment_terms" value="${escapeHtml(invoice.payment_terms)}" placeholder="Ex : paiement a reception sous 15 jours par virement"/></div>
              </div>
              <div class="crm-field"><label>Notes</label><textarea name="notes" placeholder="Ex : rappel de l'objet facture, details de livraison, reference a communiquer">${escapeHtml(invoice.notes)}</textarea></div>
              <div class="crm-payment-list" id="crmInvoicePayments">${paymentRowsHtml(invoice.payments)}</div>
              <div class="crm-actions"><button class="btn crm-btn-quiet" type="button" id="crmInvoiceAddPayment">Ajouter un paiement</button></div>
            </section>
          </form>
        </section>

        <aside class="crm-summary">
          <section class="crm-summary-card">
            <div class="crm-kicker">Calculs auto</div>
            <div class="crm-totals" id="crmInvoiceTotals">${totalsRowsHtml(invoice, "invoice")}</div>
          </section>
          <section class="crm-summary-card">
            <div class="crm-kicker">Apercu document</div>
            <div id="crmInvoicePreview">${renderDocumentPreview("invoice", invoice)}</div>
          </section>
        </aside>
      </div>
    `;

    const form = $("#crmInvoiceForm", root);
    form?.addEventListener("input", ()=> refreshInvoicePanels());
    form?.addEventListener("change", ()=> refreshInvoicePanels());
    root.querySelectorAll("[data-invoice-example]").forEach((button)=> button.addEventListener("click", ()=>{
      applyInvoiceExample(button.getAttribute("data-invoice-example"));
    }));
    root.querySelectorAll("[data-invoice-example-client]").forEach((button)=> button.addEventListener("click", runAction("Facture", async ()=>{
      await applyInvoiceExampleWithClient(button.getAttribute("data-invoice-example-client"));
    })));
    root.querySelectorAll("[data-invoice-example-pdf]").forEach((button)=> button.addEventListener("click", runAction("PDF", async ()=>{
      await applyInvoiceExampleWithClient(button.getAttribute("data-invoice-example-pdf"), { generatePdf: true });
    })));
    $("#crmInvoiceAddItem", root)?.addEventListener("click", ()=>{
      collectInvoiceFormData();
      state.invoiceForm.items.push(normalizeItem({ title: `Prestation ${state.invoiceForm.items.length + 1}`, quantity: 1, unit_price: 0 }, state.invoiceForm.items.length));
      renderInvoiceEditorPage();
    });
    root.querySelectorAll("[data-remove-item]").forEach((button)=> button.addEventListener("click", ()=>{
      collectInvoiceFormData();
      const index = Number(button.getAttribute("data-remove-item"));
      state.invoiceForm.items = state.invoiceForm.items.filter((_, itemIndex)=> itemIndex !== index);
      if(!state.invoiceForm.items.length){
        state.invoiceForm.items = [normalizeItem({ title: "Prestation facturee", quantity: 1, unit_price: 0 }, 0)];
      }
      renderInvoiceEditorPage();
    }));
    $("#crmInvoiceAddPayment", root)?.addEventListener("click", ()=>{
      collectInvoiceFormData();
      state.invoiceForm.payments.push(normalizePayment({ amount: 0, paid_at: TODAY(), method: "virement" }, state.invoiceForm.payments.length));
      renderInvoiceEditorPage();
    });
    root.querySelectorAll("[data-remove-payment]").forEach((button)=> button.addEventListener("click", ()=>{
      collectInvoiceFormData();
      const index = Number(button.getAttribute("data-remove-payment"));
      state.invoiceForm.payments = state.invoiceForm.payments.filter((_, paymentIndex)=> paymentIndex !== index);
      renderInvoiceEditorPage();
    }));
    $("#crmInvoiceNewClient", root)?.addEventListener("click", ()=>{
      openClientModal(null, async (savedClient)=>{
        state.clients = await repo.listClients();
        state.invoiceForm.client_id = savedClient.id;
        state.invoiceForm.client = savedClient;
        renderInvoiceEditorPage();
      });
    });
    $("#crmInvoiceMarie", root)?.addEventListener("click", async ()=>{
      const marie = await ensureMarieClient();
      state.invoiceForm.client_id = marie.id;
      state.invoiceForm.client = marie;
      renderInvoiceEditorPage();
    });
    $("#crmInvoiceSaveDraft", root)?.addEventListener("click", runAction("Facture", async ()=>{
      const saved = await repo.saveInvoice({ ...collectInvoiceFormData(), status: state.invoiceForm.status || "draft" });
      state.invoiceForm = saved;
      state.invoices = await repo.listInvoices();
      renderInvoiceEditorPage();
      toast("Facture", "Facture enregistree.");
    }));
    $("#crmInvoiceSend", root)?.addEventListener("click", runAction("Facture", async ()=>{
      const saved = await repo.saveInvoice({ ...collectInvoiceFormData(), status: "sent" });
      state.invoiceForm = saved;
      state.invoices = await repo.listInvoices();
      renderInvoiceEditorPage();
      toast("Facture", "Facture marquee comme envoyee.");
    }));
    $("#crmInvoicePdf", root)?.addEventListener("click", runAction("PDF", async ()=>{
      const saved = await repo.saveInvoice(collectInvoiceFormData());
      state.invoiceForm = await generatePdf("invoice", saved, { print: false });
      state.invoices = await repo.listInvoices();
      renderInvoiceEditorPage();
      toast("PDF", "PDF de la facture genere.");
    }));
    $("#crmInvoicePrint", root)?.addEventListener("click", runAction("Impression", async ()=>{
      const saved = await repo.saveInvoice(collectInvoiceFormData());
      state.invoiceForm = await generatePdf("invoice", saved, { print: true });
      state.invoices = await repo.listInvoices();
      renderInvoiceEditorPage();
    }));
    $("#crmInvoiceDuplicate", root)?.addEventListener("click", runAction("Facture", async ()=>{
      const duplicated = await repo.duplicateInvoice(state.invoiceForm.id);
      window.location.href = `crm-invoice.html?id=${encodeURIComponent(duplicated.id)}`;
    }));
  }

  function renderSettingsPage(){
    const settings = state.settings || DEFAULT_SETTINGS;
    root.innerHTML = `
      <div class="crm-split">
        <section class="crm-main">
          <section class="crm-panel crm-hero">
            <div class="crm-kicker">Parametres generaux</div>
            <h1>Identite legale, TVA, mentions et style des documents.</h1>
            <p>Ces donnees sont reinjectees automatiquement dans les devis, factures et PDF professionnels.</p>
          </section>
          <form class="crm-form" id="crmSettingsForm">
            <section class="crm-form-section">
              <h2>Identite</h2>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Nom commercial</label><input name="trade_name" value="${escapeHtml(settings.trade_name)}"/></div>
                <div class="crm-field"><label>Nom legal</label><input name="legal_name" value="${escapeHtml(settings.legal_name)}"/></div>
              </div>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label>Email</label><input name="email" type="email" value="${escapeHtml(settings.email)}"/></div>
                <div class="crm-field"><label>Telephone</label><input name="phone" value="${escapeHtml(settings.phone)}"/></div>
                <div class="crm-field"><label>SIRET</label><input name="siret" value="${escapeHtml(settings.siret)}"/></div>
              </div>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Adresse</label><input name="address_line1" value="${escapeHtml(settings.address_line1)}"/></div>
                <div class="crm-field"><label>Complement</label><input name="address_line2" value="${escapeHtml(settings.address_line2)}"/></div>
              </div>
              <div class="crm-grid cols-3">
                <div class="crm-field"><label>Code postal</label><input name="postal_code" value="${escapeHtml(settings.postal_code)}"/></div>
                <div class="crm-field"><label>Ville</label><input name="city" value="${escapeHtml(settings.city)}"/></div>
                <div class="crm-field"><label>Pays</label><input name="country" value="${escapeHtml(settings.country)}"/></div>
              </div>
            </section>

            <section class="crm-form-section">
              <h2>Fiscalite et mentions</h2>
              <div class="crm-grid cols-4">
                <div class="crm-field"><label>TVA par defaut (%)</label><input name="default_vat_rate" type="number" min="0" step="0.01" value="${escapeHtml(settings.default_vat_rate)}"/></div>
                <div class="crm-field"><label>Type d'activite</label><select name="business_type"><option value="micro"${settings.business_type === "micro" ? " selected" : ""}>Micro-entreprise</option><option value="subject_to_vat"${settings.business_type === "subject_to_vat" ? " selected" : ""}>Assujetti TVA</option><option value="company"${settings.business_type === "company" ? " selected" : ""}>Societe</option></select></div>
                <div class="crm-field"><label>Devise</label><input name="currency" value="${escapeHtml(settings.currency)}"/></div>
                <div class="crm-field"><label>Validite devis (jours)</label><input name="quote_validity_days" type="number" min="0" max="365" value="${escapeHtml(settings.quote_validity_days)}"/></div>
              </div>
              <div class="crm-field"><label>Mention TVA</label><textarea name="vat_note">${escapeHtml(settings.vat_note)}</textarea></div>
              <div class="crm-field"><label>Conditions de paiement par defaut</label><textarea name="payment_terms_default">${escapeHtml(settings.payment_terms_default)}</textarea></div>
              <div class="crm-field"><label>Notes par defaut</label><textarea name="default_notes">${escapeHtml(settings.default_notes)}</textarea></div>
              <div class="crm-field"><label>Penalites de retard</label><textarea name="late_penalties">${escapeHtml(settings.late_penalties)}</textarea></div>
              <div class="crm-field"><label>Indemnite forfaitaire</label><textarea name="recovery_indemnity">${escapeHtml(settings.recovery_indemnity)}</textarea></div>
            </section>

            <section class="crm-form-section">
              <h2>Numerotation et design</h2>
              <div class="crm-grid cols-4">
                <div class="crm-field"><label>Prefixe devis</label><input name="numbering_quote_prefix" value="${escapeHtml(settings.numbering_quote_prefix)}"/></div>
                <div class="crm-field"><label>Prefixe factures</label><input name="numbering_invoice_prefix" value="${escapeHtml(settings.numbering_invoice_prefix)}"/></div>
                <div class="crm-field"><label>Padding</label><input name="numbering_padding" type="number" min="3" max="6" value="${escapeHtml(settings.numbering_padding)}"/></div>
                <div class="crm-field"><label>Couleur principale</label><input name="primary_color" type="color" value="${escapeHtml(settings.primary_color || "#111111")}"/></div>
              </div>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Logo (URL ou data URL)</label><input name="logo_url" id="crmLogoUrl" value="${escapeHtml(settings.logo_url)}"/></div>
                <div class="crm-field"><label>Uploader un logo</label><input type="file" id="crmLogoFile" accept="image/*"/></div>
              </div>
              <div class="crm-doc-legal">Si ce champ reste vide, le logo Digitalexis-Studio sera utilise par defaut sur les devis, factures et PDF.</div>
            </section>

            <section class="crm-form-section">
              <h2>Reseaux sociaux</h2>
              <p class="crm-doc-legal">Ces liens alimentent automatiquement les icones du footer sur la landing page.</p>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>Instagram</label><input name="social_instagram_url" type="url" placeholder="https://instagram.com/votre-compte" value="${escapeHtml(settings.social_instagram_url)}"/></div>
                <div class="crm-field"><label>Facebook</label><input name="social_facebook_url" type="url" placeholder="https://facebook.com/votre-page" value="${escapeHtml(settings.social_facebook_url)}"/></div>
              </div>
              <div class="crm-grid cols-2">
                <div class="crm-field"><label>LinkedIn</label><input name="social_linkedin_url" type="url" placeholder="https://www.linkedin.com/in/votre-profil" value="${escapeHtml(settings.social_linkedin_url)}"/></div>
                <div class="crm-field"><label>WhatsApp</label><input name="social_whatsapp_url" placeholder="https://wa.me/33600000000" value="${escapeHtml(settings.social_whatsapp_url)}"/></div>
              </div>
            </section>

            <div class="crm-actions">
              <button class="btn primary" type="submit">Enregistrer les parametres</button>
            </div>
          </form>
        </section>

        <aside class="crm-summary">
          <section class="crm-summary-card">
            <div class="crm-kicker">Apercu legal</div>
            <div class="crm-doc-preview">
              <div class="crm-doc-brand">
                <div class="crm-doc-brand-row">
                  <strong>${escapeHtml(companyDisplayName(settings))}</strong>
                  <img class="crm-doc-logo crm-doc-logo--small" src="${escapeHtml(effectiveLogoUrl(settings))}" alt="Logo ${escapeHtml(companyDisplayName(settings))}"/>
                </div>
              </div>
              <div class="crm-doc-legal" style="margin-top:12px">${companyBlockHtml(settings)}</div>
              <div class="crm-doc-legal" style="margin-top:12px">${legalBlockHtml(settings)}</div>
              <div class="crm-doc-legal" style="margin-top:12px"><strong>Format numeros :</strong> ${escapeHtml((settings.numbering_quote_prefix || "DEV") + "-2026-001")} / ${escapeHtml((settings.numbering_invoice_prefix || "FAC") + "-2026-001")}</div>
            </div>
          </section>
        </aside>
      </div>
    `;

    $("#crmSettingsForm", root)?.addEventListener("submit", async (event)=>{
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      state.settings = await repo.saveSettings({
        trade_name: String(form.get("trade_name") || "").trim(),
        legal_name: String(form.get("legal_name") || "").trim(),
        email: String(form.get("email") || "").trim(),
        phone: String(form.get("phone") || "").trim(),
        siret: String(form.get("siret") || "").trim(),
        address_line1: String(form.get("address_line1") || "").trim(),
        address_line2: String(form.get("address_line2") || "").trim(),
        postal_code: String(form.get("postal_code") || "").trim(),
        city: String(form.get("city") || "").trim(),
        country: String(form.get("country") || "").trim() || "France",
        default_vat_rate: roundMoney(form.get("default_vat_rate") || 0),
        business_type: String(form.get("business_type") || "micro"),
        currency: String(form.get("currency") || "EUR").trim().toUpperCase(),
        quote_validity_days: Number(form.get("quote_validity_days") || 30),
        vat_note: String(form.get("vat_note") || "").trim(),
        payment_terms_default: String(form.get("payment_terms_default") || "").trim(),
        default_notes: String(form.get("default_notes") || "").trim(),
        late_penalties: String(form.get("late_penalties") || "").trim(),
        recovery_indemnity: String(form.get("recovery_indemnity") || "").trim(),
        numbering_quote_prefix: String(form.get("numbering_quote_prefix") || "DEV").trim().toUpperCase(),
        numbering_invoice_prefix: String(form.get("numbering_invoice_prefix") || "FAC").trim().toUpperCase(),
        numbering_padding: Number(form.get("numbering_padding") || 3),
        primary_color: String(form.get("primary_color") || "#111111").trim(),
        logo_url: String(form.get("logo_url") || "").trim(),
        social_instagram_url: String(form.get("social_instagram_url") || "").trim(),
        social_facebook_url: String(form.get("social_facebook_url") || "").trim(),
        social_linkedin_url: String(form.get("social_linkedin_url") || "").trim(),
        social_whatsapp_url: String(form.get("social_whatsapp_url") || "").trim(),
      });
      renderSettingsPage();
      toast("Parametres", "Parametres CRM enregistres.");
    });
    $("#crmLogoFile", root)?.addEventListener("change", async (event)=>{
      const file = event.target.files?.[0];
      if(!file) return;
      const dataUrl = await readAsDataUrl(file);
      $("#crmLogoUrl", root).value = dataUrl;
      toast("Logo", "Logo charge, pense a enregistrer les parametres.");
    });
  }

  function ensureDocumentReady(doc, kind){
    if(!doc.client_id){
      throw new Error(kind === "quote" ? "Selectionne d'abord un client pour le devis." : "Selectionne d'abord un client pour la facture.");
    }
    if(!state.clients.some((client)=> client.id === doc.client_id)){
      throw new Error("Le client selectionne est introuvable dans les donnees Supabase chargees. Recharge la page puis reessaie.");
    }
    if(!(doc.items || []).length){
      throw new Error("Ajoute au moins une ligne de prestation.");
    }
    if(!(doc.items || []).some((item)=> String(item.title || "").trim())){
      throw new Error("Chaque document doit contenir au moins une ligne nommee.");
    }
  }

  async function initPage(){
    setLoading("Chargement du CRM...");
    try{
      const accessOk = await ensureCrmAccess();
      if(!accessOk) return;

      if(page === "dashboard"){
        await loadBaseCollections();
        renderDashboardPage();
        return;
      }

      if(page === "clients"){
        state.settings = await repo.getSettings();
        state.clients = await repo.listClients();
        renderClientsPage();
        return;
      }

      if(page === "quotes"){
        await loadBaseCollections();
        renderQuotesPage();
        return;
      }

      if(page === "invoices"){
        await loadBaseCollections();
        renderInvoicesPage();
        return;
      }

      if(page === "quote-editor"){
        state.settings = await repo.getSettings();
        state.clients = await repo.listClients();
        const id = PARAMS.get("id");
        state.quoteForm = id ? await repo.getQuote(id) : baseQuote(state.settings);
        const clientId = PARAMS.get("client");
        if(clientId){
          state.quoteForm.client_id = clientId;
          state.quoteForm.client = state.clients.find((client)=> client.id === clientId) || null;
        }
        if(!state.quoteForm){
          throw new Error("Devis introuvable.");
        }
        renderQuoteEditorPage();
        return;
      }

      if(page === "invoice-editor"){
        state.settings = await repo.getSettings();
        state.clients = await repo.listClients();
        const id = PARAMS.get("id");
        state.invoiceForm = id ? await repo.getInvoice(id) : baseInvoice(state.settings);
        if(!state.invoiceForm){
          throw new Error("Facture introuvable.");
        }
        renderInvoiceEditorPage();
        return;
      }

      if(page === "settings"){
        state.settings = await repo.getSettings();
        renderSettingsPage();
      }
    }catch(error){
      showFatal(error);
    }
  }

  const originalSaveQuote = repo.saveQuote.bind(repo);
  repo.saveQuote = async function patchedSaveQuote(payload){
    const accessOk = await ensureCrmAccess();
    if(!accessOk){
      throw new Error("Acces CRM indisponible. Recharge la page et reconnecte-toi si besoin.");
    }
    ensureDocumentReady(payload, "quote");
    return originalSaveQuote(payload);
  };

  const originalSaveInvoice = repo.saveInvoice.bind(repo);
  repo.saveInvoice = async function patchedSaveInvoice(payload){
    const accessOk = await ensureCrmAccess();
    if(!accessOk){
      throw new Error("Acces CRM indisponible. Recharge la page et reconnecte-toi si besoin.");
    }
    ensureDocumentReady(payload, "invoice");
    return originalSaveInvoice(payload);
  };

  initPage();
})();
