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
  const documentPreviewStatsNode = document.getElementById("quote-document-preview-stats");
  const quotePreviewModal = document.getElementById("quote-preview-modal");
  const modalDocumentNode = document.getElementById("quote-document-modal");
  const requestForm = document.getElementById("quote-request-form");
  const projectTypeField = document.getElementById("project-type");
  const estimatedBudgetField = document.getElementById("estimated-budget");
  const summaryJsonField = document.getElementById("summary-json-field");
  const clientFieldNodes = Array.from(document.querySelectorAll("[data-client-field]"));
  const CLIENT_FIELDS = ["first_name", "last_name", "company", "email", "phone"];
  const clientFieldMap = new Map(clientFieldNodes.map(function(node){
    return [node.getAttribute("data-client-field"), node];
  }));
  const toast = document.querySelector(".toast");
  const STORAGE_KEY = "digitalex-premium-quote-v2";
  const CONTACT_EMAIL = DATA.contactEmail || "alexguil94@hotmail.fr";
  const COMPANY = DATA.companyName || "Digitalexis-Studio";
  const LEGAL_NOTE = DATA.legalNote || "Tarifs indicatifs. Le devis final reste ajuste au besoin reel.";
  const PDF_LOGO_URL = DATA.logoUrl || "assets/favicon_DS.png";
  const serviceIndex = new Map();
  const categoryIndex = new Map();
  let quotePreviewFocusNode = null;

  if(
    !serviceGroupsNode
    || !serviceNavNode
    || !highlightedOffersNode
    || !faqGridNode
    || !metricsNode
    || !selectedServicesNode
    || !documentNode
    || !documentPreviewStatsNode
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
    client: buildEmptyClientState(),
    selections: {},
    expandedCategories: buildInitialExpandedCategories(),
  };

  const state = loadState();

  renderStaticContent();
  syncClientFields("init");
  renderAll();
  bindEvents();

  function bindEvents(){
    clientFieldNodes.forEach(function(field){
      field.addEventListener("input", function(){
        updateClientDetails(field.getAttribute("data-client-field"), field.value, "sidebar");
      });
    });

    serviceNavNode.addEventListener("click", function(event){
      const jump = event.target.closest("[data-category-jump]");
      if(!jump) return;
      openCategory(jump.getAttribute("data-category-jump"), { scrollIntoView: true });
    });

    serviceGroupsNode.addEventListener("click", function(event){
      const categoryToggle = event.target.closest("[data-category-toggle]");
      if(categoryToggle){
        toggleCategory(categoryToggle.getAttribute("data-category-toggle"));
        return;
      }

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
      }else if(action === "reset-services"){
        resetSelections();
      }else if(action === "copy-summary"){
        copyReadableSummary();
      }else if(action === "open-quote-preview"){
        openQuotePreview(actionNode);
      }
    });

    if(quotePreviewModal){
      quotePreviewModal.addEventListener("click", function(event){
        if(event.target === quotePreviewModal || event.target.closest("[data-quote-preview-close]")){
          closeQuotePreview();
        }
      });
    }

    document.addEventListener("keydown", function(event){
      if(event.key === "Escape" && quotePreviewModal && !quotePreviewModal.hidden){
        closeQuotePreview();
      }
    });

    requestForm.addEventListener("input", function(event){
      const field = event.target.closest("[name]");
      if(!field) return;
      const fieldName = field.getAttribute("name");
      if(!CLIENT_FIELDS.includes(fieldName)) return;
      updateClientDetails(fieldName, field.value, "form");
    });

    requestForm.addEventListener("submit", function(event){
      event.preventDefault();
      if(!requestForm.reportValidity()) return;

      syncClientStateFromRequestForm();
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
    renderCategoryNav();
    renderCatalog();
    renderSummary();
    persistState();
  }

  function renderCategoryNav(){
    serviceNavNode.innerHTML = catalog.map(function(category){
      const selectedCount = getCategorySelectionCount(category.id);
      const isActive = isCategoryExpanded(category.id);
      return `
        <button
          type="button"
          class="${isActive ? "is-active" : ""}"
          data-category-jump="${escapeHtml(category.id)}"
          aria-pressed="${isActive ? "true" : "false"}"
        >
          <span>${escapeHtml(category.title)}</span>
          <span class="quote-category-nav-count">${escapeHtml(selectedCount)}</span>
        </button>
      `;
    }).join("");
  }

  function renderCatalog(){
    serviceGroupsNode.innerHTML = catalog.map(function(category){
      const isExpanded = isCategoryExpanded(category.id);
      const selectedCount = getCategorySelectionCount(category.id);
      const offerCount = Array.isArray(category.items) ? category.items.length : 0;
      return `
        <section class="surface service-category${isExpanded ? " is-open" : ""}" id="${escapeHtml(category.id)}">
          <button
            class="service-category-toggle"
            type="button"
            data-category-toggle="${escapeHtml(category.id)}"
            aria-expanded="${isExpanded ? "true" : "false"}"
            aria-controls="category-panel-${escapeHtml(category.id)}"
          >
            <div class="service-category-head">
              <p class="eyebrow">${escapeHtml(category.title)}</p>
              <h3>${escapeHtml(category.title)}</h3>
              <p>${escapeHtml(category.description)}</p>
            </div>
            <div class="service-category-meta">
              <div class="service-category-badges">
                <span class="service-category-badge">${escapeHtml(offerCount)} offre${offerCount > 1 ? "s" : ""}</span>
                <span class="service-category-badge${selectedCount ? " is-accent" : ""}">${selectedCount ? `${escapeHtml(selectedCount)} retenue${selectedCount > 1 ? "s" : ""}` : "Aucune retenue"}</span>
              </div>
              <span class="service-category-caret" aria-hidden="true"></span>
            </div>
          </button>
          <div class="service-category-panel${isExpanded ? " is-open" : ""}" id="category-panel-${escapeHtml(category.id)}" aria-hidden="${isExpanded ? "false" : "true"}" ${isExpanded ? "" : "inert"}>
            <div class="service-category-panel-inner">
              <div class="service-grid">
                ${(category.items || []).map(renderServiceCard).join("")}
              </div>
            </div>
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
    if(modalDocumentNode){
      modalDocumentNode.innerHTML = buildPrintableDocument(summary);
    }
    documentPreviewStatsNode.innerHTML = buildDocumentPreviewStats(summary);
    estimatedBudgetField.value = summary.budgetLabel;
    summaryJsonField.value = JSON.stringify(summary.jsonPayload);
    syncSuggestedProjectType(summary);
  }

  function buildSummary(){
    const client = buildClientSummary();
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
      client,
      lines,
      jsonPayload: {
        quote_number: state.quoteNumber,
        issue_date: state.issueDate,
        valid_until: addDaysIso(state.issueDate, 30),
        provider: COMPANY,
        client: {
          first_name: client.first_name,
          last_name: client.last_name,
          full_name: client.fullName,
          company: client.company,
          email: client.email,
          phone: client.phone,
          display_name: client.displayName,
        },
        note: LEGAL_NOTE,
        budget_label: budgetLabel,
        dominant_category: dominantCategory || "Projet mixte",
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

  function buildDocumentPreviewStats(summary){
    const pills = [
      summary.quoteNumber,
      summary.client.displayName,
      summary.selectedCount ? `${summary.selectedCount} prestation${summary.selectedCount > 1 ? "s" : ""}` : "Aucune prestation",
    ];
    return pills.map(function(label){
      return `<span class="quote-document-preview-pill">${escapeHtml(label)}</span>`;
    }).join("");
  }

  function buildPrintableDocument(summary){
    if(!summary.lines.length){
      return `
        <div class="quote-doc-top">
          <div class="quote-doc-brand">
            <p class="eyebrow">${escapeHtml(COMPANY)}</p>
            <strong>Devis estimatif</strong>
            <p class="quote-doc-empty">Aucune prestation selectionnee pour le moment${summary.client.hasAny ? ` pour ${escapeHtml(summary.client.displayName)}` : ""}.</p>
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
        <div class="quote-doc-block quote-doc-block-client">
          <span>Client</span>
          <strong>${escapeHtml(summary.client.displayName)}</strong>
          <p>${buildClientDetailsHtml(summary.client)}</p>
        </div>
        <div class="quote-doc-block quote-doc-block-wide">
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
    const client = buildClientSummary();
    return {
      lastName: String(formData.get("last_name") || client.last_name || "").trim(),
      firstName: String(formData.get("first_name") || client.first_name || "").trim(),
      company: String(formData.get("company") || client.company || "").trim(),
      email: String(formData.get("email") || client.email || "").trim(),
      phone: String(formData.get("phone") || client.phone || "").trim(),
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
    ensureCategoryExpanded(service.categoryId);
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
    ensureCategoryExpanded(service.categoryId);
    renderAll();
  }

  function resetSelections(){
    state.quoteNumber = buildQuoteNumber();
    state.issueDate = todayIso();
    state.selections = {};
    state.expandedCategories = buildInitialExpandedCategories();
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

  function buildInitialExpandedCategories(selections){
    const selectedCategoryIds = getSelectedCategoryIdsFromSelections(selections);
    if(selectedCategoryIds.length){
      return selectedCategoryIds;
    }
    const firstCategoryId = String(catalog[0]?.id || "").trim();
    return firstCategoryId ? [firstCategoryId] : [];
  }

  function sanitizeExpandedCategories(raw){
    if(!Array.isArray(raw)) return [];
    return raw
      .map(function(value){
        return String(value || "").trim();
      })
      .filter(function(categoryId, index, list){
        return categoryId && categoryIndex.has(categoryId) && list.indexOf(categoryId) === index;
      });
  }

  function getSelectedCategoryIdsFromSelections(selections){
    if(!selections || typeof selections !== "object") return [];
    const seen = [];
    Object.keys(selections).forEach(function(serviceId){
      if(!selections[serviceId]?.selected) return;
      const service = serviceIndex.get(serviceId);
      if(!service?.categoryId || seen.includes(service.categoryId)) return;
      seen.push(service.categoryId);
    });
    return seen;
  }

  function getCategorySelectionCount(categoryId){
    const category = categoryIndex.get(categoryId);
    if(!category?.items?.length) return 0;
    return category.items.reduce(function(total, service){
      return total + (state.selections[service.id]?.selected ? 1 : 0);
    }, 0);
  }

  function isCategoryExpanded(categoryId){
    return Array.isArray(state.expandedCategories) && state.expandedCategories.includes(categoryId);
  }

  function ensureCategoryExpanded(categoryId){
    if(!categoryId || isCategoryExpanded(categoryId)) return;
    state.expandedCategories = sanitizeExpandedCategories([...(state.expandedCategories || []), categoryId]);
  }

  function toggleCategory(categoryId){
    if(!categoryId || !categoryIndex.has(categoryId)) return;
    if(isCategoryExpanded(categoryId)){
      state.expandedCategories = sanitizeExpandedCategories((state.expandedCategories || []).filter(function(currentId){
        return currentId !== categoryId;
      }));
    }else{
      state.expandedCategories = sanitizeExpandedCategories([...(state.expandedCategories || []), categoryId]);
    }
    renderAll();
  }

  function openCategory(categoryId, options){
    if(!categoryId || !categoryIndex.has(categoryId)) return;
    ensureCategoryExpanded(categoryId);
    renderAll();
    if(options?.scrollIntoView){
      window.requestAnimationFrame(function(){
        const target = document.getElementById(categoryId);
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      });
    }
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw){
        return {
          ...defaultState,
          client: buildEmptyClientState(),
          selections: {},
          expandedCategories: buildInitialExpandedCategories(),
        };
      }
      const parsed = JSON.parse(raw) || {};
      const selections = typeof parsed.selections === "object" && parsed.selections ? parsed.selections : {};
      const expandedCategories = sanitizeExpandedCategories(parsed.expandedCategories);
      return {
        quoteNumber: String(parsed.quoteNumber || defaultState.quoteNumber),
        issueDate: String(parsed.issueDate || defaultState.issueDate),
        client: sanitizeClientState(parsed.client),
        selections,
        expandedCategories: expandedCategories.length
          ? sanitizeExpandedCategories([...expandedCategories, ...getSelectedCategoryIdsFromSelections(selections)])
          : buildInitialExpandedCategories(selections),
      };
    }catch(error){
      return {
        ...defaultState,
        client: buildEmptyClientState(),
        selections: {},
        expandedCategories: buildInitialExpandedCategories(),
      };
    }
  }

  function persistState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function openQuotePreview(triggerNode){
    if(!quotePreviewModal) return;
    quotePreviewFocusNode = triggerNode || document.activeElement;
    quotePreviewModal.hidden = false;
    document.body.classList.add("has-modal-open");
    window.requestAnimationFrame(function(){
      quotePreviewModal.querySelector("button[data-quote-preview-close]")?.focus?.();
    });
  }

  function closeQuotePreview(){
    if(!quotePreviewModal) return;
    quotePreviewModal.hidden = true;
    document.body.classList.remove("has-modal-open");
    if(quotePreviewFocusNode && typeof quotePreviewFocusNode.focus === "function"){
      quotePreviewFocusNode.focus();
    }
    quotePreviewFocusNode = null;
  }

  function copyReadableSummary(){
    const summary = buildSummary();
    if(!summary.lines.length){
      showToast("Ajoute au moins une prestation avant de copier le recapitulatif.");
      return;
    }
    const readable = [
      `${COMPANY} - ${summary.quoteNumber}`,
      summary.client.hasAny ? `Client : ${summary.client.displayName}` : "",
      summary.client.company && summary.client.company !== summary.client.displayName ? `Entreprise : ${summary.client.company}` : "",
      summary.client.email ? `Email : ${summary.client.email}` : "",
      summary.client.phone ? `Telephone : ${summary.client.phone}` : "",
      `Lancement : ${formatRange(summary.launchMin, summary.launchMax)}`,
      `Mensuel : ${summary.recurringMin || summary.recurringMax ? formatRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun"}`,
      `Projection : ${formatRange(summary.projectionMin, summary.projectionMax)}`,
      "",
      ...summary.lines.map(function(line){
        return `- ${line.title} (${line.categoryTitle}) : ${formatRange(line.lineMin, line.lineMax)}`;
      }),
    ].filter(Boolean).join("\n");
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

  async function downloadPdf(){
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

    try{
      const pdf = new pdfCtor({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 42;
      const contentWidth = pageWidth - (margin * 2);
      const palette = {
        page: [244, 247, 255],
        surface: [255, 255, 255],
        surfaceSoft: [247, 250, 255],
        line: [218, 227, 239],
        text: [16, 24, 39],
        muted: [102, 112, 133],
        dark: [5, 7, 13],
        darkSoft: [11, 18, 32],
        cyan: [42, 182, 255],
        orange: [255, 146, 44],
        gold: [255, 211, 140],
      };
      const projectType = sanitizePdfText(projectTypeField.value || summary.dominantCategory || "Projet mixte");
      const selectedLabel = `${summary.selectedCount} prestation${summary.selectedCount > 1 ? "s" : ""} selectionnee${summary.selectedCount > 1 ? "s" : ""}`;

      paintPdfPageBackground(pdf, pageWidth, pageHeight, palette.page);

      const logo = await resolvePublicPdfLogo();
      const header = { x: margin, y: 28, w: contentWidth, h: 138 };
      const metaWidth = 168;
      const metaX = header.x + header.w - metaWidth - 20;
      const titleX = logo ? header.x + 84 : header.x + 26;
      const titleMaxWidth = Math.max(140, metaX - titleX - 28);
      const cardPaddingX = 18;
      const cardLineHeight = getPdfLineHeight(10, 1.32);
      const metricPaddingX = 18;
      const metricLineHeight = getPdfLineHeight(16, 1.16);

      pdf.setFillColor(...palette.dark);
      pdf.roundedRect(header.x, header.y, header.w, header.h, 28, 28, "F");
      pdf.setFillColor(...palette.cyan);
      pdf.rect(header.x, header.y, 160, 6, "F");
      pdf.setFillColor(...palette.orange);
      pdf.rect(header.x + 160, header.y, 88, 6, "F");
      pdf.setFillColor(...palette.cyan);
      pdf.circle(header.x + header.w - 56, header.y + 28, 8, "F");
      pdf.setFillColor(...palette.orange);
      pdf.circle(header.x + header.w - 30, header.y + 46, 6, "F");

      if(logo){
        pdf.addImage(logo, "PNG", header.x + 24, header.y + 24, 50, 50, undefined, "FAST");
      }

      pdf.setTextColor(236, 244, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(sanitizePdfText(COMPANY.toUpperCase()), titleX, header.y + 34);
      const headerTitle = "DEVIS ESTIMATIF";
      const titleFontSize = fitPdfFontSize(pdf, headerTitle, titleMaxWidth, 28, 22);
      pdf.setFontSize(titleFontSize);
      pdf.text(headerTitle, titleX, header.y + 68);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(194, 205, 225);
      const subtitleLines = pdf.splitTextToSize(
        sanitizePdfText(`Simulation premium pour ${projectType.toLowerCase()}. ${selectedLabel}.`),
        titleMaxWidth
      );
      pdf.text(
        subtitleLines,
        titleX,
        header.y + 92
      );

      pdf.setFillColor(...palette.darkSoft);
      pdf.roundedRect(metaX, header.y + 20, metaWidth, 98, 18, 18, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...palette.gold);
      pdf.text("DOCUMENT", metaX + 16, header.y + 38);
      pdf.setTextColor(236, 244, 255);
      pdf.setFontSize(9);
      pdf.text("Numero", metaX + 16, header.y + 58);
      pdf.text("Emission", metaX + 16, header.y + 80);
      pdf.text("Validite", metaX + 16, header.y + 102);
      pdf.setFont("helvetica", "normal");
      pdf.text(sanitizePdfText(summary.quoteNumber), metaX + 72, header.y + 58);
      pdf.text(sanitizePdfText(formatDate(summary.issueDate)), metaX + 72, header.y + 80);
      pdf.text(sanitizePdfText(formatDate(summary.validUntil)), metaX + 72, header.y + 102);

      const cardGap = 16;
      const cardWidth = (contentWidth - cardGap) / 2;
      const cardTextWidth = cardWidth - (cardPaddingX * 2);
      const clientLines = pdf.splitTextToSize(sanitizePdfText(buildClientPdfText(summary.client)), cardTextWidth);
      const frameLines = pdf.splitTextToSize(
        sanitizePdfText(
          `Projet ${projectType}. Budget de lancement ${formatPdfRange(summary.launchMin, summary.launchMax)}.${summary.recurringMin || summary.recurringMax ? ` Budget mensuel ${formatPdfRange(summary.recurringMin, summary.recurringMax, " / mois")}.` : " Aucun abonnement mensuel n'est inclus."}`
        ),
        cardTextWidth
      );
      const cardHeight = 64 + (Math.max(clientLines.length, frameLines.length) * cardLineHeight);
      const cardY = header.y + header.h + 18;

      drawPdfInfoCard(pdf, {
        x: margin,
        y: cardY,
        w: cardWidth,
        h: cardHeight,
        title: "Client",
        lines: clientLines,
        palette,
        accent: palette.cyan,
        paddingX: cardPaddingX,
      });

      drawPdfInfoCard(pdf, {
        x: margin + cardWidth + cardGap,
        y: cardY,
        w: cardWidth,
        h: cardHeight,
        title: "Cadrage",
        lines: frameLines,
        palette,
        accent: palette.orange,
        paddingX: cardPaddingX,
      });

      const tableLabelY = cardY + cardHeight + 28;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...palette.text);
      pdf.text("Prestations retenues", margin, tableLabelY);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.muted);
      pdf.text("Synthese actuelle du simulateur avec estimation indicative.", margin, tableLabelY + 16);

      if(typeof pdf.autoTable === "function"){
        pdf.autoTable({
          startY: tableLabelY + 28,
          margin: { left: margin, right: margin },
          tableWidth: contentWidth,
          head: [["Prestation", "Categorie", "Qt", "Mode", "Estimation"]],
          body: summary.lines.map(function(line){
            return [
              sanitizePdfText(line.title),
              sanitizePdfText(line.categoryTitle),
              String(line.quantity),
              line.billing === "monthly" ? "Mensuel" : "Ponctuel",
              formatPdfRange(line.lineMin, line.lineMax),
            ];
          }),
          theme: "plain",
          headStyles: {
            fillColor: palette.dark,
            textColor: [245, 248, 255],
            fontStyle: "bold",
            fontSize: 10,
            cellPadding: { top: 10, right: 10, bottom: 10, left: 10 },
          },
          bodyStyles: {
            font: "helvetica",
            fontSize: 10,
            textColor: palette.text,
            cellPadding: { top: 9, right: 10, bottom: 9, left: 10 },
            lineColor: palette.line,
            lineWidth: 0.8,
            valign: "middle",
          },
          alternateRowStyles: {
            fillColor: [248, 250, 254],
          },
          columnStyles: {
            0: { cellWidth: 175 },
            1: { cellWidth: 120 },
            2: { cellWidth: 42, halign: "center" },
            3: { cellWidth: 72, halign: "center" },
            4: { cellWidth: 102, halign: "right" },
          },
        });
      }

      let y = ensurePdfRoom(pdf, (pdf.lastAutoTable?.finalY || (tableLabelY + 28)) + 26, 180, {
        top: 56,
        pageWidth,
        pageHeight,
        background: palette.page,
      });

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(...palette.text);
      pdf.text("Budget indicatif", margin, y);
      y += 14;

      const metrics = [
        {
          label: "Lancement",
          value: formatPdfRange(summary.launchMin, summary.launchMax),
          accent: palette.cyan,
        },
        {
          label: "Mensuel",
          value: summary.recurringMin || summary.recurringMax ? formatPdfRange(summary.recurringMin, summary.recurringMax, " / mois") : "Aucun abonnement",
          accent: palette.orange,
        },
        {
          label: "Projection totale",
          value: formatPdfRange(summary.projectionMin, summary.projectionMax),
          accent: palette.gold,
          dark: true,
        },
      ];
      const metricGap = 12;
      const metricWidth = (contentWidth - (metricGap * 2)) / 3;
      const metricTextWidth = metricWidth - (metricPaddingX * 2);
      const metricLineSets = metrics.map(function(metric){
        return pdf.splitTextToSize(sanitizePdfText(metric.value), metricTextWidth);
      });
      const metricHeight = 60 + (Math.max.apply(null, metricLineSets.map(function(lines){
        return lines.length;
      })) * metricLineHeight);
      const metricY = y + 12;

      metrics.forEach(function(metric, index){
        drawPdfMetricCard(pdf, {
          x: margin + (index * (metricWidth + metricGap)),
          y: metricY,
          w: metricWidth,
          h: metricHeight,
          label: metric.label,
          valueLines: metricLineSets[index],
          palette,
          accent: metric.accent,
          dark: !!metric.dark,
          paddingX: metricPaddingX,
        });
      });

      y = ensurePdfRoom(pdf, metricY + metricHeight + 24, 120, {
        top: 56,
        pageWidth,
        pageHeight,
        background: palette.page,
      });

      const noteLines = pdf.splitTextToSize(
        sanitizePdfText(`${LEGAL_NOTE} Le devis final est personnalise apres echange et validation du perimetre.`),
        contentWidth - 42
      );
      const noteHeight = 58 + (noteLines.length * 14);
      pdf.setFillColor(...palette.surfaceSoft);
      pdf.setDrawColor(...palette.line);
      pdf.roundedRect(margin, y, contentWidth, noteHeight, 24, 24, "FD");
      pdf.setFillColor(...palette.cyan);
      pdf.roundedRect(margin + 18, y + 18, 6, noteHeight - 36, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...palette.text);
      pdf.text("Note importante", margin + 36, y + 30);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...palette.muted);
      pdf.text(noteLines, margin + 36, y + 50);

      const totalPages = pdf.getNumberOfPages();
      for(let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1){
        pdf.setPage(pageNumber);
        pdf.setDrawColor(...palette.line);
        pdf.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(...palette.muted);
        pdf.text(sanitizePdfText(`${COMPANY} | ${summary.quoteNumber} | ${CONTACT_EMAIL}`), margin, pageHeight - 20);
        pdf.text(`Page ${pageNumber} / ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: "right" });
      }

      const pdfFileName = slugify(`${summary.quoteNumber || "devis-digitalexis-studio"}-${summary.client.displayName !== "Prospect" ? summary.client.displayName : COMPANY}`) || "devis-digitalexis-studio";
      pdf.save(`${pdfFileName}.pdf`);
      showToast("Le PDF du devis a ete telecharge.");
    }catch(error){
      console.error("[devis-public] pdf generation failed", error);
      showToast("Impossible de generer le PDF pour le moment.");
    }
  }

  function updateClientDetails(fieldName, value, source){
    if(!CLIENT_FIELDS.includes(fieldName)) return;
    const nextValue = String(value || "");
    if(state.client[fieldName] === nextValue){
      syncClientFieldValue(fieldName, nextValue, source);
      return;
    }
    state.client[fieldName] = nextValue;
    syncClientFieldValue(fieldName, nextValue, source);
    persistState();
    renderSummary();
  }

  function syncClientFields(source){
    CLIENT_FIELDS.forEach(function(fieldName){
      syncClientFieldValue(fieldName, String(state.client[fieldName] || ""), source);
    });
  }

  function syncClientFieldValue(fieldName, value, source){
    const sidebarField = clientFieldMap.get(fieldName);
    const requestField = getRequestFormField(fieldName);

    if(source !== "sidebar" && sidebarField && sidebarField.value !== value){
      sidebarField.value = value;
    }

    if(source !== "form" && requestField && requestField.value !== value){
      requestField.value = value;
    }
  }

  function syncClientStateFromRequestForm(){
    let changed = false;
    CLIENT_FIELDS.forEach(function(fieldName){
      const field = getRequestFormField(fieldName);
      if(!field) return;
      const nextValue = String(field.value || "");
      if(state.client[fieldName] !== nextValue){
        state.client[fieldName] = nextValue;
        changed = true;
      }
      syncClientFieldValue(fieldName, nextValue, "form");
    });
    if(changed){
      persistState();
      renderSummary();
    }
  }

  function getRequestFormField(fieldName){
    const field = requestForm.elements.namedItem(fieldName);
    return field && typeof field.value === "string" ? field : null;
  }

  function buildEmptyClientState(){
    return {
      first_name: "",
      last_name: "",
      company: "",
      email: "",
      phone: "",
    };
  }

  function sanitizeClientState(raw){
    const base = buildEmptyClientState();
    if(!raw || typeof raw !== "object") return base;
    CLIENT_FIELDS.forEach(function(fieldName){
      base[fieldName] = String(raw[fieldName] || "");
    });
    return base;
  }

  function buildClientSummary(){
    const client = sanitizeClientState(state.client);
    const firstName = client.first_name.trim();
    const lastName = client.last_name.trim();
    const company = client.company.trim();
    const email = client.email.trim();
    const phone = client.phone.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const displayName = fullName || company || "Prospect";

    return {
      first_name: firstName,
      last_name: lastName,
      company,
      email,
      phone,
      fullName,
      displayName,
      hasAny: !!(firstName || lastName || company || email || phone),
    };
  }

  function buildClientDetailsHtml(client){
    const detailLines = [];
    if(client.company && client.company !== client.displayName){
      detailLines.push(client.company);
    }
    if(client.email){
      detailLines.push(client.email);
    }
    if(client.phone){
      detailLines.push(client.phone);
    }
    if(!detailLines.length){
      detailLines.push("Coordonnees a confirmer lors de l'echange.");
    }
    return detailLines.map(escapeHtml).join("<br/>");
  }

  function buildClientPdfText(client){
    const lines = [client.displayName];
    if(client.company && client.company !== client.displayName){
      lines.push(client.company);
    }
    if(client.email){
      lines.push(client.email);
    }
    if(client.phone){
      lines.push(client.phone);
    }
    if(lines.length === 1 && client.displayName === "Prospect"){
      lines.push("Coordonnees a confirmer lors de l'echange.");
    }
    return lines.join("\n");
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

  function formatPdfMoney(value){
    const amount = Math.round(Number(value || 0));
    const sign = amount < 0 ? "-" : "";
    const digits = Math.abs(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${sign}${digits} ${(DATA.currency || "EUR").toUpperCase()}`;
  }

  function formatPdfRange(min, max, suffix){
    const extra = suffix || "";
    if(Number(min) === Number(max)){
      return `${formatPdfMoney(min)}${extra}`;
    }
    return `${formatPdfMoney(min)} a ${formatPdfMoney(max)}${extra}`;
  }

  function sanitizePdfText(value){
    return String(value || "")
      .replace(/\u202f/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[–—]/g, "-")
      .replace(/[•·]/g, "-");
  }

  function getPdfLineHeight(fontSize, factor){
    return Number(fontSize || 10) * Number(factor || 1.2);
  }

  function fitPdfFontSize(pdf, text, maxWidth, startSize, minSize){
    let size = Number(startSize || 12);
    const floor = Number(minSize || 8);
    pdf.setFontSize(size);
    while(size > floor && pdf.getTextWidth(sanitizePdfText(text)) > maxWidth){
      size -= 1;
      pdf.setFontSize(size);
    }
    return size;
  }

  function paintPdfPageBackground(pdf, pageWidth, pageHeight, fillColor){
    pdf.setFillColor(...fillColor);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
  }

  function ensurePdfRoom(pdf, y, needed, options){
    const pageHeight = pdf.internal.pageSize.getHeight();
    if((y + needed) <= (pageHeight - 52)){
      return y;
    }
    pdf.addPage();
    paintPdfPageBackground(pdf, options.pageWidth, options.pageHeight, options.background);
    return Number(options.top || 48);
  }

  function drawPdfInfoCard(pdf, options){
    const accent = options.accent || [42, 182, 255];
    const paddingX = Number(options.paddingX || 16);
    pdf.setFillColor(...options.palette.surface);
    pdf.setDrawColor(...options.palette.line);
    pdf.roundedRect(options.x, options.y, options.w, options.h, 22, 22, "FD");
    pdf.setFillColor(...accent);
    pdf.roundedRect(options.x + paddingX, options.y + 16, 42, 5, 2.5, 2.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...options.palette.text);
    pdf.text(sanitizePdfText(options.title), options.x + paddingX, options.y + 38);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...options.palette.muted);
    pdf.text(options.lines, options.x + paddingX, options.y + 60);
  }

  function drawPdfMetricCard(pdf, options){
    const paddingX = Number(options.paddingX || 16);
    if(options.dark){
      pdf.setFillColor(...options.palette.dark);
      pdf.setDrawColor(...options.palette.dark);
      pdf.roundedRect(options.x, options.y, options.w, options.h, 22, 22, "FD");
      pdf.setTextColor(238, 244, 255);
    }else{
      pdf.setFillColor(...options.palette.surface);
      pdf.setDrawColor(...options.palette.line);
      pdf.roundedRect(options.x, options.y, options.w, options.h, 22, 22, "FD");
      pdf.setTextColor(...options.palette.text);
    }
    pdf.setFillColor(...options.accent);
    pdf.roundedRect(options.x + paddingX, options.y + 16, 44, 5, 2.5, 2.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(sanitizePdfText(options.label), options.x + paddingX, options.y + 38);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(options.valueLines, options.x + paddingX, options.y + 66);
  }

  async function resolvePublicPdfLogo(){
    const raw = String(PDF_LOGO_URL || "").trim();
    if(!raw) return "";
    if(raw.startsWith("data:")) return raw;
    try{
      const response = await fetch(new URL(raw, window.location.href).href);
      if(!response.ok){
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      return await readBlobAsDataUrl(blob);
    }catch(error){
      console.warn("[devis-public] logo skipped", error);
      return "";
    }
  }

  function readBlobAsDataUrl(blob){
    return new Promise(function(resolve, reject){
      const reader = new FileReader();
      reader.onload = function(){
        resolve(String(reader.result || ""));
      };
      reader.onerror = function(){
        reject(new Error("Lecture du logo impossible."));
      };
      reader.readAsDataURL(blob);
    });
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

