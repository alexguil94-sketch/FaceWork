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
      detail: "Réfection du pansement, observation de la cicatrisation et transmission ciblée.",
    },
    {
      id: "injection",
      name: "Injection prescrite",
      category: "technique",
      tag: "Injection",
      tagClass: "injection",
      duration: "15 min",
      detail: "Administration du traitement prescrit et traçabilité de l'acte effectué.",
    },
    {
      id: "prelevement",
      name: "Prélèvement sanguin",
      category: "technique",
      tag: "Prélèvement",
      tagClass: "bilan",
      duration: "20 min",
      detail: "Prélèvement à domicile, identification et suivi de remise au laboratoire.",
    },
    {
      id: "diabete",
      name: "Suivi diabétique",
      category: "surveillance",
      tag: "Suivi",
      tagClass: "suivi",
      duration: "20 min",
      detail: "Contrôle glycémique, injection prescrite si nécessaire et surveillance.",
    },
    {
      id: "post-hospitalisation",
      name: "Surveillance post-hospitalisation",
      category: "surveillance",
      tag: "Surveillance",
      tagClass: "suivi",
      duration: "30 min",
      detail: "Constantes, douleur, tolérance du traitement et alerte si besoin.",
    },
    {
      id: "coordination",
      name: "Coordination maintien à domicile",
      category: "coordination",
      tag: "Coordination",
      tagClass: "pansement",
      duration: "30 min",
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
      '<article class="appointment">',
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
        '<article class="route-visit">',
        '<span class="route-index">' + (index + 1) + "</span>",
        '<div><strong>' + escapeHtml(visit.patient) + " · " + escapeHtml(service.name) + "</strong><small>" + escapeHtml(visit.sector) + " · " + escapeHtml(service.duration) + "</small></div>",
        '<time>' + escapeHtml(visit.time) + "</time>",
        '<span class="status ' + statusClass(visit.status) + '">' + escapeHtml(visit.status) + "</span>",
        "</article>",
      ].join("");
    }).join("");

    updateStats();
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

  populateServiceSelect();
  renderAppointments();
  renderPatients("");
  renderServices();
  bindNotifyButtons(document);
  setupTheme();
}());
