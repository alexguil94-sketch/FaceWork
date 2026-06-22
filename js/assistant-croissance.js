"use strict";

(function(){
  const STORAGE_KEY = "fw-growth-assistant";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const defaultState = {
    profile: {
      name: "Digitalexis-Studio",
      sector: "digital",
      city: "Paris",
      radius: 20,
      target: "TPE locales, indépendants et petites entreprises",
      offer: "Site vitrine, SEO local et pilotage client",
      basket: 900,
      capacity: 8,
      edge: "Accompagnement simple, image premium et outils directement exploitables."
    },
    finance: {
      revenue: 3500,
      software: 120,
      marketing: 250,
      rent: 0,
      transport: 180,
      phone: 55,
      insurance: 45,
      subcontracting: 300,
      other: 100
    },
    prospects: [],
    leads: [],
    selectedProspectId: "",
    generatedMessage: ""
  };

  let state = loadState();

  const nodes = {
    profileForm: $("#profileForm"),
    financeForm: $("#financeForm"),
    exportCrmButton: $("#exportCrmButton"),
    resetGrowthButton: $("#resetGrowthButton"),
    generateProspectsButton: $("#generateProspectsButton"),
    generateMessageButton: $("#generateMessageButton"),
    copyMessageButton: $("#copyMessageButton"),
    refreshAidButton: $("#refreshAidButton"),
    addManualLeadButton: $("#addManualLeadButton"),
    leadForm: $("#leadForm"),
    opportunityScore: $("#opportunityScore"),
    opportunityScoreLabel: $("#opportunityScoreLabel"),
    savingPotential: $("#savingPotential"),
    savingCount: $("#savingCount"),
    prospectCount: $("#prospectCount"),
    hotProspectCount: $("#hotProspectCount"),
    followUpCount: $("#followUpCount"),
    nextFollowUp: $("#nextFollowUp"),
    savingsList: $("#savingsList"),
    prospectList: $("#prospectList"),
    crmList: $("#crmList"),
    aidGrid: $("#aidGrid"),
    messageProspect: $("#messageProspect"),
    messageTone: $("#messageTone"),
    generatedMessage: $("#generatedMessage"),
    marginStatus: $("#marginStatus")
  };

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(defaultState),
        ...parsed,
        profile: { ...defaultState.profile, ...(parsed.profile || {}) },
        finance: { ...defaultState.finance, ...(parsed.finance || {}) },
        prospects: Array.isArray(parsed.prospects) ? parsed.prospects : [],
        leads: Array.isArray(parsed.leads) ? parsed.leads : []
      };
    }catch(error){
      console.warn("Assistant croissance: stockage illisible", error);
      return structuredClone(defaultState);
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function createId(prefix){
    if(globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `${prefix || "id"}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toNumber(value){
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function clamp(value, min, max){
    return Math.min(max, Math.max(min, value));
  }

  function todayISO(){
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function addDays(days){
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }

  function formatCurrency(value){
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(toNumber(value));
  }

  function escapeHTML(value){
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(title, message){
    if(window.fwToast){
      window.fwToast(title, message);
      return;
    }

    const toastNode = $("#toast") || $(".toast");

    if(!toastNode) {
      return;
    }

    const titleNode = $(".t", toastNode);
    const detailNode = $(".d", toastNode);

    if(titleNode && detailNode){
      titleNode.textContent = title || "OK";
      detailNode.textContent = message || "";
      toastNode.classList.add("show");
      clearTimeout(window.__growthToastTimer);
      window.__growthToastTimer = setTimeout(() => toastNode.classList.remove("show"), 2600);
      return;
    }

    toastNode.textContent = [title, message].filter(Boolean).join(" — ");
    toastNode.classList.remove("hidden");
    clearTimeout(window.__growthToastTimer);
    window.__growthToastTimer = setTimeout(() => toastNode.classList.add("hidden"), 2600);
  }

  function getProfileFromForm(){
    return {
      name: $("#companyName").value.trim(),
      sector: $("#companySector").value,
      city: $("#companyCity").value.trim(),
      radius: toNumber($("#companyRadius").value),
      target: $("#targetCustomer").value.trim(),
      offer: $("#mainOffer").value.trim(),
      basket: toNumber($("#averageBasket").value),
      capacity: toNumber($("#weeklyCapacity").value),
      edge: $("#companyEdge").value.trim()
    };
  }

  function getFinanceFromForm(){
    return {
      revenue: toNumber($("#monthlyRevenue").value),
      software: toNumber($("#expenseSoftware").value),
      marketing: toNumber($("#expenseMarketing").value),
      rent: toNumber($("#expenseRent").value),
      transport: toNumber($("#expenseTransport").value),
      phone: toNumber($("#expensePhone").value),
      insurance: toNumber($("#expenseInsurance").value),
      subcontracting: toNumber($("#expenseSubcontracting").value),
      other: toNumber($("#expenseOther").value)
    };
  }

  function fillForms(){
    const profile = state.profile;
    const finance = state.finance;

    $("#companyName").value = profile.name;
    $("#companySector").value = profile.sector;
    $("#companyCity").value = profile.city;
    $("#companyRadius").value = profile.radius;
    $("#targetCustomer").value = profile.target;
    $("#mainOffer").value = profile.offer;
    $("#averageBasket").value = profile.basket;
    $("#weeklyCapacity").value = profile.capacity;
    $("#companyEdge").value = profile.edge;

    $("#monthlyRevenue").value = finance.revenue;
    $("#expenseSoftware").value = finance.software;
    $("#expenseMarketing").value = finance.marketing;
    $("#expenseRent").value = finance.rent;
    $("#expenseTransport").value = finance.transport;
    $("#expensePhone").value = finance.phone;
    $("#expenseInsurance").value = finance.insurance;
    $("#expenseSubcontracting").value = finance.subcontracting;
    $("#expenseOther").value = finance.other;

    $("#prospectCity").value = profile.city;
    $("#prospectRadius").value = profile.radius;
    $("#leadFollowUp").value = addDays(3);
    nodes.generatedMessage.value = state.generatedMessage || "";
  }

  function getExpenseTotal(){
    const f = state.finance;
    return f.software + f.marketing + f.rent + f.transport + f.phone + f.insurance + f.subcontracting + f.other;
  }

  function getMarginData(){
    const revenue = state.finance.revenue;
    const expenses = getExpenseTotal();
    const margin = revenue - expenses;
    const rate = revenue > 0 ? margin / revenue : 0;
    return { revenue, expenses, margin, rate };
  }

  function detectSavings(){
    const f = state.finance;
    const { revenue, rate } = getMarginData();
    const safeRevenue = Math.max(revenue, 1);
    const savings = [];

    function add(condition, title, detail, amount, priority){
      if(!condition) return;
      savings.push({
        title,
        detail,
        amount: Math.max(0, Math.round(amount)),
        priority
      });
    }

    add(
      f.software > 90 || f.software / safeRevenue > .04,
      "Audit des abonnements logiciels",
      "Regrouper les outils doublons, passer en annuel seulement sur les usages stables et supprimer les licences inactives.",
      Math.max(20, f.software * .22),
      "Rapide"
    );

    add(
      f.marketing / safeRevenue > .12,
      "Budget marketing à recentrer",
      "Couper les canaux sans retour mesurable et garder une action locale traçable par semaine.",
      f.marketing * .18,
      "Prioritaire"
    );

    add(
      f.transport > 150 || f.transport / safeRevenue > .06,
      "Déplacements à optimiser",
      "Regrouper les rendez-vous par zone et remplacer les premiers échanges par visio quand le panier moyen est faible.",
      f.transport * .2,
      "Rapide"
    );

    add(
      f.phone > 70,
      "Forfait téléphone / internet",
      "Comparer l'offre actuelle avec une offre pro plus simple, surtout si peu de lignes ou d'options sont utilisées.",
      f.phone * .25,
      "Facile"
    );

    add(
      f.subcontracting / safeRevenue > .18,
      "Sous-traitance à cadrer",
      "Créer des packs livrables fixes pour réduire les allers-retours et sécuriser la marge avant acceptation du devis.",
      f.subcontracting * .1,
      "Structurel"
    );

    add(
      f.other / safeRevenue > .05,
      "Charges diverses à classer",
      "Les petites dépenses non catégorisées cachent souvent des abonnements ou achats récurrents inutiles.",
      f.other * .25,
      "Contrôle"
    );

    add(
      rate < .35 && revenue > 0,
      "Marge à protéger",
      "Revoir les prix, limiter les petites missions non rentables et augmenter le panier moyen sur l'offre principale.",
      Math.max(50, revenue * .05),
      "Important"
    );

    return savings.sort((a, b) => b.amount - a.amount);
  }

  function calculateOpportunityScore(){
    const profile = state.profile;
    const { revenue, rate } = getMarginData();
    const fields = [
      profile.name,
      profile.city,
      profile.target,
      profile.offer,
      profile.edge
    ];
    const completion = fields.filter(Boolean).length / fields.length;
    const profileScore = completion * 24;
    const financeScore = revenue > 0 ? clamp(rate, 0, .55) / .55 * 24 : 0;
    const capacityScore = clamp(profile.capacity, 0, 12) / 12 * 14;
    const basketScore = clamp(profile.basket, 0, 1500) / 1500 * 14;
    const prospectScore = state.prospects.length
      ? state.prospects.reduce((sum, prospect) => sum + prospect.score, 0) / state.prospects.length / 100 * 18
      : 4;
    const crmScore = state.leads.length ? clamp(state.leads.length, 0, 8) / 8 * 6 : 0;

    return Math.round(profileScore + financeScore + capacityScore + basketScore + prospectScore + crmScore);
  }

  function getScoreLabel(score){
    if(score >= 78) return "Très bonne fenêtre commerciale";
    if(score >= 58) return "Potentiel solide";
    if(score >= 38) return "Base à renforcer";
    return "Profil à compléter";
  }

  function renderSavings(){
    const savings = detectSavings();
    const total = savings.reduce((sum, item) => sum + item.amount, 0);
    const { rate } = getMarginData();

    nodes.savingPotential.textContent = formatCurrency(total);
    nodes.savingCount.textContent = `${savings.length} piste${savings.length > 1 ? "s" : ""}`;
    nodes.marginStatus.textContent = `Marge estimée ${Math.round(rate * 100)} %`;

    if(savings.length === 0){
      nodes.savingsList.innerHTML = `
        <div class="empty-state">
          Aucune économie évidente détectée. Continue à surveiller les abonnements et les dépenses récurrentes.
        </div>
      `;
      return;
    }

    nodes.savingsList.innerHTML = savings.map((item) => `
      <article class="saving-item">
        <div>
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(item.detail)}</p>
          <div class="prospect-meta">
            <span class="tag">${escapeHTML(item.priority)}</span>
          </div>
        </div>
        <strong class="saving-value">${escapeHTML(formatCurrency(item.amount))}/mois</strong>
      </article>
    `).join("");
  }

  function buildProspectTemplates(){
    const profile = state.profile;
    const need = $("#prospectNeed").value;
    const requestedType = $("#prospectType").value.trim() || profile.target || "entreprises locales";
    const city = $("#prospectCity").value.trim() || profile.city || "votre ville";
    const radius = toNumber($("#prospectRadius").value) || profile.radius || 20;
    const offer = profile.offer || "votre offre";
    const sectorMap = {
      services: ["cabinet conseil", "agence locale", "service B2B", "bureau d'études", "cabinet administratif", "organisme de formation"],
      commerce: ["boutique indépendante", "concept store", "fleuriste", "opticien", "magasin spécialisé", "épicerie fine"],
      artisanat: ["menuisier", "électricien", "plombier", "peintre", "atelier créatif", "garage indépendant"],
      sante: ["cabinet paramédical", "centre bien-être", "ostéopathe", "psychologue", "coach santé", "infirmier libéral"],
      restauration: ["restaurant", "traiteur", "café", "boulangerie", "food truck", "brasserie"],
      formation: ["centre de formation", "coach professionnel", "école privée", "formateur indépendant", "organisme certifié", "atelier pédagogique"],
      immobilier: ["agence immobilière", "mandataire immobilier", "diagnostiqueur", "courtier", "gestion locative", "promoteur local"],
      digital: ["indépendant premium", "coach business", "consultant local", "créateur de marque", "agence partenaire", "studio photo"]
    };
    const bases = sectorMap[profile.sector] || sectorMap.services;
    const needLabels = {
      visibilite: "visibilité locale",
      site: "site plus clair",
      crm: "suivi client",
      devis: "devis et factures",
      recrutement: "marque employeur"
    };

    return bases.slice(0, 6).map((base, index) => {
      const score = clamp(
        58 +
        index * 5 +
        (profile.basket >= 800 ? 8 : 0) +
        (profile.capacity >= 6 ? 7 : 0) +
        (profile.edge ? 5 : 0),
        35,
        96
      );
      const name = `${capitalize(base)} ${city.split(/\s+/)[0] || "local"} ${index + 1}`;
      const query = `${requestedType} ${base} ${city} ${radius > 0 ? `rayon ${radius}km` : ""}`;
      return {
        id: createId("prospect"),
        name,
        type: base,
        city,
        radius,
        need,
        needLabel: needLabels[need] || "développement commercial",
        score,
        pitch: `Angle conseillé : proposer ${offer} pour améliorer ${needLabels[need] || "la conversion"} sans complexifier l'organisation.`,
        searchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        createdAt: new Date().toISOString()
      };
    });
  }

  function capitalize(value){
    const text = String(value || "").trim();
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function generateProspects(){
    state.profile = getProfileFromForm();
    state.prospects = buildProspectTemplates();
    state.selectedProspectId = state.prospects[0]?.id || "";
    saveState();
    renderAll();
    toast("Prospection", "Liste locale générée. Vérifie les contacts via les liens de recherche.");
  }

  function renderProspects(){
    nodes.prospectCount.textContent = String(state.prospects.length);
    nodes.hotProspectCount.textContent = `${state.prospects.filter((prospect) => prospect.score >= 75).length} prioritaire`;

    if(state.prospects.length === 0){
      nodes.prospectList.innerHTML = `
        <div class="empty-state">
          Clique sur Chercher pour générer une première liste à vérifier autour de ta ville.
        </div>
      `;
      renderProspectSelect();
      return;
    }

    nodes.prospectList.innerHTML = state.prospects.map((prospect) => `
      <article class="prospect-item">
        <div>
          <h3>${escapeHTML(prospect.name)}</h3>
          <p>${escapeHTML(prospect.pitch)}</p>
          <div class="prospect-meta">
            <span class="tag">${escapeHTML(prospect.type)}</span>
            <span class="tag">${escapeHTML(prospect.city)}${prospect.radius ? ` · ${prospect.radius} km` : ""}</span>
            <span class="tag">${escapeHTML(prospect.needLabel)}</span>
          </div>
          <div class="prospect-actions">
            <a class="btn small" href="${escapeHTML(prospect.searchUrl)}" target="_blank" rel="noreferrer">Vérifier</a>
            <button class="btn small" type="button" data-message-prospect="${escapeHTML(prospect.id)}">Message</button>
            <button class="btn small primary" type="button" data-add-lead="${escapeHTML(prospect.id)}">Ajouter CRM</button>
          </div>
        </div>
        <div class="prospect-score" style="--score:${prospect.score}">${prospect.score}</div>
      </article>
    `).join("");

    renderProspectSelect();
  }

  function renderProspectSelect(){
    if(state.prospects.length === 0){
      nodes.messageProspect.innerHTML = `<option value="">Aucun prospect</option>`;
      return;
    }

    nodes.messageProspect.innerHTML = state.prospects.map((prospect) => `
      <option value="${escapeHTML(prospect.id)}">${escapeHTML(prospect.name)}</option>
    `).join("");

    nodes.messageProspect.value =
      state.selectedProspectId && state.prospects.some((prospect) => prospect.id === state.selectedProspectId)
        ? state.selectedProspectId
        : state.prospects[0].id;
  }

  function getSelectedProspect(){
    const id = nodes.messageProspect.value || state.selectedProspectId;
    return state.prospects.find((prospect) => prospect.id === id) || state.prospects[0] || null;
  }

  function generateMessage(){
    const prospect = getSelectedProspect();
    const profile = state.profile;
    const tone = nodes.messageTone.value;

    if(!prospect){
      toast("Message", "Génère d'abord des prospects.");
      return;
    }

    const intro = {
      direct: `Bonjour,\n\nJe vous contacte car je travaille avec des entreprises locales autour de ${profile.city || "votre secteur"} sur un sujet simple : transformer leur présence en ligne en demandes concrètes.`,
      chaleureux: `Bonjour,\n\nJe suis tombé sur votre activité à ${prospect.city}. J'aime contacter directement les entreprises locales quand je pense qu'un petit chantier digital peut produire un vrai gain commercial.`,
      premium: `Bonjour,\n\nJe me permets de vous écrire avec une approche volontairement ciblée : votre activité semble pouvoir gagner en lisibilité, en crédibilité et en conversion locale.`,
      relance: `Bonjour,\n\nJe me permets une courte relance au sujet de votre visibilité locale et de votre parcours client.`
    };

    const body = `Mon offre : ${profile.offer || "un accompagnement digital clair"}.\n\nPour une structure comme ${prospect.name}, l'angle le plus utile serait de travailler ${prospect.needLabel}, avec un support simple à maintenir et pensé pour générer plus de contacts qualifiés.\n\nCe qui me différencie : ${profile.edge || "une exécution claire, rapide et orientée résultat"}.`;
    const close = tone === "relance"
      ? "Est-ce que je peux vous envoyer une proposition très courte avec 2 ou 3 pistes concrètes ?"
      : "Si vous êtes ouvert, je peux vous préparer un mini diagnostic gratuit en 3 points, sans engagement.";

    state.selectedProspectId = prospect.id;
    state.generatedMessage = `${intro[tone] || intro.direct}\n\n${body}\n\n${close}\n\nBonne journée,\n${profile.name || "FaceWork"}`;
    nodes.generatedMessage.value = state.generatedMessage;
    saveState();
    toast("Message", "Message personnalisé généré.");
  }

  async function copyMessage(){
    const text = nodes.generatedMessage.value.trim();
    if(!text){
      toast("Copie", "Aucun message à copier.");
      return;
    }

    try{
      await navigator.clipboard.writeText(text);
      toast("Copie", "Message copié.");
    }catch(error){
      nodes.generatedMessage.select();
      toast("Copie", "Sélectionne le texte puis copie-le.");
    }
  }

  function addLeadFromProspect(prospectId){
    const prospect = state.prospects.find((item) => item.id === prospectId);
    if(!prospect) return;

    const exists = state.leads.some((lead) => lead.sourceProspectId === prospect.id);
    if(exists){
      toast("CRM", "Ce prospect est déjà dans le CRM.");
      return;
    }

    state.leads.unshift({
      id: createId("lead"),
      name: prospect.name,
      contact: "",
      status: "nouveau",
      followUp: addDays(3),
      note: `${prospect.needLabel} - score ${prospect.score}/100. ${prospect.pitch}`,
      sourceProspectId: prospect.id,
      score: prospect.score,
      createdAt: new Date().toISOString()
    });
    saveState();
    renderAll();
    toast("CRM", "Prospect ajouté aux relances.");
  }

  function addManualLead(){
    const name = $("#leadName").value.trim();
    if(!name){
      toast("CRM", "Ajoute au moins le nom du contact.");
      return;
    }

    state.leads.unshift({
      id: createId("lead"),
      name,
      contact: $("#leadContact").value.trim(),
      status: $("#leadStatus").value,
      followUp: $("#leadFollowUp").value || addDays(3),
      note: $("#leadNote").value.trim(),
      sourceProspectId: "",
      score: 50,
      createdAt: new Date().toISOString()
    });

    nodes.leadForm.reset();
    $("#leadFollowUp").value = addDays(3);
    saveState();
    renderAll();
    toast("CRM", "Contact enregistré.");
  }

  function updateLead(leadId, updates){
    state.leads = state.leads.map((lead) =>
      lead.id === leadId
        ? { ...lead, ...updates }
        : lead
    );
    saveState();
    renderAll();
  }

  function deleteLead(leadId){
    state.leads = state.leads.filter((lead) => lead.id !== leadId);
    saveState();
    renderAll();
  }

  function getStatusLabel(status){
    return {
      nouveau: "Nouveau",
      contacte: "Contacté",
      relance: "À relancer",
      gagne: "Gagné",
      perdu: "Perdu"
    }[status] || "Nouveau";
  }

  function renderCrm(){
    const today = todayISO();
    const activeLeads = state.leads.filter((lead) => !["gagne", "perdu"].includes(lead.status));
    const dueLeads = activeLeads.filter((lead) => lead.followUp && lead.followUp <= today);
    const nextLead = activeLeads
      .filter((lead) => lead.followUp)
      .sort((a, b) => a.followUp.localeCompare(b.followUp))[0];

    nodes.followUpCount.textContent = String(dueLeads.length);
    nodes.nextFollowUp.textContent = nextLead ? `Prochaine : ${nextLead.followUp}` : "Aucune date";

    if(state.leads.length === 0){
      nodes.crmList.innerHTML = `
        <div class="empty-state">
          Ajoute un prospect au CRM pour suivre les relances et statuts.
        </div>
      `;
      return;
    }

    nodes.crmList.innerHTML = state.leads.map((lead) => `
      <article class="crm-item">
        <div class="crm-line">
          <h3>${escapeHTML(lead.name)}</h3>
          <span class="crm-status">${escapeHTML(getStatusLabel(lead.status))}</span>
        </div>
        <p>${escapeHTML(lead.note || "Aucune note.")}</p>
        <div class="crm-meta">
          ${lead.contact ? `<span class="tag">${escapeHTML(lead.contact)}</span>` : ""}
          <span class="tag">Relance ${escapeHTML(lead.followUp || "non planifiée")}</span>
          <span class="tag">Score ${escapeHTML(lead.score || 50)}</span>
        </div>
        <div class="crm-actions">
          <button class="btn small" type="button" data-lead-contacted="${escapeHTML(lead.id)}">Contacté</button>
          <button class="btn small" type="button" data-lead-follow="${escapeHTML(lead.id)}">+3 jours</button>
          <button class="btn small" type="button" data-lead-won="${escapeHTML(lead.id)}">Gagné</button>
          <button class="btn small" type="button" data-lead-delete="${escapeHTML(lead.id)}">Supprimer</button>
        </div>
      </article>
    `).join("");
  }

  function renderAids(){
    const profile = state.profile;
    const { revenue, rate } = getMarginData();
    const digitalFit = ["commerce", "artisanat", "sante", "restauration", "formation"].includes(profile.sector) ? "Fort" : "Moyen";
    const creationFit = revenue < 2500 ? "À vérifier" : "Faible";
    const aidCards = [
      {
        title: "Base aides aux entreprises",
        fit: "Référence",
        detail: "Recherche par projet, territoire ou organisme financeur.",
        url: "https://entreprendre.service-public.fr/vosdroits/R18133"
      },
      {
        title: "France Num",
        fit: digitalFit,
        detail: "Aides et ressources pour financer la transformation numérique des TPE/PME.",
        url: "https://www.francenum.gouv.fr/aides-financieres"
      },
      {
        title: "Subventions numériques",
        fit: digitalFit,
        detail: "Pistes locales pour diagnostic, accompagnement, matériel ou prestataire numérique.",
        url: "https://www.francenum.gouv.fr/aides-financieres/formes-de-financement/subventions-et-cheques-numeriques"
      },
      {
        title: "Aides création / reprise",
        fit: creationFit,
        detail: "À regarder si l'entreprise est récente, en création, reprise ou développement.",
        url: "https://entreprendre.service-public.fr/vosdroits/F35240"
      },
      {
        title: "Acre",
        fit: creationFit,
        detail: "Exonération temporaire de cotisations sociales sous conditions en début d'activité.",
        url: "https://entreprendre.service-public.fr/vosdroits/F11677"
      },
      {
        title: "Aides innovation",
        fit: rate < .25 ? "À explorer" : "Moyen",
        detail: "Simulateur utile si l'activité engage des dépenses de R&D, prototype ou innovation.",
        url: "https://entreprendre.service-public.fr/vosdroits/R72221"
      },
      {
        title: "Les-aides.fr",
        fit: "Recherche locale",
        detail: "Base spécialisée pour repérer des aides par profil, région et projet.",
        url: "https://les-aides.fr/"
      },
      {
        title: "Financement création/reprise",
        fit: revenue < 3000 ? "À vérifier" : "Moyen",
        detail: "Panorama des financements publics et dispositifs selon le profil du dirigeant.",
        url: "https://entreprendre.service-public.fr/vosdroits/F35930"
      }
    ];

    nodes.aidGrid.innerHTML = aidCards.map((aid) => `
      <article class="aid-card">
        <div>
          <h3>${escapeHTML(aid.title)}</h3>
          <p>${escapeHTML(aid.detail)}</p>
          <div class="aid-meta">
            <span class="tag">${escapeHTML(aid.fit)}</span>
            <span class="tag">${escapeHTML(profile.city || "Territoire à préciser")}</span>
          </div>
        </div>
        <a href="${escapeHTML(aid.url)}" target="_blank" rel="noreferrer">Consulter</a>
      </article>
    `).join("");
  }

  function renderScore(){
    const score = calculateOpportunityScore();
    nodes.opportunityScore.textContent = String(score);
    nodes.opportunityScoreLabel.textContent = getScoreLabel(score);
  }

  function renderAll(){
    renderSavings();
    renderProspects();
    renderCrm();
    renderAids();
    renderScore();
  }

  function exportCrm(){
    if(state.leads.length === 0){
      toast("Export", "Aucun contact à exporter.");
      return;
    }

    const headers = ["Nom", "Contact", "Statut", "Relance", "Score", "Note"];
    const rows = state.leads.map((lead) => [
      lead.name,
      lead.contact,
      getStatusLabel(lead.status),
      lead.followUp,
      lead.score,
      lead.note
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `assistant-croissance-crm-${todayISO()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetData(){
    const confirmed = window.confirm("Réinitialiser le profil, les prospects et le CRM ?");
    if(!confirmed) return;

    state = structuredClone(defaultState);
    saveState();
    fillForms();
    renderAll();
    toast("Assistant", "Données réinitialisées.");
  }

  function bindEvents(){
    nodes.profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.profile = getProfileFromForm();
      saveState();
      renderAll();
      toast("Profil", "Profil entreprise enregistré.");
    });

    nodes.financeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.finance = getFinanceFromForm();
      saveState();
      renderAll();
      toast("Finances", "Analyse mise à jour.");
    });

    $$("input, select, textarea", nodes.profileForm).forEach((field) => {
      field.addEventListener("change", () => {
        state.profile = getProfileFromForm();
        saveState();
        renderAll();
      });
    });

    $$("input", nodes.financeForm).forEach((field) => {
      field.addEventListener("change", () => {
        state.finance = getFinanceFromForm();
        saveState();
        renderAll();
      });
    });

    nodes.generateProspectsButton.addEventListener("click", generateProspects);
    nodes.generateMessageButton.addEventListener("click", generateMessage);
    nodes.copyMessageButton.addEventListener("click", copyMessage);
    nodes.exportCrmButton.addEventListener("click", exportCrm);
    nodes.resetGrowthButton.addEventListener("click", resetData);
    nodes.refreshAidButton.addEventListener("click", () => {
      state.profile = getProfileFromForm();
      state.finance = getFinanceFromForm();
      saveState();
      renderAids();
      toast("Aides publiques", "Radar actualisé.");
    });

    nodes.addManualLeadButton.addEventListener("click", () => {
      $("#leadName").focus();
    });

    nodes.leadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addManualLead();
    });

    nodes.messageProspect.addEventListener("change", () => {
      state.selectedProspectId = nodes.messageProspect.value;
      saveState();
    });

    nodes.generatedMessage.addEventListener("input", () => {
      state.generatedMessage = nodes.generatedMessage.value;
      saveState();
    });

    document.addEventListener("click", (event) => {
      const addLeadButton = event.target.closest("[data-add-lead]");
      const messageButton = event.target.closest("[data-message-prospect]");
      const contactedButton = event.target.closest("[data-lead-contacted]");
      const followButton = event.target.closest("[data-lead-follow]");
      const wonButton = event.target.closest("[data-lead-won]");
      const deleteButton = event.target.closest("[data-lead-delete]");

      if(addLeadButton){
        addLeadFromProspect(addLeadButton.dataset.addLead);
      }

      if(messageButton){
        state.selectedProspectId = messageButton.dataset.messageProspect;
        renderProspectSelect();
        generateMessage();
      }

      if(contactedButton){
        updateLead(contactedButton.dataset.leadContacted, {
          status: "contacte",
          followUp: addDays(3)
        });
      }

      if(followButton){
        updateLead(followButton.dataset.leadFollow, {
          status: "relance",
          followUp: addDays(3)
        });
      }

      if(wonButton){
        updateLead(wonButton.dataset.leadWon, {
          status: "gagne",
          followUp: ""
        });
      }

      if(deleteButton){
        deleteLead(deleteButton.dataset.leadDelete);
      }
    });
  }

  fillForms();
  if(state.prospects.length === 0){
    state.prospects = buildProspectTemplates();
    state.selectedProspectId = state.prospects[0]?.id || "";
    saveState();
  }
  bindEvents();
  renderAll();
})();
