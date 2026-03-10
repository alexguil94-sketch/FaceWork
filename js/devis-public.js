(function(){
  const DATA = window.DEVIS_PUBLIC_DATA || {};
  const catalog = Array.isArray(DATA.categories) ? DATA.categories : [];
  const highlightedOffers = Array.isArray(DATA.highlightedOffers) ? DATA.highlightedOffers : [];
  const faqItems = Array.isArray(DATA.faq) ? DATA.faq : [];
  const projectTypes = Array.isArray(DATA.projectTypes) ? DATA.projectTypes : [];
  const serviceGroupsNode = document.getElementById("service-groups");
  const serviceNavNode = document.getElementById("service-nav");
  const highlightedOffersNode = document.getElementById("highlighted-offers");
  const faqGridNode = document.getElementById("faq-grid");
  const metricsNode = document.getElementById("summary-metrics");
  const selectedServicesNode = document.getElementById("selected-services");
  const documentNode = document.getElementById("quote-document");
  const jsonNode = document.getElementById("summary-json");
  const requestForm = document.getElementById("quote-request-form");
  const projectTypeField = document.getElementById("project-type");
  const estimatedBudgetField = document.getElementById("estimated-budget");
  const summaryJsonField = document.getElementById("summary-json-field");
  const toast = document.querySelector(".toast");
  const STORAGE_KEY = "digitalex-premium-quote-v2";
  const CONTACT_EMAIL = DATA.contactEmail || "alexguil94@hotmail.fr";
  const COMPANY = DATA.companyName || "Digitalex Studio";
  const LEGAL_NOTE = DATA.legalNote || "Tarifs indicatifs. Le devis final reste ajuste au besoin reel.";
  const serviceIndex = new Map();
  const categoryIndex = new Map();

  if(
    !serviceGroupsNode
    || !serviceNavNode
    || !highlightedOffersNode
    || !faqGridNode
    || !metricsNode
    || !selectedServicesNode
    || !documentNode
    || !jsonNode
    || !requestForm
    || !projectTypeField
    || !estimatedBudgetField
    || !summaryJsonField
  ){
    return;
  }

  catalog.forEach(function(category){
    categoryIndex.set(category.id, category);
    (category.items || []).forEach(function(service){
      serviceIndex.set(service.id, { ...service, categoryId: category.id, categoryTitle: category.title });
    });
  });

  const defaultState = {
    quoteNumber: buildQuoteNumber(),
    issueDate: todayIso(),
    selections: {},
  };

  const state = loadState();

  renderStaticContent();
  renderAll();
  bindEvents();

  function bindEvents(){
    serviceGroupsNode.addEventListener("click", function(event){
      const toggle = event.target.closest("[data-service-toggle]");
      if(toggle){
        toggleService(toggle.getAttribute("data-service-toggle"));
        return;
      }

      const step = event.target.closest("[data-quantity-step]");
      if(step){
        const id = step.getAttribute("data-service-id");
        const delta = Number(step.getAttribute("data-quantity-step"));
        updateQuantity(id, getSelectionQuantity(id) + delta);
        return;
      }

      const quickCard = event.target.closest("[data-service-card]");
      if(
        quickCard
        && !event.target.closest("input")
        && !event.target.closest("button")
        && !event.target.closest("a")
      ){
        toggleService(quickCard.getAttribute("data-service-card"));
      }
    });

    serviceGroupsNode.addEventListener("input", function(event){
      const input = event.target.closest("[data-quantity-input]");
      if(!input) return;
      updateQuantity(input.getAttribute("data-service-id"), Number(input.value || 0));
    });

    selectedServicesNode.addEventListener("click", function(event){
      const remove = event.target.closest("[data-remove-service]");
      if(!remove) return;
      clearSelection(remove.getAttribute("data-remove-service"));
    });

    document.addEventListener("click", function(event){
      const actionNode = event.target.closest("[data-action]");
      if(!actionNode) return;

      const action = actionNode.getAttribute("data-action");
      if(action === "download-pdf"){
        downloadPdf();
      }else if(action === "print-quote"){
        if(!hasActiveSelections()){
          showToast("Ajoute au moins une prestation avant impression.");
          return;
        }
        window.print();
      }else if(action === "copy-json"){
        copySummaryJson();
      }else if(action === "reset-services"){
        resetSelections();
      }else if(action === "copy-summary"){
        copyReadableSummary();
      }
    });

    requestForm.addEventListener("submit", function(event){
      event.preventDefault();
      if(!requestForm.reportValidity()) return;

      const summary = buildSummary();
      const payload = buildRequestPayload(summary);
      const subject = `Demande de devis - ${payload.projectType}`;
      const body = [
        "Bonjour Alexis,",
        "",
        "Je souhaite recevoir un devis final personnalise.",
        "",
        `Nom : ${payload.lastName}`,
        `Prenom : ${payload.firstName}`,
        `Entreprise : ${payload.company || "-"}`,
        `Email : ${payload.email}`,
        `Telephone : ${payload.phone || "-"}`,
        `Type de projet : ${payload.projectType}`,
        `Budget estime : ${payload.estimatedBudget}`,
        "",
        "Prestations selectionnees :",
        ...summary.lines.map(function(line){
          return `- ${line.title} (${line.categoryTitle}) : ${formatRange(line.lineMin, line.lineMax, line.billing === "monthly" ? "/mois" : "")}${line.quantity > 1 ? ` x ${line.quantity} ${line.quantityLabel.toLowerCase()}` : ""}`;
        }),
        summary.lines.length ? "" : "- Aucune prestation selectionnee dans le simulateur.",
        "",
        "Message :",
        payload.message,
      ].join("\n");

      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      showToast("La demande de devis a ete preparee dans ton client email.");
    });
  }

  function renderStaticContent(){
    highlightedOffersNode.innerHTML = highlightedOffers.map(function(item){
      return `
        <article class="quote-anchor-card">
          <span>${escapeHtml(item.title)}</span>
          <strong>${escapeHtml(item.priceLabel)}</strong>
          <p>${escapeHtml(item.description)}</p>
        </article>
      `;
    }).join("");

    serviceNavNode.innerHTML = catalog.map(function(category){
      return `<a href="#${escapeHtml(category.id)}">${escapeHtml(category.title)}</a>`;
    }).join("");

    faqGridNode.innerHTML = faqItems.map(function(item, index){
      const delayAttr = index % 2 === 1 ? ' data-reveal-delay="1"' : "";
      return `
        <article class="surface faq-item" data-reveal${delayAttr}>
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `;
    }).join("");

    projectTypeField.innerHTML = [
      `<option value="">Choisir un type de projet</option>`,
      ...projectTypes.map(function(label){
        return `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`;
      }),
    ].join("");
  }

  function renderAll(){
    renderCatalog();
    renderSummary();
    persistState();
  }

  function renderCatalog(){
    serviceGroupsNode.innerHTML = catalog.map(function(category){
      return `
        <section class="surface service-category" id="${escapeHtml(category.id)}">
          <div class="service-category-head">
            <p class="eyebrow">${escapeHtml(category.title)}</p>
            <h3>${escapeHtml(category.title)}</h3>
            <p>${escapeHtml(category.description)}</p>
          </div>
          <div class="service-grid">
            ${(category.items || []).map(renderServiceCard).join("")}
          </div>
        </section>
      `;
    }).join("");
  }

  function renderServiceCard(service){
    const selection = state.selections[service.id];
    const isSelected = !!selection?.selected;
    const quantity = getSelectionQuantity(service.id);
    const pricingSuffix = service.billing === "monthly" ? "/mois" : "";
    const quantityMarkup = service.quantityLabel ? `
      <div class="service-quantity">
        <button class="service-stepper" type="button" data-quantity-step="-1" data-service-id="${escapeHtml(service.id)}" aria-label="Reduire la quantite">-</button>
        <label>
          <span>${escapeHtml(service.quantityLabel)}</span>
          <input
            type="number"
            min="${escapeHtml(service.minQuantity || 1)}"
            max="${escapeHtml(service.maxQuantity || 99)}"
            step="1"
            value="${escapeHtml(quantity)}"
            data-quantity-input
            data-service-id="${escapeHtml(service.id)}"
            aria-label="${escapeHtml(service.quantityLabel)} pour ${escapeHtml(service.title)}"
          />
        </label>
        <button class="service-stepper" type="button" data-quantity-step="1" data-service-id="${escapeHtml(service.id)}" aria-label="Augmenter la quantite">+</button>
      </div>
    ` : "";

    return `
      <article class="service-card${isSelected ? " is-selected" : ""}" data-service-card="${escapeHtml(service.id)}">
        <div class="service-card-head">
          <div>
            <div class="service-card-labels">
              <span class="service-chip">${escapeHtml(service.kindLabel || "Service")}</span>
              <span class="service-chip service-chip-muted">${escapeHtml(service.billing === "monthly" ? "Mensuel" : "Ponctuel")}</span>
              ${service.featured ? '<span class="service-chip">Principal</span>' : ""}
            </div>
            <h3>${escapeHtml(service.title)}</h3>
            <p>${escapeHtml(service.description)}</p>
          </div>
          <button
            class="service-toggle"
            type="button"
            data-service-toggle="${escapeHtml(service.id)}"
            aria-pressed="${isSelected ? "true" : "false"}"
          >${isSelected ? "Ajoutee" : "Selectionner"}</button>
        </div>

        <div class="service-price-row">
          <div class="service-price">
            ${escapeHtml(service.pricingLabel)}
            <small>${escapeHtml(service.billing === "monthly" ? "Facturation recurrente" : "Prestation ponctuelle")}</small>
          </div>
          <span class="service-from">${escapeHtml(service.fromLabel || formatRange(service.min, service.max, pricingSuffix))}</span>
        </div>

        ${quantityMarkup}
      </article>
    `;
  }

  function renderSummary(){
    const summary = buildSummary();
    metricsNode.innerHTML = buildMetricsMarkup(summary);
    selectedServicesNode.innerHTML = buildSelectedServicesMarkup(summary);
    documentNode.innerHTML = buildPrintableDocument(summary);
    jsonNode.textContent = JSON.stringify(summary.jsonPayload, null, 2);
    estimatedBudgetField.value = summary.budgetLabel;
    summaryJsonField.value = JSON.stringify(summary.jsonPayload);
    syncSuggestedProjectType(summary);
  }

  function buildSummary(){
    let oneTimeMin = 0;
    let oneTimeMax = 0;
    let recurringMin = 0;
    let recurringMax = 0;
    let recurringProjectionMin = 0;
    let recurringProjectionMax = 0;
    let selectedCount = 0;
    const lines = [];
    const categoryCounts = new Map();

    serviceIndex.forEach(function(service){
      const selection = state.selections[service.id];
      if(!selection?.selected) return;

      const quantity = getSelectionQuantity(service.id);
      const lineMin = service.min * quantity;
      const lineMax = service.max * quantity;
      selectedCount += 1;

      categoryCounts.set(service.categoryTitle, Number(categoryCounts.get(service.categoryTitle) || 0) + 1);

      if(service.billing === "monthly"){
        recurringMin += service.min;
        recurringMax += service.max;
        recurringProjectionMin += lineMin;
        recurringProjectionMax += lineMax;
      }else{
        oneTimeMin += lineMin;
        oneTimeMax += lineMax;
      }

      lines.push({
        id: service.id,
        title: service.title,
        categoryId: service.categoryId,
        categoryTitle: service.categoryTitle,
        billing: service.billing,
        quantity,
        quantityLabel: service.quantityLabel || "Unite",
        unitMin: service.min,
        unitMax: service.max,
        lineMin,
        lineMax,
        pricingLabel: service.pricingLabel,
        fromLabel: service.fromLabel,
      });
    });

    const launchMin = oneTimeMin + recurringMin;
    const launchMax = oneTimeMax + recurringMax;
    const projectionMin = oneTimeMin + recurringProjectionMin;
    const projectionMax = oneTimeMax + recurringProjectionMax;
    const dominantCategory = Array.from(categoryCounts.entries()).sort(function(a, b){
      return b[1] - a[1];
    })[0]?.[0] || "";

    const budgetLabel = selectedCount
      ? `${formatRange(launchMin, launchMax)}${recurringMin || recurringMax ? ` au lancement, puis ${formatRange(recurringMin, recurringMax, " / mois")}` : ""}`
      : "A definir apres selection";

    return {
      quoteNumber: state.quoteNumber,
      issueDate: state.issueDate,
      validUntil: addDaysIso(state.issueDate, 30),
      selectedCount,
      oneTimeMin,
      oneTimeMax,
      recurringMin,
      recurringMax,
      recurringProjectionMin,
      recurringProjectionMax,
      launchMin,
      launchMax,
      projectionMin,
      projectionMax,
      budgetLabel,
      dominantCategory,
      lines,
      jsonPayload: {
        quote_number: state.quoteNumber,
        issue_date: state.issueDate,
        valid_until: addDaysIso(state.issueDate, 30),
        provider: COMPANY,
        note: LEGAL_NOTE,
        totals: {
          launch: { min: launchMin, max: launchMax },
          recurring_monthly: { min: recurringMin, max: recurringMax },
          projection: { min: projectionMin, max: projectionMax },
        },
        selected_services: lines.map(function(line){
          return {
            id: line.id,
            title: line.title,
            category: line.categoryTitle,
            billing: line.billing,
            quantity: line.quantity,
            quantity_label: line.quantityLabel,
            unit_min: line.unitMin,
            unit_max: line.unitMax,
            line_min: line.lineMin,
            line_max: line.lineMax,
          };
        }),
      },
    };
  }

  function buildMetricsMarkup(summary){
    const metrics = [
      {
        label: "Budget de lancement",
        value: summary.selectedCount ? formatRange(summary.launchMin, summary.launchMax) : "A definir",
      },
      {
        label: "Budget mensuel",
        value: summary.recurringMin || summary.recurringMax ? formatRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun service mensuel",
      },
      {
        label: "Projection totale",
        value: summary.selectedCount ? formatRange(summary.projectionMin, summary.projectionMax) : "A definir",
      },
      {
        label: "Prestations choisies",
        value: summary.selectedCount ? `${summary.selectedCount} bloc${summary.selectedCount > 1 ? "s" : ""}` : "Aucune pour le moment",
      },
    ];

    return metrics.map(function(metric){
      return `
        <div class="quote-metric-card">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
        </div>
      `;
    }).join("");
  }

  function buildSelectedServicesMarkup(summary){
    if(!summary.lines.length){
      return `<p class="quote-selection-empty">Choisis une ou plusieurs prestations pour afficher un recapitulatif clair et preparer un devis final.</p>`;
    }

    return summary.lines.map(function(line){
      const recurringText = line.billing === "monthly"
        ? `${formatRange(line.unitMin, line.unitMax, " / mois")} · ${line.quantity} ${line.quantityLabel.toLowerCase()}`
        : `${formatRange(line.lineMin, line.lineMax)}${line.quantity > 1 ? ` · ${line.quantity} ${line.quantityLabel.toLowerCase()}` : ""}`;

      return `
        <article class="quote-selection-row">
          <div class="quote-selection-line">
            <div>
              <strong>${escapeHtml(line.title)}</strong>
              <span>${escapeHtml(line.categoryTitle)}</span>
            </div>
            <button class="quote-selection-remove" type="button" data-remove-service="${escapeHtml(line.id)}">Retirer</button>
          </div>
          <div class="quote-selection-meta">${escapeHtml(recurringText)}</div>
          <div class="quote-selection-meta">Projection : ${escapeHtml(formatRange(line.lineMin, line.lineMax))}</div>
        </article>
      `;
    }).join("");
  }

  function buildPrintableDocument(summary){
    if(!summary.lines.length){
      return `
        <div class="quote-doc-top">
          <div class="quote-doc-brand">
            <p class="eyebrow">${escapeHtml(COMPANY)}</p>
            <strong>Devis estimatif</strong>
            <p class="quote-doc-empty">Aucune prestation selectionnee pour le moment.</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="quote-doc-top">
        <div class="quote-doc-brand">
          <p class="eyebrow">${escapeHtml(COMPANY)}</p>
          <strong>Devis estimatif</strong>
          <p>Simulation premium pour cadrer le projet avant emission du devis final.</p>
        </div>

        <div class="quote-doc-badge">
          <span>${escapeHtml(summary.quoteNumber)}</span>
          <strong>Emission : ${escapeHtml(formatDate(summary.issueDate))}</strong>
          <strong>Validite : ${escapeHtml(formatDate(summary.validUntil))}</strong>
        </div>
      </div>

      <div class="quote-doc-grid">
        <div class="quote-doc-block">
          <span>Provider</span>
          <strong>${escapeHtml(COMPANY)}</strong>
          <p>${escapeHtml(CONTACT_EMAIL)}<br/>${escapeHtml(DATA.contactPhone || "")}</p>
        </div>
        <div class="quote-doc-block">
          <span>Cadre</span>
          <strong>${escapeHtml(summary.dominantCategory || "Projet mixte")}</strong>
          <p>${escapeHtml(LEGAL_NOTE)}</p>
        </div>
      </div>

      <table class="quote-doc-table">
        <thead>
          <tr>
            <th>Prestation</th>
            <th>Qt</th>
            <th>Type</th>
            <th>Estimation</th>
          </tr>
        </thead>
        <tbody>
          ${summary.lines.map(function(line){
            return `
              <tr>
                <td>
                  <div class="quote-doc-line">
                    <strong>${escapeHtml(line.title)}</strong>
                    <span>${escapeHtml(line.categoryTitle)} · ${escapeHtml(line.pricingLabel)}</span>
                  </div>
                </td>
                <td>${escapeHtml(line.quantity)}</td>
                <td>${escapeHtml(line.billing === "monthly" ? "Mensuel" : "Ponctuel")}</td>
                <td>${escapeHtml(formatRange(line.lineMin, line.lineMax))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <div class="quote-doc-summary">
        <div class="quote-doc-row">
          <span>Lancement</span>
          <strong>${escapeHtml(formatRange(summary.launchMin, summary.launchMax))}</strong>
        </div>
        <div class="quote-doc-row">
          <span>Mensuel</span>
          <strong>${escapeHtml(summary.recurringMin || summary.recurringMax ? formatRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun")}</strong>
        </div>
        <div class="quote-doc-row is-total">
          <span>Projection totale</span>
          <strong>${escapeHtml(formatRange(summary.projectionMin, summary.projectionMax))}</strong>
        </div>
      </div>

      <div class="quote-doc-note">
        <strong>Note</strong>
        <p>${escapeHtml(LEGAL_NOTE)}</p>
        <p>Ce document sert de base de discussion. Le devis final est personnalise selon le besoin reel, les contenus, les integrations et le niveau de finition attendu.</p>
      </div>
    `;
  }

  function buildRequestPayload(summary){
    const formData = new FormData(requestForm);
    return {
      lastName: String(formData.get("last_name") || "").trim(),
      firstName: String(formData.get("first_name") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      projectType: String(formData.get("project_type") || summary.dominantCategory || "Projet mixte").trim(),
      estimatedBudget: String(formData.get("estimated_budget") || summary.budgetLabel || "").trim(),
      message: String(formData.get("message") || "").trim(),
    };
  }

  function syncSuggestedProjectType(summary){
    const current = String(projectTypeField.value || "").trim();
    if(current) return;
    if(summary.dominantCategory){
      const options = Array.from(projectTypeField.options).map(function(option){
        return String(option.value || "");
      });
      if(options.includes(summary.dominantCategory)){
        projectTypeField.value = summary.dominantCategory;
        return;
      }
    }
    if(summary.selectedCount > 1){
      projectTypeField.value = "Projet mixte";
    }
  }

  function toggleService(serviceId){
    const current = state.selections[serviceId];
    if(current?.selected){
      clearSelection(serviceId);
      return;
    }
    const service = serviceIndex.get(serviceId);
    if(!service) return;
    state.selections[serviceId] = {
      selected: true,
      quantity: defaultQuantityFor(service),
    };
    renderAll();
  }

  function clearSelection(serviceId){
    delete state.selections[serviceId];
    renderAll();
  }

  function updateQuantity(serviceId, nextValue){
    const service = serviceIndex.get(serviceId);
    if(!service) return;
    const quantity = sanitizeQuantity(nextValue, service);
    if(!state.selections[serviceId]?.selected){
      state.selections[serviceId] = {
        selected: true,
        quantity,
      };
    }else{
      state.selections[serviceId].quantity = quantity;
    }
    renderAll();
  }

  function resetSelections(){
    state.quoteNumber = buildQuoteNumber();
    state.issueDate = todayIso();
    state.selections = {};
    renderAll();
    showToast("La simulation a ete reinitialisee.");
  }

  function hasActiveSelections(){
    return Array.from(serviceIndex.keys()).some(function(serviceId){
      return !!state.selections[serviceId]?.selected;
    });
  }

  function getSelectionQuantity(serviceId){
    const service = serviceIndex.get(serviceId);
    const raw = state.selections[serviceId]?.quantity;
    return sanitizeQuantity(raw, service);
  }

  function defaultQuantityFor(service){
    return sanitizeQuantity(service.defaultQuantity || 1, service);
  }

  function sanitizeQuantity(value, service){
    const min = Number(service?.minQuantity || 1);
    const max = Number(service?.maxQuantity || 99);
    const parsed = Math.round(Number(value || service?.defaultQuantity || 1));
    if(Number.isNaN(parsed)) return min;
    return Math.min(Math.max(parsed, min), max);
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { ...defaultState, selections: {} };
      const parsed = JSON.parse(raw) || {};
      return {
        quoteNumber: String(parsed.quoteNumber || defaultState.quoteNumber),
        issueDate: String(parsed.issueDate || defaultState.issueDate),
        selections: typeof parsed.selections === "object" && parsed.selections ? parsed.selections : {},
      };
    }catch(error){
      return { ...defaultState, selections: {} };
    }
  }

  function persistState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function copySummaryJson(){
    if(!hasActiveSelections()){
      showToast("Ajoute au moins une prestation avant de copier le JSON.");
      return;
    }
    copyText(JSON.stringify(buildSummary().jsonPayload, null, 2), "Le JSON du devis a ete copie.");
  }

  function copyReadableSummary(){
    const summary = buildSummary();
    if(!summary.lines.length){
      showToast("Ajoute au moins une prestation avant de copier le recapitulatif.");
      return;
    }
    const readable = [
      `${COMPANY} - ${summary.quoteNumber}`,
      `Lancement : ${formatRange(summary.launchMin, summary.launchMax)}`,
      `Mensuel : ${summary.recurringMin || summary.recurringMax ? formatRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun"}`,
      `Projection : ${formatRange(summary.projectionMin, summary.projectionMax)}`,
      "",
      ...summary.lines.map(function(line){
        return `- ${line.title} (${line.categoryTitle}) : ${formatRange(line.lineMin, line.lineMax)}`;
      }),
    ].join("\n");
    copyText(readable, "Le recapitulatif du devis a ete copie.");
  }

  async function copyText(text, successMessage){
    try{
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    }catch(error){
      showToast("Impossible de copier automatiquement. Selectionne le texte manuellement.");
    }
  }

  function downloadPdf(){
    const summary = buildSummary();
    if(!summary.lines.length){
      showToast("Ajoute au moins une prestation avant de generer le PDF.");
      return;
    }

    const pdfCtor = window.jspdf?.jsPDF;
    if(typeof pdfCtor !== "function"){
      showToast("La librairie PDF n'est pas disponible.");
      return;
    }

    const pdf = new pdfCtor({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 42;

    pdf.setFillColor(8, 17, 32);
    pdf.rect(0, 0, pageWidth, 18, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.setTextColor(16, 24, 39);
    pdf.text("DEVIS ESTIMATIF", margin, 56);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    pdf.text(COMPANY, margin, 76);
    pdf.text(`Numero : ${summary.quoteNumber}`, pageWidth - margin - 170, 42);
    pdf.text(`Emission : ${formatDate(summary.issueDate)}`, pageWidth - margin - 170, 58);
    pdf.text(`Validite : ${formatDate(summary.validUntil)}`, pageWidth - margin - 170, 74);

    pdf.setFont("helvetica", "bold");
    pdf.text("Cadre", margin, 118);
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(`Projet ${summary.dominantCategory || "mixte"} avec estimation indicative. ${LEGAL_NOTE}`, pageWidth - (margin * 2)), margin, 136);

    if(typeof pdf.autoTable === "function"){
      pdf.autoTable({
        startY: 190,
        margin: { left: margin, right: margin },
        head: [["Prestation", "Categorie", "Qt", "Facturation", "Estimation"]],
        body: summary.lines.map(function(line){
          return [
            line.title,
            line.categoryTitle,
            String(line.quantity),
            line.billing === "monthly" ? "Mensuel" : "Ponctuel",
            formatRange(line.lineMin, line.lineMax),
          ];
        }),
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 10,
          textColor: [18, 24, 39],
          lineColor: [228, 234, 242],
        },
        headStyles: {
          fillColor: [8, 17, 32],
          textColor: [245, 248, 255],
          fontStyle: "bold",
        },
      });
    }

    let y = (pdf.lastAutoTable?.finalY || 240) + 24;
    const rows = [
      ["Lancement", formatRange(summary.launchMin, summary.launchMax)],
      ["Mensuel", summary.recurringMin || summary.recurringMax ? formatRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun"],
      ["Projection totale", formatRange(summary.projectionMin, summary.projectionMax)],
    ];

    pdf.setFont("helvetica", "bold");
    pdf.text("Recapitulatif", pageWidth - 210, y);
    y += 18;
    pdf.setFont("helvetica", "normal");
    rows.forEach(function(row, index){
      if(index === rows.length - 1){
        pdf.setFont("helvetica", "bold");
      }
      pdf.text(row[0], pageWidth - 210, y);
      pdf.text(row[1], pageWidth - margin, y, { align: "right" });
      if(index === rows.length - 1){
        pdf.setFont("helvetica", "normal");
      }
      y += 18;
    });

    y += 18;
    pdf.setFont("helvetica", "bold");
    pdf.text("Note", margin, y);
    y += 16;
    pdf.setFont("helvetica", "normal");
    pdf.text(pdf.splitTextToSize(`${LEGAL_NOTE} Le devis final est personnalise apres echange et validation du perimetre.`, pageWidth - (margin * 2)), margin, y);

    pdf.save(`${slugify(summary.quoteNumber || "devis-digitalex-studio") || "devis-digitalex-studio"}.pdf`);
    showToast("Le PDF du devis a ete telecharge.");
  }

  function buildQuoteNumber(){
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `DEV-${y}-${m}${d}-${h}${min}`;
  }

  function todayIso(){
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysIso(iso, days){
    const base = new Date(`${iso}T12:00:00`);
    base.setDate(base.getDate() + Number(days || 0));
    return base.toISOString().slice(0, 10);
  }

  function formatDate(iso){
    if(!iso) return "-";
    const value = new Date(`${iso}T12:00:00`);
    if(Number.isNaN(value.getTime())) return iso;
    return value.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function formatMoney(value){
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: DATA.currency || "EUR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

  function formatRange(min, max, suffix){
    const extra = suffix || "";
    if(Number(min) === Number(max)){
      return `${formatMoney(min)}${extra}`;
    }
    return `${formatMoney(min)} a ${formatMoney(max)}${extra}`;
  }

  function slugify(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value){
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message){
    if(window.fwToast){
      window.fwToast("Devis", message);
      return;
    }
    if(!toast) return;
    const title = toast.querySelector(".t");
    const detail = toast.querySelector(".d");
    if(title) title.textContent = "Devis";
    if(detail) detail.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(function(){
      toast.classList.remove("show");
    }, 2600);
  }
})();
