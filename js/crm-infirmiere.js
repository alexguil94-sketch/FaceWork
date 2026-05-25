(function () {
  "use strict";

  const documentRoot = document.documentElement;
  const today = new Date();
  const todayISO = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
  const themeKey = "sereincare-theme";

  const services = [
    {
      id: "pansement",
      name: "Pansement post-opératoire",
      category: "technique",
      tag: "Pansement",
      tagClass: "pansement",
      duration: "25 min",
      code: "AMI 3",
      amount: 9.45,
      detail: "Réfection du pansement, observation de la cicatrisation et transmission ciblée.",
    },
    {
      id: "injection",
      name: "Injection prescrite",
      category: "technique",
      tag: "Injection",
      tagClass: "injection",
      duration: "15 min",
      code: "AMI 1",
      amount: 3.15,
      detail: "Administration du traitement prescrit et traçabilité de l'acte effectué.",
    },
    {
      id: "prelevement",
      name: "Prélèvement sanguin",
      category: "technique",
      tag: "Prélèvement",
      tagClass: "bilan",
      duration: "20 min",
      code: "AMI 2",
      amount: 6.30,
      detail: "Prélèvement à domicile, identification et suivi de remise au laboratoire.",
    },
    {
      id: "diabete",
      name: "Suivi diabétique",
      category: "surveillance",
      tag: "Suivi",
      tagClass: "suivi",
      duration: "20 min",
      code: "AIS 3",
      amount: 7.95,
      detail: "Contrôle glycémique, injection prescrite si nécessaire et surveillance.",
    },
    {
      id: "post-hospitalisation",
      name: "Surveillance post-hospitalisation",
      category: "surveillance",
      tag: "Surveillance",
      tagClass: "suivi",
      duration: "30 min",
      code: "AIS 4",
      amount: 10.60,
      detail: "Constantes, douleur, tolérance du traitement et alerte si besoin.",
    },
    {
      id: "coordination",
      name: "Coordination maintien à domicile",
      category: "coordination",
      tag: "Coordination",
      tagClass: "pansement",
      duration: "30 min",
      code: "AIS 4",
      amount: 10.60,
      detail: "Lien avec le médecin, les aidants et les intervenants du parcours.",
    },
  ];

  let visits = [
    { patient: "N. F.", serviceId: "prelevement", time: "07:15", sector: "Villeurbanne", status: "confirmée" },
    { patient: "C. B.", serviceId: "injection", time: "08:00", sector: "Lyon 3e", status: "confirmée" },
    { patient: "P. L.", serviceId: "pansement", time: "08:45", sector: "Lyon 3e", status: "confirmée" },
    { patient: "M. R.", serviceId: "diabete", time: "09:35", sector: "Villeurbanne", status: "à faire" },
    { patient: "A. D.", serviceId: "post-hospitalisation", time: "10:15", sector: "Villeurbanne", status: "confirmée" },
    { patient: "S. G.", serviceId: "pansement", time: "11:10", sector: "Lyon 3e", status: "confirmée" },
    { patient: "E. C.", serviceId: "coordination", time: "12:00", sector: "Bron", status: "à faire" },
    { patient: "H. T.", serviceId: "injection", time: "13:00", sector: "Lyon 3e", status: "confirmée" },
  ].map(function (visit) {
    return { ...visit, date: todayISO };
  });

  let patients = [
    { initials: "P. L.", sector: "Lyon 3e", care: ["Pansement"], next: "Aujourd'hui · 08:45" },
    { initials: "M. R.", sector: "Villeurbanne", care: ["Suivi diabétique", "Ordonnance"], next: "Aujourd'hui · 09:35" },
    { initials: "A. D.", sector: "Villeurbanne", care: ["Surveillance"], next: "Aujourd'hui · 10:15" },
    { initials: "C. B.", sector: "Lyon 3e", care: ["Injection"], next: "Aujourd'hui · 08:00" },
    { initials: "E. C.", sector: "Bron", care: ["Coordination"], next: "Aujourd'hui · 12:00" },
  ];

  const visitList = document.getElementById("visitList");
  const fullVisitList = document.getElementById("fullVisitList");
  const patientList = document.getElementById("patientList");
  const serviceGrid = document.getElementById("serviceGrid");
  const appointmentDialog = document.getElementById("appointmentDialog");
  const appointmentForm = document.getElementById("appointmentForm");
  const appointmentService = document.getElementById("appointmentService");
  const patientSearch = document.getElementById("patientSearch");
  const toastElement = document.querySelector("[data-toast]");
  let statusFilter = "all";
  let serviceFilter = "all";
  let toastTimer;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function serviceById(id) {
    return services.find(function (service) {
      return service.id === id;
    }) || services[0];
  }

  function statusClass(status) {
    if (status === "confirmée") return "confirmed";
    if (status === "réalisée") return "done";
    return "todo";
  }

  function formatToday() {
    const value = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(today);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function dayVisits() {
    return visits
      .filter(function (visit) {
        return visit.date === todayISO;
      })
      .sort(function (left, right) {
        return left.time.localeCompare(right.time);
      });
  }

  function updateProgressBar() {
    const fill = document.querySelector("[data-progress-fill]");
    const label = document.querySelector("[data-progress-label]");
    if (!fill || !label) return;
    const todaysVisits = dayVisits();
    const done = todaysVisits.filter(function (v) { return v.status === "réalisée"; }).length;
    const total = todaysVisits.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    fill.style.width = pct + "%";
    label.textContent = done + " / " + total + (done !== 1 ? " réalisées" : " réalisée");
  }

  function setupStatusCycle() {
    const cycle = ["à faire", "confirmée", "réalisée"];
    const toastTitles = { "confirmée": "Visite confirmée", "réalisée": "Soin effectué", "à faire": "Remis en attente" };
    function bindContainer(container) {
      container.addEventListener("click", function (event) {
        const badge = event.target.closest(".status");
        if (!badge) return;
        const article = badge.closest("[data-visit-patient]");
        if (!article) return;
        const patient = article.dataset.visitPatient;
        const time = article.dataset.visitTime;
        const visit = visits.find(function (v) {
          return v.patient === patient && v.time === time && v.date === todayISO;
        });
        if (!visit) return;
        const idx = cycle.indexOf(visit.status);
        visit.status = cycle[(idx + 1) % cycle.length];
        const service = serviceById(visit.serviceId);
        renderAppointments();
        showToast(visit.patient + " · " + service.name, toastTitles[visit.status] || "Statut mis à jour");
      });
    }
    bindContainer(visitList);
    bindContainer(fullVisitList);
  }

  function showToast(message, title) {
    if (!toastElement) return;
    toastElement.querySelector("strong").textContent = title || "Information";
    toastElement.querySelector("span").textContent = message;
    toastElement.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastElement.classList.remove("visible");
    }, 3400);
  }

  function updateStats() {
    const todaysVisits = dayVisits();
    const confirmed = todaysVisits.filter(function (visit) {
      return visit.status === "confirmée";
    }).length;
    const rate = todaysVisits.length ? Math.round((confirmed / todaysVisits.length) * 100) : 0;

    document.querySelectorAll("[data-visit-count]").forEach(function (element) {
      element.textContent = String(todaysVisits.length);
    });
    document.querySelectorAll("[data-visit-total]").forEach(function (element) {
      element.textContent = todaysVisits.length + " visites";
    });
    document.querySelectorAll("[data-confirmed-rate]").forEach(function (element) {
      element.textContent = rate + "%";
    });
  }

  function appointmentMarkup(visit) {
    const service = serviceById(visit.serviceId);
    return [
      '<article class="appointment" data-visit-patient="' + escapeHtml(visit.patient) + '" data-visit-time="' + escapeHtml(visit.time) + '">',
      '<time class="appointment-time">' + escapeHtml(visit.time) + "</time>",
      '<div class="appointment-person"><strong>' + escapeHtml(visit.patient) + "</strong><small>" + escapeHtml(visit.sector) + "</small></div>",
      '<div class="appointment-care"><strong>' + escapeHtml(service.name) + "</strong><small>" + escapeHtml(service.duration) + " · Prescription vérifiée</small></div>",
      '<span class="status ' + statusClass(visit.status) + '">' + escapeHtml(visit.status) + "</span>",
      "</article>",
    ].join("");
  }

  function renderAppointments() {
    const filteredVisits = dayVisits().filter(function (visit) {
      return statusFilter === "all" || visit.status === statusFilter;
    });
    visitList.innerHTML = filteredVisits.length
      ? filteredVisits.map(appointmentMarkup).join("")
      : '<p class="empty-state">Aucune visite ne correspond à ce filtre.</p>';

    fullVisitList.innerHTML = dayVisits().map(function (visit, index) {
      const service = serviceById(visit.serviceId);
      return [
        '<article class="route-visit" data-visit-patient="' + escapeHtml(visit.patient) + '" data-visit-time="' + escapeHtml(visit.time) + '">',
        '<span class="route-index">' + (index + 1) + "</span>",
        '<div><strong>' + escapeHtml(visit.patient) + " · " + escapeHtml(service.name) + "</strong><small>" + escapeHtml(visit.sector) + " · " + escapeHtml(service.duration) + "</small></div>",
        '<time>' + escapeHtml(visit.time) + "</time>",
        '<span class="status ' + statusClass(visit.status) + '">' + escapeHtml(visit.status) + "</span>",
        "</article>",
      ].join("");
    }).join("");

    updateStats();
    updateProgressBar();
    updateInvoiceBadge();
  }

  function renderPatients(query) {
    const searchValue = String(query || "").trim().toLocaleLowerCase("fr");
    const displayedPatients = patients.filter(function (patient) {
      const searchable = [patient.initials, patient.sector].concat(patient.care).join(" ").toLocaleLowerCase("fr");
      return !searchValue || searchable.includes(searchValue);
    });

    patientList.innerHTML = displayedPatients.length
      ? displayedPatients.map(function (patient) {
        return [
          '<article class="patient-row">',
          '<div class="patient-identity"><span class="patient-initials">' + escapeHtml(patient.initials.replaceAll(".", "")) + '</span><div><strong>' + escapeHtml(patient.initials) + '</strong><small>' + escapeHtml(patient.sector) + "</small></div></div>",
          '<div class="patient-care">' + patient.care.map(function (care) { return "<span>" + escapeHtml(care) + "</span>"; }).join("") + "</div>",
          '<div class="patient-next"><small>Prochain soin</small><strong>' + escapeHtml(patient.next) + "</strong></div>",
          '<button class="secondary-button" type="button" data-notify="Dossier de ' + escapeHtml(patient.initials) + ' ouvert en mode démonstration.">Ouvrir</button>',
          "</article>",
        ].join("");
      }).join("")
      : '<p class="empty-state">Aucun patient trouvé pour cette recherche.</p>';
    bindNotifyButtons(patientList);
  }

  function renderServices() {
    const displayedServices = services.filter(function (service) {
      return serviceFilter === "all" || service.category === serviceFilter;
    });
    serviceGrid.innerHTML = displayedServices.map(function (service) {
      return [
        '<article class="service-card">',
        '<div class="service-card-head"><span class="care-tag ' + escapeHtml(service.tagClass) + '">' + escapeHtml(service.tag) + '</span><span class="service-duration">' + escapeHtml(service.duration) + "</span></div>",
        "<h2>" + escapeHtml(service.name) + "</h2>",
        "<p>" + escapeHtml(service.detail) + "</p>",
        '<button class="text-button" type="button" data-select-service="' + escapeHtml(service.id) + '">Planifier ce soin</button>',
        "</article>",
      ].join("");
    }).join("");

    serviceGrid.querySelectorAll("[data-select-service]").forEach(function (button) {
      button.addEventListener("click", function () {
        openAppointmentDialog(button.dataset.selectService);
      });
    });
  }

  function showSection(sectionName) {
    document.querySelectorAll("[data-section]").forEach(function (section) {
      const active = section.dataset.section === sectionName;
      section.hidden = !active;
      section.classList.toggle("active", active);
    });
    document.querySelectorAll("[data-view]").forEach(function (button) {
      const active = button.dataset.view === sectionName;
      button.classList.toggle("active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    if (sectionName === "facturation") renderFacturation();
  }

  function populateServiceSelect() {
    appointmentService.innerHTML = services.map(function (service) {
      return '<option value="' + escapeHtml(service.id) + '">' + escapeHtml(service.name) + "</option>";
    }).join("");
  }

  function openAppointmentDialog(serviceId) {
    appointmentForm.elements.date.value = todayISO;
    if (serviceId && serviceById(serviceId)) {
      appointmentService.value = serviceId;
    }
    if (typeof appointmentDialog.showModal === "function") {
      appointmentDialog.showModal();
    } else {
      appointmentDialog.setAttribute("open", "");
    }
  }

  function closeAppointmentDialog() {
    if (typeof appointmentDialog.close === "function") {
      appointmentDialog.close();
    } else {
      appointmentDialog.removeAttribute("open");
    }
  }

  function addPatientIfNeeded(initials, serviceName, sector, time) {
    const existing = patients.some(function (patient) {
      return patient.initials.toLocaleLowerCase("fr") === initials.toLocaleLowerCase("fr");
    });
    if (!existing) {
      patients.unshift({
        initials: initials,
        sector: sector,
        care: [serviceName],
        next: "Aujourd'hui · " + time,
      });
    }
  }

  function bindNotifyButtons(scope) {
    scope.querySelectorAll("[data-notify]").forEach(function (button) {
      if (button.dataset.boundNotify === "true") return;
      button.dataset.boundNotify = "true";
      button.addEventListener("click", function () {
        showToast(button.dataset.notify, "SereinCare");
      });
    });
  }

  function setupTheme() {
    let savedTheme = "";
    try {
      savedTheme = window.localStorage.getItem(themeKey) || "";
    } catch (error) {
      savedTheme = "";
    }
    if (savedTheme === "dark" || savedTheme === "light") {
      documentRoot.dataset.theme = savedTheme;
    }

    const themeButton = document.querySelector("[data-theme-toggle]");
    function updateThemeLabel() {
      const isDark = documentRoot.dataset.theme === "dark";
      themeButton.setAttribute("aria-label", isDark ? "Activer le thème clair" : "Activer le thème sombre");
    }
    updateThemeLabel();
    themeButton.addEventListener("click", function () {
      documentRoot.dataset.theme = documentRoot.dataset.theme === "dark" ? "light" : "dark";
      updateThemeLabel();
      try {
        window.localStorage.setItem(themeKey, documentRoot.dataset.theme);
      } catch (error) {
        // Le thème reste actif pour la session si le stockage est indisponible.
      }
    });
  }

  document.querySelectorAll("[data-today]").forEach(function (element) {
    element.textContent = formatToday();
  });

  document.querySelectorAll("[data-view]").forEach(function (button) {
    button.addEventListener("click", function () {
      showSection(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-view-link]").forEach(function (button) {
    button.addEventListener("click", function () {
      showSection(button.dataset.viewLink);
    });
  });

  document.querySelectorAll("[data-status-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      statusFilter = button.dataset.statusFilter;
      document.querySelectorAll("[data-status-filter]").forEach(function (filterButton) {
        filterButton.classList.toggle("active", filterButton === button);
      });
      renderAppointments();
    });
  });

  document.querySelectorAll("[data-service-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      serviceFilter = button.dataset.serviceFilter;
      document.querySelectorAll("[data-service-filter]").forEach(function (filterButton) {
        filterButton.classList.toggle("active", filterButton === button);
      });
      renderServices();
    });
  });

  document.querySelectorAll("[data-open-appointment]").forEach(function (button) {
    button.addEventListener("click", function () {
      openAppointmentDialog();
    });
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
    button.addEventListener("click", closeAppointmentDialog);
  });

  appointmentForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const values = new FormData(appointmentForm);
    const date = String(values.get("date"));
    const patient = String(values.get("patient")).trim().toUpperCase();
    const serviceId = String(values.get("service"));
    const time = String(values.get("time"));
    const sector = String(values.get("sector"));
    const service = serviceById(serviceId);

    visits.push({
      patient: patient,
      serviceId: serviceId,
      date: date,
      time: time,
      sector: sector,
      status: "à faire",
    });
    if (date === todayISO) {
      addPatientIfNeeded(patient, service.name, sector, time);
    }

    renderAppointments();
    renderPatients(patientSearch.value);
    closeAppointmentDialog();
    appointmentForm.reset();
    appointmentForm.elements.date.value = todayISO;

    if (date === todayISO) {
      showSection("tournee");
      showToast(service.name + " ajouté à " + time + " pour " + patient + ".", "Visite planifiée");
    } else {
      showToast("Visite enregistrée pour le " + new Intl.DateTimeFormat("fr-FR").format(new Date(date + "T12:00:00")) + ".", "Planning à venir");
    }
  });

  patientSearch.addEventListener("input", function () {
    renderPatients(patientSearch.value);
  });

  document.querySelector("[data-global-search]").addEventListener("input", function (event) {
    const query = event.target.value;
    if (query.trim()) {
      showSection("patients");
    }
    patientSearch.value = query;
    renderPatients(query);
  });

  document.querySelector("[data-export-route]").addEventListener("click", function () {
    showToast("La feuille de tournée PDF est prête (simulation).", "Export réussi");
  });

  const IFD_AMOUNT = 2.50;
  const IFD_LABEL = "Ind. forfait. déplacement";
  let invoices = [];
  let invoiceCounter = 0;
  let currentInvoice = null;
  const invoiceDialog = document.getElementById("invoiceDialog");

  function updateInvoiceBadge() {
    const badge = document.querySelector("[data-invoice-badge]");
    if (!badge) return;
    const count = visits.filter(function (v) { return v.status === "réalisée" && !v.invoiced; }).length;
    badge.textContent = count;
    badge.style.display = count > 0 ? "" : "none";
  }

  function renderFacturationStats() {
    const el = document.getElementById("facturationStats");
    if (!el) return;
    const toInvoice = visits.filter(function (v) { return v.status === "réalisée" && !v.invoiced; }).length;
    const monthTotal = invoices.reduce(function (sum, inv) { return sum + inv.total; }, 0);
    const pending = invoices.filter(function (inv) { return inv.status === "émise"; }).length;
    el.innerHTML =
      '<article class="stat-card"><span class="stat-icon scripts" aria-hidden="true"></span><div><small>À facturer</small><strong>' + toInvoice + '</strong><p>Actes réalisés</p></div></article>' +
      '<article class="stat-card"><span class="stat-icon visits" aria-hidden="true"></span><div><small>Facturé ce mois</small><strong>' + monthTotal.toFixed(2).replace(".", ",") + " €" + '</strong><p>Honoraires</p></div></article>' +
      '<article class="stat-card"><span class="stat-icon transmissions" aria-hidden="true"></span><div><small>En attente règlement</small><strong>' + pending + '</strong><p>Factures émises</p></div></article>';
  }

  function renderBillList() {
    const el = document.getElementById("billList");
    if (!el) return;
    const toInvoice = visits.filter(function (v) { return v.status === "réalisée" && !v.invoiced; });
    if (!toInvoice.length) {
      el.innerHTML = '<p class="empty-state">Aucun acte en attente de facturation.</p>';
      return;
    }
    const heading = '<div class="bill-row heading"><span>Heure</span><span>Patient</span><span>Acte réalisé</span><span>Montant</span><span></span></div>';
    el.innerHTML = heading + toInvoice.map(function (visit) {
      const svc = serviceById(visit.serviceId);
      const total = (svc.amount + IFD_AMOUNT).toFixed(2).replace(".", ",");
      return '<div class="bill-row">' +
        '<time>' + escapeHtml(visit.time) + '</time>' +
        '<div><strong>' + escapeHtml(visit.patient) + '</strong><small>' + escapeHtml(visit.sector) + '</small></div>' +
        '<div><strong>' + escapeHtml(svc.name) + '</strong><small>' + escapeHtml(svc.code) + ' · ' + escapeHtml(svc.duration) + '</small></div>' +
        '<span class="bill-amount">' + total + ' €</span>' +
        '<button class="primary-button" type="button" style="min-height:38px;padding:0 14px;font-size:12px" data-create-invoice="' + escapeHtml(visit.patient) + '" data-invoice-time="' + escapeHtml(visit.time) + '">Créer la facture</button>' +
        '</div>';
    }).join("");
    el.querySelectorAll("[data-create-invoice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const visit = visits.find(function (v) {
          return v.patient === btn.dataset.createInvoice && v.time === btn.dataset.invoiceTime && v.date === todayISO;
        });
        if (visit) openInvoicePreview(visit);
      });
    });
  }

  function renderInvoiceList() {
    const el = document.getElementById("invoiceList");
    if (!el) return;
    if (!invoices.length) {
      el.innerHTML = '<p class="empty-state">Aucune facture émise ce mois.</p>';
      return;
    }
    const heading = '<div class="invoice-row heading"><span>N° Facture</span><span>Patient</span><span>Date</span><span>Montant</span><span>Statut</span><span></span></div>';
    el.innerHTML = heading + invoices.map(function (inv) {
      const date = new Intl.DateTimeFormat("fr-FR").format(new Date(inv.date + "T12:00:00"));
      const statusCls = inv.status === "payée" ? "confirmed" : "waiting";
      return '<div class="invoice-row">' +
        '<strong>' + escapeHtml(inv.id) + '</strong>' +
        '<span>' + escapeHtml(inv.patient) + '</span>' +
        '<span>' + date + '</span>' +
        '<span class="bill-amount">' + inv.total.toFixed(2).replace(".", ",") + ' €</span>' +
        '<span class="status ' + statusCls + '">' + escapeHtml(inv.status) + '</span>' +
        '<button class="text-button" type="button" data-reprint="' + escapeHtml(inv.id) + '">Imprimer</button>' +
        '</div>';
    }).join("");
    el.querySelectorAll("[data-reprint]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const inv = invoices.find(function (i) { return i.id === btn.dataset.reprint; });
        if (inv) printInvoice(inv);
      });
    });
  }

  function renderFacturation() {
    renderFacturationStats();
    renderBillList();
    renderInvoiceList();
    updateInvoiceBadge();
  }

  function buildInvoicePreviewHTML(inv) {
    const svc = serviceById(inv.serviceId);
    const date = new Intl.DateTimeFormat("fr-FR").format(new Date(inv.date + "T12:00:00"));
    return '<div class="invoice-header">' +
      '<div class="invoice-practice"><strong>Léa Martin — Infirmière DE</strong>' +
      '<p>17, rue de la République · 69003 Lyon<br>RPPS : 12345678901 · SIRET : 898 765 432 00012</p></div>' +
      '<div class="invoice-meta"><strong>' + escapeHtml(inv.id) + '</strong><p>Émise le ' + date + '</p></div>' +
      '</div>' +
      '<div class="invoice-patient">' +
      '<div><span>Patient</span><strong>' + escapeHtml(inv.patient) + '</strong></div>' +
      '<div><span>Secteur</span><strong>' + escapeHtml(inv.sector) + '</strong></div>' +
      '<div><span>Date de soin</span><strong>' + date + ' · ' + escapeHtml(inv.visitTime) + '</strong></div>' +
      '</div>' +
      '<table class="invoice-table"><thead><tr><th>Acte effectué</th><th>Code</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
      '<tr><td>' + escapeHtml(svc.name) + '</td><td>' + escapeHtml(svc.code) + '</td><td style="text-align:right">' + svc.amount.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '<tr><td>' + escapeHtml(IFD_LABEL) + '</td><td>IFD</td><td style="text-align:right">' + IFD_AMOUNT.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '<tr class="invoice-total-row"><td colspan="2"><strong>Total honoraires</strong></td><td style="text-align:right"><strong>' + inv.total.toFixed(2).replace(".", ",") + ' €</strong></td></tr>' +
      '</tbody></table>' +
      '<div class="invoice-footer">Prise en charge Assurance Maladie : 60 % · Mutuelle : selon contrat<br>' +
      'Règlement par virement ou chèque à l\'ordre de Léa Martin · Merci de rappeler le N° de facture.</div>';
  }

  function printInvoice(inv) {
    const svc = serviceById(inv.serviceId);
    const date = new Intl.DateTimeFormat("fr-FR").format(new Date(inv.date + "T12:00:00"));
    const win = window.open("", "_blank");
    if (!win) { showToast("Autorisez les pop-ups pour imprimer.", "Impression bloquée"); return; }
    win.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ' + escapeHtml(inv.id) + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#17322f;padding:32px 40px;max-width:700px;margin:0 auto}' +
      'h1{font-size:22px;color:#096a61;margin-bottom:4px}' +
      '.hdr{display:flex;justify-content:space-between;align-items:start;padding-bottom:16px;margin-bottom:24px;border-bottom:2.5px solid #096a61}' +
      '.inv-num{font-size:20px;font-weight:700;color:#096a61}.muted{color:#647b78;font-size:11px;line-height:1.65}' +
      '.pbox{display:flex;gap:28px;padding:12px 16px;border:1px solid #dde8e2;border-radius:8px;margin-bottom:22px}' +
      '.pbox span{color:#647b78;font-size:10px;display:block;margin-bottom:2px}.pbox strong{font-size:13px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:18px}' +
      'th{text-align:left;padding:8px 10px;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#647b78;border-bottom:1px solid #dde8e2}' +
      'td{padding:10px;border-bottom:1px solid #eff5f1}' +
      '.tot td{font-weight:700;font-size:14px;color:#096a61;border-top:2px solid #dde8e2;border-bottom:0;padding-top:14px}' +
      '.ftr{color:#647b78;font-size:11px;line-height:1.7;padding-top:14px;border-top:1px solid #dde8e2}' +
      '@media print{body{padding:18px 28px}}</style></head><body>' +
      '<div class="hdr">' +
      '<div><h1>Léa Martin</h1><p class="muted">Infirmière Diplômée d\'État · Libérale<br>17, rue de la République · 69003 Lyon<br>RPPS : 12345678901 · SIRET : 898 765 432 00012</p></div>' +
      '<div style="text-align:right"><p class="inv-num">FACTURE ' + escapeHtml(inv.id) + '</p><p class="muted">Émise le ' + date + '</p></div>' +
      '</div>' +
      '<div class="pbox">' +
      '<div><span>Patient</span><strong>' + escapeHtml(inv.patient) + '</strong></div>' +
      '<div><span>Secteur</span><strong>' + escapeHtml(inv.sector) + '</strong></div>' +
      '<div><span>Date de soin</span><strong>' + date + ' à ' + escapeHtml(inv.visitTime) + '</strong></div>' +
      '</div>' +
      '<table><thead><tr><th>Acte effectué</th><th>Code NGAP</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
      '<tr><td>' + escapeHtml(svc.name) + '</td><td>' + escapeHtml(svc.code) + '</td><td style="text-align:right">' + svc.amount.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '<tr><td>' + escapeHtml(IFD_LABEL) + '</td><td>IFD</td><td style="text-align:right">' + IFD_AMOUNT.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '<tr class="tot"><td colspan="2">Total honoraires</td><td style="text-align:right">' + inv.total.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '</tbody></table>' +
      '<div class="ftr">Prise en charge Assurance Maladie : 60 % · Mutuelle : selon contrat<br>' +
      'Règlement par virement ou chèque à l\'ordre de Léa Martin<br>' +
      'Merci de rappeler le N° de facture ' + escapeHtml(inv.id) + ' lors du règlement.</div>' +
      '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 500);
  }

  function openInvoicePreview(visit) {
    invoiceCounter += 1;
    const id = "SC-" + new Date().getFullYear() + "-" + String(invoiceCounter).padStart(3, "0");
    const svc = serviceById(visit.serviceId);
    const inv = {
      id: id,
      date: visit.date,
      patient: visit.patient,
      sector: visit.sector,
      serviceId: visit.serviceId,
      visitTime: visit.time,
      total: svc.amount + IFD_AMOUNT,
      status: "émise",
    };
    visit.invoiced = true;
    invoices.push(inv);
    currentInvoice = inv;
    renderFacturation();
    const previewEl = document.getElementById("invoicePreview");
    if (previewEl) previewEl.innerHTML = buildInvoicePreviewHTML(inv);
    if (typeof invoiceDialog?.showModal === "function") invoiceDialog.showModal();
    else invoiceDialog?.setAttribute("open", "");
    showToast("Facture " + id + " créée pour " + visit.patient + ".", "Facture générée");
  }

  populateServiceSelect();
  renderAppointments();
  renderPatients("");
  renderServices();
  bindNotifyButtons(document);
  setupTheme();
  setupStatusCycle();
  updateInvoiceBadge();

  if (invoiceDialog) {
    document.querySelectorAll("[data-close-invoice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (typeof invoiceDialog.close === "function") invoiceDialog.close();
        else invoiceDialog.removeAttribute("open");
      });
    });
    const printBtn = document.querySelector("[data-print-invoice]");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        if (currentInvoice) printInvoice(currentInvoice);
      });
    }
  }
}());
