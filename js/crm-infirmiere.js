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

  let patientIdCounter = 5;
  let patients = [
    { id: 1, initials: "P. L.", sector: "Lyon 3e", care: ["Pansement"], next: "Aujourd'hui · 08:45", dob: "1958", doctor: "Dr. Renaud", ss: "1 58 03 ...", mutuelle: "MGEN" },
    { id: 2, initials: "M. R.", sector: "Villeurbanne", care: ["Suivi diabétique", "Ordonnance"], next: "Aujourd'hui · 09:35", dob: "1944", doctor: "Dr. Perrin", ss: "1 44 11 ...", mutuelle: "Allianz" },
    { id: 3, initials: "A. D.", sector: "Villeurbanne", care: ["Surveillance"], next: "Aujourd'hui · 10:15", dob: "1971", doctor: "Dr. Renaud", ss: "1 71 07 ...", mutuelle: "Harmonie" },
    { id: 4, initials: "C. B.", sector: "Lyon 3e", care: ["Injection"], next: "Aujourd'hui · 08:00", dob: "1965", doctor: "Dr. Blanc", ss: "2 65 04 ...", mutuelle: "MGEN" },
    { id: 5, initials: "E. C.", sector: "Bron", care: ["Coordination"], next: "Aujourd'hui · 12:00", dob: "1983", doctor: "Dr. Leblanc", ss: "2 83 09 ...", mutuelle: "AXA" },
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
        const doctorMutuelle = [patient.doctor, patient.mutuelle].filter(Boolean).join(" · ");
        return [
          '<article class="patient-row">',
          '<div class="patient-identity"><span class="patient-initials">' + escapeHtml(patient.initials.replaceAll(".", "")) + '</span><div><strong>' + escapeHtml(patient.initials) + '</strong><small>' + escapeHtml(patient.sector) + (patient.dob ? " · né(e) " + escapeHtml(patient.dob) : "") + "</small></div></div>",
          '<div class="patient-care">' + patient.care.map(function (care) { return "<span>" + escapeHtml(care) + "</span>"; }).join("") + "</div>",
          '<div class="patient-next"><small>Prochain soin</small><strong>' + escapeHtml(patient.next) + "</strong>" + (doctorMutuelle ? '<small style="margin-top:4px;display:block">' + escapeHtml(doctorMutuelle) + '</small>' : '') + "</div>",
          '<div style="display:flex;gap:8px;flex-wrap:wrap">',
          '<button class="primary-button" type="button" style="min-height:37px;padding:0 13px;font-size:12px" data-patient-invoice="' + escapeHtml(patient.initials) + '">Facturer</button>',
          '<button class="secondary-button" type="button" style="min-height:37px;padding:0 13px;font-size:12px" data-notify="Dossier de ' + escapeHtml(patient.initials) + ' ouvert en mode démonstration.">Ouvrir</button>',
          '</div>',
          "</article>",
        ].join("");
      }).join("")
      : '<p class="empty-state">Aucun patient trouvé pour cette recherche.</p>';
    bindNotifyButtons(patientList);
    patientList.querySelectorAll("[data-patient-invoice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openNewInvoiceDialog(btn.dataset.patientInvoice);
      });
    });
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
      const paidBtn = inv.status === "émise"
        ? '<button class="text-button" type="button" data-mark-paid="' + escapeHtml(inv.id) + '" style="margin-right:4px">Payée ✓</button>'
        : '';
      return '<div class="invoice-row">' +
        '<strong>' + escapeHtml(inv.id) + '</strong>' +
        '<span>' + escapeHtml(inv.patient) + '</span>' +
        '<span>' + date + '</span>' +
        '<span class="bill-amount">' + inv.total.toFixed(2).replace(".", ",") + ' €</span>' +
        '<span class="status ' + statusCls + '">' + escapeHtml(inv.status) + '</span>' +
        '<span style="display:flex;gap:4px;align-items:center">' + paidBtn +
        '<button class="text-button" type="button" data-reprint="' + escapeHtml(inv.id) + '">Imprimer</button>' +
        '</span>' +
        '</div>';
    }).join("");
    el.querySelectorAll("[data-reprint]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const inv = invoices.find(function (i) { return i.id === btn.dataset.reprint; });
        if (inv) printInvoice(inv);
      });
    });
    el.querySelectorAll("[data-mark-paid]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const inv = invoices.find(function (i) { return i.id === btn.dataset.markPaid; });
        if (!inv) return;
        inv.status = "payée";
        renderFacturation();
        showToast("Facture " + inv.id + " marquée comme payée.", "Règlement enregistré");
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
    const date = new Intl.DateTimeFormat("fr-FR").format(new Date(inv.date + "T12:00:00"));
    const actsRows = (inv.acts || []).map(function (act) {
      return '<tr><td>' + escapeHtml(act.name) + '</td><td>' + escapeHtml(act.code) + '</td><td style="text-align:right">' + Number(act.amount).toFixed(2).replace(".", ",") + ' €</td></tr>';
    }).join("");
    const ifdAmtPreview = typeof inv.ifdAmount !== 'undefined' ? inv.ifdAmount : IFD_AMOUNT;
    const ifdRow = inv.ifd
      ? '<tr><td>' + escapeHtml(IFD_LABEL) + '</td><td>IFD</td><td style="text-align:right">' + ifdAmtPreview.toFixed(2).replace(".", ",") + ' €</td></tr>'
      : '';
    const notesSection = inv.notes
      ? '<div class="invoice-footer" style="margin-bottom:10px">Note : ' + escapeHtml(inv.notes) + '</div>'
      : '';
    return '<div class="invoice-header">' +
      '<div class="invoice-practice"><strong>Léa Martin — Infirmière DE</strong>' +
      '<p>17, rue de la République · 69003 Lyon<br>RPPS : 12345678901 · SIRET : 898 765 432 00012</p></div>' +
      '<div class="invoice-meta"><strong>' + escapeHtml(inv.id) + '</strong><p>Émise le ' + date + '</p></div>' +
      '</div>' +
      '<div class="invoice-patient">' +
      '<div><span>Patient</span><strong>' + escapeHtml(inv.patient) + '</strong></div>' +
      '<div><span>Secteur</span><strong>' + escapeHtml(inv.sector) + '</strong></div>' +
      (inv.visitTime ? '<div><span>Date de soin</span><strong>' + date + ' · ' + escapeHtml(inv.visitTime) + '</strong></div>' : '') +
      '</div>' +
      '<table class="invoice-table"><thead><tr><th>Acte effectué</th><th>Code</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
      actsRows + ifdRow +
      '<tr class="invoice-total-row"><td colspan="2"><strong>Total honoraires</strong></td><td style="text-align:right"><strong>' + inv.total.toFixed(2).replace(".", ",") + ' €</strong></td></tr>' +
      '</tbody></table>' +
      notesSection +
      '<div class="invoice-footer">Prise en charge Assurance Maladie : 60 % · Mutuelle : selon contrat<br>' +
      'Règlement par virement ou chèque à l’ordre de Léa Martin · Merci de rappeler le N° de facture.</div>';
  }

  function printInvoice(inv) {
    const date = new Intl.DateTimeFormat("fr-FR").format(new Date(inv.date + "T12:00:00"));
    const win = window.open("", "_blank");
    if (!win) { showToast("Autorisez les pop-ups pour imprimer.", "Impression bloquée"); return; }
    const actsRows = (inv.acts || []).map(function (act) {
      return '<tr><td>' + escapeHtml(act.name) + '</td><td>' + escapeHtml(act.code) + '</td><td style="text-align:right">' + Number(act.amount).toFixed(2).replace(".", ",") + ' €</td></tr>';
    }).join("");
    const ifdAmtPrintW = typeof inv.ifdAmount !== 'undefined' ? inv.ifdAmount : IFD_AMOUNT;
    const ifdRow = inv.ifd
      ? '<tr><td>' + escapeHtml(IFD_LABEL) + '</td><td>IFD</td><td style="text-align:right">' + ifdAmtPrintW.toFixed(2).replace(".", ",") + ' €</td></tr>'
      : '';
    const notesSection = inv.notes
      ? '<p class="ftr" style="margin-bottom:12px">Note : ' + escapeHtml(inv.notes) + '</p>'
      : '';
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
      '<div><h1>Léa Martin</h1><p class="muted">Infirmière Diplômée d’État · Libérale<br>17, rue de la République · 69003 Lyon<br>RPPS : 12345678901 · SIRET : 898 765 432 00012</p></div>' +
      '<div style="text-align:right"><p class="inv-num">FACTURE ' + escapeHtml(inv.id) + '</p><p class="muted">Émise le ' + date + '</p></div>' +
      '</div>' +
      '<div class="pbox">' +
      '<div><span>Patient</span><strong>' + escapeHtml(inv.patient) + '</strong></div>' +
      '<div><span>Secteur</span><strong>' + escapeHtml(inv.sector) + '</strong></div>' +
      (inv.visitTime ? '<div><span>Date de soin</span><strong>' + date + ' à ' + escapeHtml(inv.visitTime) + '</strong></div>' : '') +
      '</div>' +
      '<table><thead><tr><th>Acte effectué</th><th>Code NGAP</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
      actsRows + ifdRow +
      '<tr class="tot"><td colspan="2">Total honoraires</td><td style="text-align:right">' + inv.total.toFixed(2).replace(".", ",") + ' €</td></tr>' +
      '</tbody></table>' +
      notesSection +
      '<div class="ftr">Prise en charge Assurance Maladie : 60 % · Mutuelle : selon contrat<br>' +
      'Règlement par virement ou chèque à l’ordre de Léa Martin<br>' +
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
      acts: [{ serviceId: svc.id, name: svc.name, code: svc.code, amount: svc.amount }],
      ifd: true,
      ifdAmount: IFD_AMOUNT,
      notes: "",
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
  // --- Patient dialog ---
  const patientDialog = document.getElementById("patientDialog");
  const patientForm = document.getElementById("patientForm");

  function openPatientDialog() {
    patientForm.reset();
    if (typeof patientDialog.showModal === "function") patientDialog.showModal();
    else patientDialog.setAttribute("open", "");
  }

  function closePatientDialog() {
    if (typeof patientDialog.close === "function") patientDialog.close();
    else patientDialog.removeAttribute("open");
  }

  document.querySelectorAll("[data-close-patient]").forEach(function (btn) {
    btn.addEventListener("click", closePatientDialog);
  });

  document.querySelectorAll("[data-add-patient]").forEach(function (btn) {
    btn.addEventListener("click", openPatientDialog);
  });

  patientForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const data = new FormData(patientForm);
    const initials = String(data.get("initials") || "").trim();
    if (!initials) return;
    patientIdCounter += 1;
    patients.unshift({
      id: patientIdCounter,
      initials: initials,
      sector: String(data.get("sector") || "Lyon 3e"),
      dob: String(data.get("dob") || "").trim() || undefined,
      doctor: String(data.get("doctor") || "").trim() || undefined,
      ss: String(data.get("ss") || "").trim() || undefined,
      mutuelle: String(data.get("mutuelle") || "").trim() || undefined,
      care: String(data.get("care") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      next: "\u2014",
    });
    renderPatients(patientSearch.value);
    closePatientDialog();
    showToast("Patient " + initials + " ajout\u00e9 au dossier.", "Patient enregistr\u00e9");
  });

  // --- New invoice dialog ---
  const newInvoiceDialog = document.getElementById("newInvoiceDialog");
  const newInvoiceForm = document.getElementById("newInvoiceForm");
  const actsList = document.getElementById("actsList");
  const invoicePatientSelect = document.getElementById("invoicePatientSelect");
  const ifdCheckbox = document.getElementById("ifdCheckbox");
  const liveTotalEl = document.getElementById("liveTotal");
  const invoiceSector = document.getElementById("invoiceSector");
  const addActBtn = document.getElementById("addActBtn");

  function populateInvoicePatientSelect(preselect) {
    invoicePatientSelect.innerHTML = '<option value="">\u2014 Choisir un patient \u2014</option>' +
      patients.map(function (p) {
        return '<option value="' + escapeHtml(p.initials) + '"' + (p.initials === preselect ? ' selected' : '') + '>' + escapeHtml(p.initials) + ' \u00b7 ' + escapeHtml(p.sector) + '</option>';
      }).join("");
    const sel = patients.find(function (p) { return p.initials === preselect; });
    invoiceSector.value = sel ? sel.sector : "";
  }

  function updateLiveTotal() {
    let total = 0;
    actsList.querySelectorAll(".act-row").forEach(function (row) {
      const sel = row.querySelector(".act-select");
      if (sel && sel.value) {
        const svc = serviceById(sel.value);
        const amountInput = row.querySelector(".act-amount");
        const enteredAmount = parseFloat(amountInput ? amountInput.value : "");
        total += Number.isFinite(enteredAmount) ? Math.max(0, enteredAmount) : (svc ? svc.amount : 0);
      }
    });
    if (ifdCheckbox.checked) {
      const ifdField = document.getElementById("ifdAmount");
      const enteredIfd = parseFloat(ifdField ? ifdField.value : "");
      total += Number.isFinite(enteredIfd) ? Math.max(0, enteredIfd) : IFD_AMOUNT;
    }
    liveTotalEl.textContent = total.toFixed(2).replace(".", ",") + " \u20ac";
    return total;
  }

  function createActRow() {
    const row = document.createElement("div");
    row.className = "act-row";
    row.innerHTML =
      '<select class="act-select" aria-label="Acte">' +
      services.map(function (svc) {
        return '<option value="' + escapeHtml(svc.id) + '">' + escapeHtml(svc.name) + '</option>';
      }).join("") +
      '</select>' +
      '<span class="act-code"></span>' +
      '<input type="number" class="act-amount" step="0.01" min="0" aria-label="Montant de l’acte"/> ' +
      '<button class="act-remove" type="button" aria-label="Supprimer cet acte">\u00d7</button>';

    function refreshRow() {
      const svc = serviceById(row.querySelector(".act-select").value);
      row.querySelector(".act-code").textContent = svc ? svc.code : "";
      row.querySelector(".act-amount").value = svc ? svc.amount.toFixed(2) : "";
      updateLiveTotal();
    }
    row.querySelector(".act-select").addEventListener("change", refreshRow);
    row.querySelector(".act-amount").addEventListener("input", updateLiveTotal);
    row.querySelector(".act-remove").addEventListener("click", function () {
      row.remove();
      updateLiveTotal();
    });
    refreshRow();
    return row;
  }

  function openNewInvoiceDialog(preselect) {
    newInvoiceForm.reset();
    actsList.innerHTML = "";
    populateInvoicePatientSelect(preselect || "");
    newInvoiceForm.elements.date.value = todayISO;
    actsList.appendChild(createActRow());
    ifdCheckbox.checked = true;
    updateLiveTotal();
    if (typeof newInvoiceDialog.showModal === "function") newInvoiceDialog.showModal();
    else newInvoiceDialog.setAttribute("open", "");
  }

  function closeNewInvoiceDialog() {
    if (typeof newInvoiceDialog.close === "function") newInvoiceDialog.close();
    else newInvoiceDialog.removeAttribute("open");
  }

  document.querySelectorAll("[data-close-new-invoice]").forEach(function (btn) {
    btn.addEventListener("click", closeNewInvoiceDialog);
  });

  document.querySelectorAll("[data-new-invoice]").forEach(function (btn) {
    btn.addEventListener("click", function () { openNewInvoiceDialog(); });
  });

  addActBtn.addEventListener("click", function () {
    actsList.appendChild(createActRow());
    updateLiveTotal();
  });

  invoicePatientSelect.addEventListener("change", function () {
    const initials = invoicePatientSelect.value;
    const patient = patients.find(function (p) { return p.initials === initials; });
    invoiceSector.value = patient ? patient.sector : "";
  });

  ifdCheckbox.addEventListener("change", updateLiveTotal);

  const ifdAmountInput = document.getElementById("ifdAmount");
  if (ifdAmountInput) ifdAmountInput.addEventListener("input", updateLiveTotal);

  newInvoiceForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const initials = invoicePatientSelect.value;
    if (!initials) { showToast("Veuillez s\u00e9lectionner un patient.", "Champ requis"); return; }
    const actRows = actsList.querySelectorAll(".act-row");
    if (!actRows.length) { showToast("Ajoutez au moins un acte.", "Champ requis"); return; }

    const data = new FormData(newInvoiceForm);
    const date = String(data.get("date") || todayISO);
    const sector = invoiceSector.value || "\u2014";
    const notes = String(data.get("notes") || "").trim();

    const acts = [];
    actRows.forEach(function (row) {
      const sel = row.querySelector(".act-select");
      const amtInput = row.querySelector(".act-amount");
      if (sel && sel.value) {
        const svc = serviceById(sel.value);
        if (svc) {
          const customAmount = parseFloat(amtInput ? amtInput.value : "");
          acts.push({ serviceId: svc.id, name: svc.name, code: svc.code, amount: Number.isFinite(customAmount) ? Math.max(0, customAmount) : svc.amount });
        }
      }
    });

    const ifdAmtEl2 = document.getElementById("ifdAmount");
    const enteredIfd = parseFloat(ifdAmtEl2 ? ifdAmtEl2.value : "");
    const ifdAmt = Number.isFinite(enteredIfd) ? Math.max(0, enteredIfd) : IFD_AMOUNT;
    const actsTotal = acts.reduce(function (sum, a) { return sum + a.amount; }, 0);
    const total = actsTotal + (ifdCheckbox.checked ? ifdAmt : 0);

    invoiceCounter += 1;
    const id = "SC-" + new Date().getFullYear() + "-" + String(invoiceCounter).padStart(3, "0");
    const inv = {
      id: id,
      date: date,
      patient: initials,
      sector: sector,
      acts: acts,
      ifd: ifdCheckbox.checked,
      ifdAmount: ifdCheckbox.checked ? ifdAmt : 0,
      notes: notes,
      visitTime: "",
      total: total,
      status: "\u00e9mise",
    };

    invoices.push(inv);
    currentInvoice = inv;
    closeNewInvoiceDialog();
    renderFacturation();
    const previewEl = document.getElementById("invoicePreview");
    if (previewEl) previewEl.innerHTML = buildInvoicePreviewHTML(inv);
    if (typeof invoiceDialog?.showModal === "function") invoiceDialog.showModal();
    else invoiceDialog?.setAttribute("open", "");
    showToast("Facture " + id + " cr\u00e9\u00e9e pour " + initials + ".", "Facture g\u00e9n\u00e9r\u00e9e");
  });

  function downloadInvoicePDF(inv) {
    if (!window.jspdf) { showToast("Bibliothèque PDF non chargée. Vérifiez votre connexion.", "Erreur"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const date = new Intl.DateTimeFormat('fr-FR').format(new Date(inv.date + 'T12:00:00'));
    const cG = [9, 106, 97];
    const cM = [100, 123, 120];
    const cD = [23, 50, 47];
    const cL = [221, 232, 226];
    const cB = [239, 245, 241];
    const L = 18, R = 192, W = R - L;
    let y = 22;

    // Practice
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cG);
    doc.text('Léa Martin', L, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...cM);
    doc.text('Infirmière Diplomée d’État · Libérale', L, y + 6);
    doc.text('17, rue de la République · 69003 Lyon', L, y + 11);
    doc.text('RPPS : 12345678901 · SIRET : 898 765 432 00012', L, y + 16);

    // Invoice ref
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cG);
    doc.text('FACTURE ' + inv.id, R, y, { align: 'right' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...cM);
    doc.text('Émise le ' + date, R, y + 7, { align: 'right' });

    // Separator
    y += 24;
    doc.setDrawColor(...cG); doc.setLineWidth(0.8); doc.line(L, y, R, y);
    y += 8;

    // Patient box
    doc.setFillColor(...cB); doc.roundedRect(L, y, W, 22, 3, 3, 'F');
    const col2 = [L + 6, L + 62, L + 116];
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cM);
    doc.text('PATIENT', col2[0], y + 7);
    doc.text('SECTEUR', col2[1], y + 7);
    if (inv.visitTime) doc.text('DATE DE SOIN', col2[2], y + 7);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cD);
    doc.text(inv.patient, col2[0], y + 15);
    doc.text(inv.sector, col2[1], y + 15);
    if (inv.visitTime) doc.text(date + ' · ' + inv.visitTime, col2[2], y + 15);
    y += 30;

    // Table header
    doc.setFillColor(...cB); doc.rect(L, y, W, 9, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cM);
    doc.text('ACTE EFFECTUÉ', L + 4, y + 6);
    doc.text('CODE', L + 122, y + 6);
    doc.text('MONTANT', R - 2, y + 6, { align: 'right' });
    y += 13;

    // Acts
    const ifdAmtPdf = typeof inv.ifdAmount !== 'undefined' ? inv.ifdAmount : IFD_AMOUNT;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...cD);
    for (const act of (inv.acts || [])) {
      doc.text(String(act.name), L + 4, y);
      doc.text(String(act.code), L + 122, y);
      doc.text(Number(act.amount).toFixed(2).replace('.', ',') + ' €', R - 2, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...cL); doc.setLineWidth(0.25); doc.line(L, y, R, y);
      y += 7;
    }

    // IFD
    if (inv.ifd) {
      doc.text(IFD_LABEL, L + 4, y);
      doc.text('IFD', L + 122, y);
      doc.text(ifdAmtPdf.toFixed(2).replace('.', ',') + ' €', R - 2, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...cL); doc.line(L, y, R, y);
      y += 7;
    }

    // Total
    y += 2;
    doc.setDrawColor(...cG); doc.setLineWidth(0.7); doc.line(L, y, R, y);
    y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...cG);
    doc.text('Total honoraires', L + 4, y);
    doc.text(inv.total.toFixed(2).replace('.', ',') + ' €', R - 2, y, { align: 'right' });
    y += 12;

    // Notes
    if (inv.notes) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...cM);
      doc.text('Note : ' + inv.notes, L + 4, y);
      y += 8;
    }

    // Footer
    y += 2;
    doc.setDrawColor(...cL); doc.setLineWidth(0.3); doc.line(L, y, R, y);
    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...cM);
    doc.text('Prise en charge Assurance Maladie : 60 % · Mutuelle : selon contrat', L + 4, y);
    y += 5;
    doc.text('Règlement par virement ou chèque à l’ordre de Léa Martin', L + 4, y);
    y += 5;
    doc.text('Merci de rappeler le N° de facture ' + inv.id + ' lors du règlement.', L + 4, y);

    doc.save('Facture-' + inv.id + '.pdf');
  }

  const downloadPdfBtn = document.querySelector("[data-download-pdf]");
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", function () {
      if (currentInvoice) downloadInvoicePDF(currentInvoice);
    });
  }

}());
