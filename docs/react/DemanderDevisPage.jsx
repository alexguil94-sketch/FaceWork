import React, { useState } from "react";
import "./demanderDevisPage.css";
import {
  quoteCategories,
  quoteFaq,
  quotePageContent,
  quoteProjectTypes,
  quoteStudioProfile,
} from "./demanderDevisData";

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const PDF_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
const PDF_TABLE_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js";

let pdfLibrariesPromise;

const defaultContactState = {
  projectType: quoteProjectTypes[0],
  fullName: "",
  company: "",
  email: "",
  phone: "",
  launchWindow: "",
  message: "",
  consent: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function formatRange(min, max, suffix = "") {
  if (min === max) {
    return `${formatCurrency(min)}${suffix}`;
  }

  return `${formatCurrency(min)} - ${formatCurrency(max)}${suffix}`;
}

function formatLongDate(value) {
  return longDateFormatter.format(new Date(value));
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMonthlyEstimate(summary) {
  if (!summary.monthlyMin && !summary.monthlyMax) {
    return "Aucun abonnement";
  }

  return formatRange(summary.monthlyMin, summary.monthlyMax, " / mois");
}

function buildQuoteMeta(validDays) {
  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + validDays);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");

  return {
    quoteNumber: `DV-${year}${month}${day}-${hour}${minute}`,
    issueDate: now.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

function buildInitialSelections(categories) {
  const selections = {};

  categories.forEach((category) => {
    category.items.forEach((item) => {
      selections[item.id] = {
        selected: false,
        quantity: item.defaultQuantity ?? 1,
      };
    });
  });

  return selections;
}

function buildSummary(categories, selections) {
  const lines = [];
  let setupMin = 0;
  let setupMax = 0;
  let monthlyMin = 0;
  let monthlyMax = 0;
  let projectionMin = 0;
  let projectionMax = 0;

  categories.forEach((category) => {
    category.items.forEach((item) => {
      const selection = selections[item.id];

      if (!selection?.selected) {
        return;
      }

      const quantity = clamp(
        Number(selection.quantity) || item.defaultQuantity || 1,
        item.minQuantity ?? 1,
        item.maxQuantity ?? 24,
      );
      const lineMin = item.min * quantity;
      const lineMax = item.max * quantity;

      if (item.billing === "monthly") {
        monthlyMin += item.min;
        monthlyMax += item.max;
      } else {
        setupMin += lineMin;
        setupMax += lineMax;
      }

      projectionMin += lineMin;
      projectionMax += lineMax;

      lines.push({
        id: item.id,
        categoryId: category.id,
        categoryTitle: category.title,
        title: item.title,
        billing: item.billing,
        quantity,
        quantityLabel: item.quantityLabel || "Unites",
        unitMin: item.min,
        unitMax: item.max,
        lineMin,
        lineMax,
        kindLabel: item.kindLabel,
      });
    });
  });

  return {
    lines,
    selectedCount: lines.length,
    setupMin,
    setupMax,
    monthlyMin,
    monthlyMax,
    projectionMin,
    projectionMax,
  };
}

function buildRecapText(summary, contact, quoteMeta) {
  const services = summary.lines.length
    ? summary.lines
        .map((line) => {
          const suffix =
            line.billing === "monthly"
              ? `, ${line.quantity} ${line.quantityLabel.toLowerCase()} de projection`
              : line.quantity > 1
                ? `, ${line.quantity} ${line.quantityLabel.toLowerCase()}`
                : "";

          return `- ${line.title} (${line.categoryTitle}) : ${formatRange(line.lineMin, line.lineMax)}${suffix}`;
        })
        .join("\n")
    : "- Aucune prestation selectionnee pour le moment";

  return [
    `Devis : ${quoteMeta.quoteNumber}`,
    `Type de projet : ${contact.projectType}`,
    `Budget de lancement : ${formatRange(summary.setupMin, summary.setupMax)}`,
    `Budget mensuel : ${formatMonthlyEstimate(summary)}`,
    `Projection estimee : ${formatRange(summary.projectionMin, summary.projectionMax)}`,
    "",
    "Prestations retenues :",
    services,
  ].join("\n");
}

function buildDocumentData({ summary, contact, quoteMeta }) {
  return {
    ...quoteMeta,
    studio: quoteStudioProfile,
    projectType: contact.projectType,
    clientName: contact.fullName || "Prospect",
    clientCompany: contact.company || "Entreprise non renseignee",
    clientEmail: contact.email || "Email non renseigne",
    clientPhone: contact.phone || "Telephone non renseigne",
    launchWindow: contact.launchWindow || "A definir",
    brief:
      contact.message ||
      "Le besoin detaille sera precise lors du premier echange de cadrage.",
    services: summary.lines,
    setupLabel: formatRange(summary.setupMin, summary.setupMax),
    monthlyLabel: formatMonthlyEstimate(summary),
    projectionLabel: formatRange(summary.projectionMin, summary.projectionMax),
    note: quoteStudioProfile.footerNote,
    shareText: buildRecapText(summary, contact, quoteMeta),
  };
}

function getQuoteFileName(documentData) {
  return (
    slugify(
      `${documentData.quoteNumber}-${documentData.clientName}-${documentData.clientCompany}`,
    ) || "devis-digitalexis-studio"
  );
}

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = Array.from(document.querySelectorAll("script")).find(
      (script) => script.src === src,
    );

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Impossible de charger ${src}`)),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.loaded = "false";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => {
      reject(new Error(`Impossible de charger ${src}`));
    });
    document.head.appendChild(script);
  });
}

async function ensurePdfLibraries() {
  if (typeof window === "undefined") {
    throw new Error("PDF indisponible hors navigateur.");
  }

  if (window.jspdf?.jsPDF) {
    return;
  }

  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = loadExternalScript(PDF_SCRIPT_URL).then(() =>
      loadExternalScript(PDF_TABLE_SCRIPT_URL),
    );
  }

  await pdfLibrariesPromise;

  if (!window.jspdf?.jsPDF) {
    throw new Error("jsPDF n'est pas disponible.");
  }
}

function drawPdfCard(pdf, { x, y, w, h, label, title, lines, palette }) {
  pdf.setFillColor(...palette.surface);
  pdf.setDrawColor(...palette.line);
  pdf.roundedRect(x, y, w, h, 18, 18, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...palette.accent);
  pdf.text(label.toUpperCase(), x + 18, y + 24);
  pdf.setFontSize(13);
  pdf.setTextColor(...palette.text);
  pdf.text(title, x + 18, y + 46);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...palette.muted);
  pdf.text(lines, x + 18, y + 66);
}

function drawPdfMetricCard(pdf, { x, y, w, h, label, value, palette, dark }) {
  if (dark) {
    pdf.setFillColor(...palette.dark);
    pdf.setDrawColor(...palette.dark);
    pdf.roundedRect(x, y, w, h, 18, 18, "FD");
    pdf.setTextColor(246, 242, 236);
  } else {
    pdf.setFillColor(...palette.surface);
    pdf.setDrawColor(...palette.line);
    pdf.roundedRect(x, y, w, h, 18, 18, "FD");
    pdf.setTextColor(...palette.text);
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(label.toUpperCase(), x + 16, y + 24);
  pdf.setFontSize(15);
  pdf.text(value, x + 16, y + 52, {
    maxWidth: w - 32,
  });
}

async function createQuotePdfBlob(documentData) {
  await ensurePdfLibraries();

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const palette = {
    page: [247, 242, 235],
    surface: [255, 251, 246],
    dark: [37, 27, 21],
    accent: [153, 95, 45],
    text: [38, 27, 20],
    muted: [116, 96, 79],
    line: [220, 206, 193],
  };

  pdf.setFillColor(...palette.page);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.setFillColor(...palette.dark);
  pdf.roundedRect(margin, 34, contentWidth, 126, 28, 28, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(218, 188, 154);
  pdf.text("DEMANDE DE DEVIS", margin + 24, 62);
  pdf.setFontSize(28);
  pdf.setTextColor(248, 245, 240);
  pdf.text(documentData.studio.legalName, margin + 24, 100);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(210, 201, 190);
  pdf.text(
    `Document ${documentData.quoteNumber}  |  ${documentData.projectType}`,
    margin + 24,
    126,
  );

  const cardTop = 182;
  const gap = 14;
  const cardWidth = (contentWidth - gap) / 2;
  const leftLines = [
    documentData.clientCompany,
    documentData.clientEmail,
    documentData.clientPhone,
    `Lancement souhaite : ${documentData.launchWindow}`,
  ];
  const rightLines = [
    documentData.studio.contactName,
    documentData.studio.email,
    documentData.studio.phone,
    documentData.studio.location,
  ];

  drawPdfCard(pdf, {
    x: margin,
    y: cardTop,
    w: cardWidth,
    h: 116,
    label: "Client",
    title: documentData.clientName,
    lines: leftLines,
    palette,
  });
  drawPdfCard(pdf, {
    x: margin + cardWidth + gap,
    y: cardTop,
    w: cardWidth,
    h: 116,
    label: "Studio",
    title: documentData.studio.legalName,
    lines: rightLines,
    palette,
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...palette.text);
  pdf.text("Prestations retenues", margin, 334);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...palette.muted);
  pdf.text(
    "Synthese du simulateur avec budget indicatif et projection globale.",
    margin,
    350,
  );

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable({
      startY: 366,
      margin: { left: margin, right: margin },
      head: [["Prestation", "Categorie", "Volume", "Mode", "Estimation"]],
      body: (documentData.services.length
        ? documentData.services
        : [
            {
              title: "Aucune prestation selectionnee",
              categoryTitle: "-",
              quantity: "-",
              billing: "-",
              lineMin: 0,
              lineMax: 0,
            },
          ]
      ).map((line) => [
        line.title,
        line.categoryTitle,
        String(line.quantity),
        line.billing === "monthly" ? "Mensuel" : "Ponctuel",
        formatRange(line.lineMin, line.lineMax),
      ]),
      theme: "plain",
      headStyles: {
        fillColor: palette.dark,
        textColor: [248, 245, 240],
        fontStyle: "bold",
        fontSize: 10,
        cellPadding: { top: 10, right: 10, bottom: 10, left: 10 },
      },
      bodyStyles: {
        textColor: palette.text,
        fontSize: 10,
        cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
        lineColor: palette.line,
        lineWidth: 0.8,
      },
      alternateRowStyles: {
        fillColor: [252, 248, 243],
      },
      columnStyles: {
        0: { cellWidth: 186 },
        1: { cellWidth: 102 },
        2: { cellWidth: 54, halign: "center" },
        3: { cellWidth: 72, halign: "center" },
        4: { cellWidth: 102, halign: "right" },
      },
    });
  }

  const tableEnd = pdf.lastAutoTable?.finalY || 396;
  const metricsTop = Math.min(tableEnd + 28, pageHeight - 210);
  const metricGap = 14;
  const metricWidth = (contentWidth - metricGap * 2) / 3;

  drawPdfMetricCard(pdf, {
    x: margin,
    y: metricsTop,
    w: metricWidth,
    h: 78,
    label: "Lancement",
    value: documentData.setupLabel,
    palette,
    dark: false,
  });
  drawPdfMetricCard(pdf, {
    x: margin + metricWidth + metricGap,
    y: metricsTop,
    w: metricWidth,
    h: 78,
    label: "Mensuel",
    value: documentData.monthlyLabel,
    palette,
    dark: false,
  });
  drawPdfMetricCard(pdf, {
    x: margin + (metricWidth + metricGap) * 2,
    y: metricsTop,
    w: metricWidth,
    h: 78,
    label: "Projection",
    value: documentData.projectionLabel,
    palette,
    dark: true,
  });

  const noteTop = metricsTop + 96;
  pdf.setFillColor(...palette.surface);
  pdf.setDrawColor(...palette.line);
  pdf.roundedRect(margin, noteTop, contentWidth, 92, 20, 20, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...palette.text);
  pdf.text("Cadrage et note importante", margin + 18, noteTop + 24);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...palette.muted);
  pdf.text(
    pdf.splitTextToSize(
      `${documentData.note} Date d'emission : ${formatLongDate(documentData.issueDate)}. Validite indicative : jusqu'au ${formatLongDate(documentData.validUntil)}.`,
      contentWidth - 36,
    ),
    margin + 18,
    noteTop + 42,
  );

  pdf.setDrawColor(...palette.line);
  pdf.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...palette.muted);
  pdf.text(
    `${documentData.studio.legalName} | ${documentData.studio.email} | ${documentData.quoteNumber}`,
    margin,
    pageHeight - 18,
  );

  return pdf.output("blob");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createPrintMarkup(documentData) {
  const rows = documentData.services.length
    ? documentData.services
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(line.title)}</td>
              <td>${escapeHtml(line.categoryTitle)}</td>
              <td>${escapeHtml(String(line.quantity))}</td>
              <td>${escapeHtml(line.billing === "monthly" ? "Mensuel" : "Ponctuel")}</td>
              <td>${escapeHtml(formatRange(line.lineMin, line.lineMax))}</td>
            </tr>
          `,
        )
        .join("")
    : `
      <tr>
        <td colspan="5">Aucune prestation selectionnee</td>
      </tr>
    `;

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(documentData.quoteNumber)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #f5efe7;
          color: #241a12;
          font-family: "Segoe UI", Arial, sans-serif;
        }
        .sheet {
          width: min(980px, calc(100% - 32px));
          margin: 24px auto;
          padding: 28px;
          border-radius: 28px;
          background: #fffaf4;
          box-shadow: 0 24px 80px rgba(69, 45, 25, 0.14);
        }
        .head {
          padding: 24px;
          border-radius: 24px;
          background: #251b15;
          color: #f8f3ec;
        }
        .head small {
          display: block;
          margin-bottom: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c9a37b;
          font-size: 11px;
          font-weight: 700;
        }
        .head h1 {
          margin: 0 0 10px;
          font-size: 36px;
          line-height: 1;
        }
        .head p {
          margin: 0;
          color: rgba(248, 243, 236, 0.78);
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }
        .card, .totals article, .note {
          padding: 18px;
          border: 1px solid rgba(104, 74, 45, 0.14);
          border-radius: 20px;
          background: #fffdf9;
        }
        .card small, .totals small {
          display: block;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 11px;
          color: #9d5f2d;
          font-weight: 700;
        }
        .card strong, .totals strong {
          display: block;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .stack {
          display: grid;
          gap: 6px;
          color: rgba(36, 26, 18, 0.74);
          font-size: 14px;
          line-height: 1.6;
        }
        .table-wrap {
          margin-top: 18px;
          overflow: hidden;
          border-radius: 20px;
          border: 1px solid rgba(104, 74, 45, 0.14);
          background: #fffdf9;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(104, 74, 45, 0.1);
          text-align: left;
          vertical-align: top;
          font-size: 14px;
        }
        th {
          background: #2c2018;
          color: #f8f3ec;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .totals {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }
        .totals article.is-dark {
          background: #251b15;
          color: #f8f3ec;
        }
        .totals article.is-dark small {
          color: #d9b08a;
        }
        .note {
          margin-top: 18px;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(36, 26, 18, 0.76);
        }
        .footer {
          margin-top: 16px;
          font-size: 12px;
          color: rgba(36, 26, 18, 0.56);
        }
        @media print {
          body { background: white; }
          .sheet {
            width: 100%;
            margin: 0;
            box-shadow: none;
            border-radius: 0;
          }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="head">
          <small>Demande de devis</small>
          <h1>${escapeHtml(documentData.studio.legalName)}</h1>
          <p>${escapeHtml(documentData.quoteNumber)} | ${escapeHtml(documentData.projectType)} | valide jusqu'au ${escapeHtml(formatLongDate(documentData.validUntil))}</p>
        </section>

        <section class="meta">
          <article class="card">
            <small>Client</small>
            <strong>${escapeHtml(documentData.clientName)}</strong>
            <div class="stack">
              <span>${escapeHtml(documentData.clientCompany)}</span>
              <span>${escapeHtml(documentData.clientEmail)}</span>
              <span>${escapeHtml(documentData.clientPhone)}</span>
              <span>Lancement souhaite : ${escapeHtml(documentData.launchWindow)}</span>
            </div>
          </article>
          <article class="card">
            <small>Studio</small>
            <strong>${escapeHtml(documentData.studio.legalName)}</strong>
            <div class="stack">
              <span>${escapeHtml(documentData.studio.contactName)}</span>
              <span>${escapeHtml(documentData.studio.email)}</span>
              <span>${escapeHtml(documentData.studio.phone)}</span>
              <span>${escapeHtml(documentData.studio.location)}</span>
            </div>
          </article>
        </section>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prestation</th>
                <th>Categorie</th>
                <th>Volume</th>
                <th>Mode</th>
                <th>Estimation</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <section class="totals">
          <article>
            <small>Lancement</small>
            <strong>${escapeHtml(documentData.setupLabel)}</strong>
          </article>
          <article>
            <small>Mensuel</small>
            <strong>${escapeHtml(documentData.monthlyLabel)}</strong>
          </article>
          <article class="is-dark">
            <small>Projection</small>
            <strong>${escapeHtml(documentData.projectionLabel)}</strong>
          </article>
        </section>

        <section class="note">
          <strong>Brief projet</strong>
          <div>${escapeHtml(documentData.brief)}</div>
          <div style="margin-top:12px">${escapeHtml(documentData.note)}</div>
        </section>

        <p class="footer">
          ${escapeHtml(documentData.studio.legalName)} | ${escapeHtml(documentData.studio.email)} | Emission ${escapeHtml(formatLongDate(documentData.issueDate))}
        </p>
      </main>
      <script>
        window.onload = function () {
          window.focus();
        };
      </script>
    </body>
  </html>`;
}

function openPrintWindow(documentData, autoPrint = false) {
  const popup = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=1120,height=920",
  );

  if (!popup) {
    throw new Error("La fenetre d'impression a ete bloquee.");
  }

  popup.document.open();
  popup.document.write(createPrintMarkup(documentData));
  popup.document.close();

  if (autoPrint) {
    popup.onload = () => {
      popup.focus();
      popup.print();
    };
  }
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="quote-page__section-heading">
      <p className="quote-page__eyebrow">{eyebrow}</p>
      <h2 className="quote-page__section-title">{title}</h2>
      <p className="quote-page__section-copy">{description}</p>
    </div>
  );
}

function QuoteHero() {
  return (
    <section className="quote-page__hero">
      <div className="quote-page__hero-copy">
        <p className="quote-page__eyebrow">{quotePageContent.heroBadge}</p>
        <h1 className="quote-page__hero-title">{quotePageContent.heroTitle}</h1>
        <p className="quote-page__hero-body">{quotePageContent.heroBody}</p>

        <div className="quote-page__hero-actions">
          <a
            className="quote-page__button quote-page__button--primary"
            href={quotePageContent.primaryCtaHref}
          >
            {quotePageContent.primaryCtaLabel}
          </a>
          <a
            className="quote-page__button quote-page__button--secondary"
            href={quotePageContent.secondaryCtaHref}
          >
            {quotePageContent.secondaryCtaLabel}
          </a>
        </div>

        <div className="quote-page__hero-stats">
          {quotePageContent.heroStats.map((stat) => (
            <article className="quote-page__metric-card" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>
      </div>

      <aside className="quote-page__hero-panel">
        <div className="quote-page__hero-panel-sheen" />
        <p className="quote-page__panel-label">Tarifs de depart</p>
        <div className="quote-page__hero-offers">
          {quotePageContent.heroOffers.map((offer) => (
            <article className="quote-page__offer-card" key={offer.title}>
              <div>
                <h3>{offer.title}</h3>
                <p>{offer.description}</p>
              </div>
              <strong>{offer.priceLabel}</strong>
            </article>
          ))}
        </div>
      </aside>
    </section>
  );
}

function ServiceCard({ item, selection, onToggle, onStepQuantity }) {
  const quantity = selection.quantity || item.defaultQuantity || 1;
  const quantityLabel = item.quantityLabel || "unites";
  const unitLabel =
    item.billing === "monthly"
      ? `${formatRange(item.min, item.max)} / mois`
      : item.pricingLabel;
  const totalLabel =
    item.quantityLabel || item.billing === "monthly"
      ? formatRange(item.min * quantity, item.max * quantity)
      : item.pricingLabel;

  return (
    <article
      className={`quote-page__service-card${selection.selected ? " is-selected" : ""}`}
    >
      <div className="quote-page__service-topline">
        <span className="quote-page__service-kind">{item.kindLabel}</span>
        {item.featured ? (
          <span className="quote-page__service-flag">Selection studio</span>
        ) : null}
      </div>

      <div className="quote-page__service-main">
        <div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </div>

        <div className="quote-page__service-price">
          <strong>{item.fromLabel}</strong>
          <span>{unitLabel}</span>
        </div>
      </div>

      {(item.quantityLabel || item.billing === "monthly") &&
      selection.selected ? (
        <div className="quote-page__quantity-row">
          <span>
            Duree / volume
            <small>{quantityLabel}</small>
          </span>

          <div
            className="quote-page__stepper"
            role="group"
            aria-label={`Quantite pour ${item.title}`}
          >
            <button
              type="button"
              onClick={() => onStepQuantity(item, -1)}
              disabled={quantity <= (item.minQuantity ?? 1)}
            >
              -
            </button>
            <strong>
              {quantity} {quantityLabel.toLowerCase()}
            </strong>
            <button
              type="button"
              onClick={() => onStepQuantity(item, 1)}
              disabled={quantity >= (item.maxQuantity ?? 24)}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div className="quote-page__service-footer">
        <div className="quote-page__service-total">
          <span>Total estime</span>
          <strong>{totalLabel}</strong>
        </div>

        <button
          type="button"
          className={`quote-page__toggle${selection.selected ? " is-active" : ""}`}
          onClick={() => onToggle(item)}
        >
          {selection.selected ? "Retirer" : "Ajouter"}
        </button>
      </div>
    </article>
  );
}

function CategoryBlock({ category, selections, onToggle, onStepQuantity }) {
  const selectedCount = category.items.filter(
    (item) => selections[item.id]?.selected,
  ).length;

  return (
    <section className="quote-page__category-block" id={category.id}>
      <div className="quote-page__category-header">
        <div>
          <p className="quote-page__category-kicker">{category.title}</p>
          <h3>{category.description}</h3>
        </div>
        <span className="quote-page__category-count">
          {selectedCount} selection{selectedCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="quote-page__service-grid">
        {category.items.map((item) => (
          <ServiceCard
            item={item}
            key={item.id}
            selection={selections[item.id]}
            onToggle={onToggle}
            onStepQuantity={onStepQuantity}
          />
        ))}
      </div>
    </section>
  );
}

function SummaryPanel({ summary, selections, onReset }) {
  return (
    <aside className="quote-page__summary-card">
      <div className="quote-page__summary-head">
        <p className="quote-page__panel-label">Recapitulatif du devis</p>
        <h3>Votre estimation se clarifie en direct.</h3>
        <p>{quotePageContent.summaryNote}</p>
      </div>

      <div className="quote-page__summary-metrics">
        <article>
          <span>Budget de lancement</span>
          <strong>{formatRange(summary.setupMin, summary.setupMax)}</strong>
        </article>
        <article>
          <span>Budget mensuel</span>
          <strong>{formatMonthlyEstimate(summary)}</strong>
        </article>
        <article>
          <span>Projection estimee</span>
          <strong>
            {formatRange(summary.projectionMin, summary.projectionMax)}
          </strong>
        </article>
      </div>

      <div className="quote-page__summary-selection">
        <div className="quote-page__summary-selection-head">
          <strong>
            {summary.selectedCount} prestation
            {summary.selectedCount > 1 ? "s" : ""}
          </strong>
          <button type="button" onClick={onReset}>
            Reinitialiser
          </button>
        </div>

        {summary.lines.length ? (
          <ul className="quote-page__summary-list">
            {summary.lines.map((line) => (
              <li key={line.id}>
                <div>
                  <strong>{line.title}</strong>
                  <span>
                    {line.categoryTitle}
                    {line.quantity > 1
                      ? ` - ${line.quantity} ${line.quantityLabel.toLowerCase()}`
                      : ""}
                  </span>
                </div>
                <strong>{formatRange(line.lineMin, line.lineMax)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="quote-page__summary-empty">
            Selectionnez une ou plusieurs prestations pour voir apparaitre le
            recapitulatif ici.
          </div>
        )}
      </div>

      <div className="quote-page__summary-foot">
        <span>Etat actuel</span>
        <strong>
          {Object.values(selections).filter((entry) => entry.selected).length}{" "}
          service actif
        </strong>
      </div>
    </aside>
  );
}

function QuoteDocumentSection({
  documentData,
  canExport,
  actionState,
  onDownloadPdf,
  onPrint,
  onShare,
}) {
  return (
    <section className="quote-page__document-section">
      <div className="quote-page__document-header">
        <SectionHeading
          eyebrow={quotePageContent.documentEyebrow}
          title={quotePageContent.documentTitle}
          description={quotePageContent.documentBody}
        />

        <div className="quote-page__document-actions">
          <button
            className="quote-page__button quote-page__button--primary"
            disabled={!canExport || actionState.kind === "loading"}
            type="button"
            onClick={onDownloadPdf}
          >
            {actionState.kind === "loading"
              ? "Generation..."
              : "Telecharger le PDF"}
          </button>
          <button
            className="quote-page__button quote-page__button--secondary"
            disabled={!canExport}
            type="button"
            onClick={onShare}
          >
            Partager
          </button>
          <button
            className="quote-page__button quote-page__button--secondary"
            disabled={!canExport}
            type="button"
            onClick={onPrint}
          >
            Imprimer
          </button>
        </div>
      </div>

      {actionState.message ? (
        <p className={`quote-page__action-feedback is-${actionState.kind}`}>
          {actionState.message}
        </p>
      ) : null}

      <article className="quote-page__document-card">
        <header className="quote-page__document-head">
          <div>
            <p className="quote-page__panel-label">Demande de devis</p>
            <h3>{documentData.studio.legalName}</h3>
            <p>
              {documentData.quoteNumber} - {documentData.projectType}
            </p>
          </div>
          <div className="quote-page__document-badges">
            <span>Emission {formatLongDate(documentData.issueDate)}</span>
            <span>Validite {formatLongDate(documentData.validUntil)}</span>
          </div>
        </header>

        <div className="quote-page__document-meta">
          <article>
            <small>Client</small>
            <strong>{documentData.clientName}</strong>
            <p>{documentData.clientCompany}</p>
            <p>{documentData.clientEmail}</p>
            <p>{documentData.clientPhone}</p>
            <p>Lancement souhaite : {documentData.launchWindow}</p>
          </article>
          <article>
            <small>Studio</small>
            <strong>{documentData.studio.legalName}</strong>
            <p>{documentData.studio.contactName}</p>
            <p>{documentData.studio.email}</p>
            <p>{documentData.studio.phone}</p>
            <p>{documentData.studio.location}</p>
          </article>
        </div>

        <div className="quote-page__document-table-wrap">
          <table className="quote-page__document-table">
            <thead>
              <tr>
                <th>Prestation</th>
                <th>Categorie</th>
                <th>Volume</th>
                <th>Mode</th>
                <th>Estimation</th>
              </tr>
            </thead>
            <tbody>
              {documentData.services.length ? (
                documentData.services.map((line) => (
                  <tr key={line.id}>
                    <td>{line.title}</td>
                    <td>{line.categoryTitle}</td>
                    <td>{line.quantity}</td>
                    <td>
                      {line.billing === "monthly" ? "Mensuel" : "Ponctuel"}
                    </td>
                    <td>{formatRange(line.lineMin, line.lineMax)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    Aucune prestation selectionnee pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="quote-page__document-totals">
          <article>
            <small>Lancement</small>
            <strong>{documentData.setupLabel}</strong>
          </article>
          <article>
            <small>Mensuel</small>
            <strong>{documentData.monthlyLabel}</strong>
          </article>
          <article className="is-dark">
            <small>Projection</small>
            <strong>{documentData.projectionLabel}</strong>
          </article>
        </div>

        <div className="quote-page__document-brief">
          <small>Brief projet</small>
          <p>{documentData.brief}</p>
        </div>

        <div className="quote-page__document-note">
          <small>Note importante</small>
          <p>{documentData.note}</p>
        </div>
      </article>
    </section>
  );
}

function ContactForm({
  contact,
  summary,
  submitState,
  onContactChange,
  onSubmit,
  onDownloadPdf,
}) {
  const canSubmit = summary.selectedCount > 0 && submitState !== "sending";

  return (
    <section className="quote-page__contact-section" id="formulaire-contact">
      <div className="quote-page__contact-copy">
        <SectionHeading
          eyebrow={quotePageContent.formEyebrow}
          title={quotePageContent.formTitle}
          description={quotePageContent.formBody}
        />

        <div className="quote-page__contact-recap">
          <p className="quote-page__panel-label">Workflow recommande</p>
          <pre>
            1. Composez le devis dans le simulateur.
            {"\n"}
            2. Verifiez le document ci-dessus.
            {"\n"}
            3. Exportez le PDF ou imprimez-le.
            {"\n"}
            4. Envoyez ensuite la demande finale avec le contexte projet.
          </pre>
          <button
            className="quote-page__button quote-page__button--secondary"
            disabled={!summary.selectedCount}
            type="button"
            onClick={onDownloadPdf}
          >
            Exporter le PDF maintenant
          </button>
        </div>
      </div>

      <form className="quote-page__contact-form" onSubmit={onSubmit}>
        <div className="quote-page__form-grid">
          <label>
            <span>Type de projet</span>
            <select
              name="projectType"
              value={contact.projectType}
              onChange={onContactChange}
            >
              {quoteProjectTypes.map((projectType) => (
                <option key={projectType} value={projectType}>
                  {projectType}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Nom complet</span>
            <input
              name="fullName"
              type="text"
              placeholder="Votre nom"
              value={contact.fullName}
              onChange={onContactChange}
              required
            />
          </label>

          <label>
            <span>Societe</span>
            <input
              name="company"
              type="text"
              placeholder="Nom de la marque ou de l'entreprise"
              value={contact.company}
              onChange={onContactChange}
            />
          </label>

          <label>
            <span>Email professionnel</span>
            <input
              name="email"
              type="email"
              placeholder="bonjour@studio.fr"
              value={contact.email}
              onChange={onContactChange}
              required
            />
          </label>

          <label>
            <span>Telephone</span>
            <input
              name="phone"
              type="tel"
              placeholder="+33"
              value={contact.phone}
              onChange={onContactChange}
            />
          </label>

          <label>
            <span>Horizon de lancement</span>
            <input
              name="launchWindow"
              type="text"
              placeholder="Ex: sous 6 semaines"
              value={contact.launchWindow}
              onChange={onContactChange}
            />
          </label>
        </div>

        <label className="quote-page__full-width">
          <span>Contexte du projet</span>
          <textarea
            name="message"
            rows="6"
            placeholder="Expliquez l'objectif, le niveau de finition souhaite, les contenus deja disponibles et les contraintes importantes."
            value={contact.message}
            onChange={onContactChange}
            required
          />
        </label>

        <label className="quote-page__consent">
          <input
            name="consent"
            type="checkbox"
            checked={contact.consent}
            onChange={onContactChange}
            required
          />
          <span>
            J'accepte d'etre recontacte pour recevoir un devis detaille et
            personnalise.
          </span>
        </label>

        <div className="quote-page__form-footer">
          <div>
            <span className="quote-page__panel-label">
              Budget actuel estime
            </span>
            <strong>
              {formatRange(summary.projectionMin, summary.projectionMax)}
            </strong>
          </div>

          <button
            className="quote-page__button quote-page__button--primary"
            disabled={!canSubmit}
            type="submit"
          >
            {submitState === "sending"
              ? "Preparation..."
              : "Envoyer la demande"}
          </button>
        </div>

        {submitState === "success" ? (
          <p className="quote-page__form-feedback is-success">
            Votre demande est prete. Vous pouvez maintenant la brancher a votre
            CRM, votre API ou votre formulaire de production.
          </p>
        ) : null}
        {submitState === "error" ? (
          <p className="quote-page__form-feedback is-error">
            Ajoutez au moins une prestation et verifiez la configuration d'envoi
            avant de relancer la demande.
          </p>
        ) : null}
      </form>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="quote-page__faq-section">
      <SectionHeading
        eyebrow={quotePageContent.faqEyebrow}
        title={quotePageContent.faqTitle}
        description={quotePageContent.faqBody}
      />

      <div className="quote-page__faq-grid">
        {quoteFaq.map((item) => (
          <details className="quote-page__faq-item" key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function DemanderDevisPage({ onSubmitRequest }) {
  const [selections, setSelections] = useState(() =>
    buildInitialSelections(quoteCategories),
  );
  const [contact, setContact] = useState(defaultContactState);
  const [quoteMeta] = useState(() =>
    buildQuoteMeta(quoteStudioProfile.validDays),
  );
  const [submitState, setSubmitState] = useState("idle");
  const [actionState, setActionState] = useState({
    kind: "idle",
    message: "",
  });
  const summary = buildSummary(quoteCategories, selections);
  const documentData = buildDocumentData({ summary, contact, quoteMeta });

  function clearMessages() {
    setSubmitState("idle");
    setActionState({ kind: "idle", message: "" });
  }

  function handleToggle(item) {
    clearMessages();
    setSelections((current) => ({
      ...current,
      [item.id]: {
        ...current[item.id],
        selected: !current[item.id].selected,
        quantity: current[item.id].quantity || item.defaultQuantity || 1,
      },
    }));
  }

  function handleStepQuantity(item, step) {
    clearMessages();
    setSelections((current) => {
      const nextQuantity = clamp(
        (current[item.id].quantity || item.defaultQuantity || 1) + step,
        item.minQuantity ?? 1,
        item.maxQuantity ?? 24,
      );

      return {
        ...current,
        [item.id]: {
          ...current[item.id],
          selected: true,
          quantity: nextQuantity,
        },
      };
    });
  }

  function handleContactChange(event) {
    const { name, value, type, checked } = event.target;

    clearMessages();
    setContact((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleReset() {
    clearMessages();
    setSelections(buildInitialSelections(quoteCategories));
  }

  async function handleDownloadPdf() {
    if (!summary.selectedCount) {
      setActionState({
        kind: "error",
        message: "Ajoutez au moins une prestation avant de generer le PDF.",
      });
      return;
    }

    setActionState({
      kind: "loading",
      message: "Generation du PDF premium en cours...",
    });

    try {
      const blob = await createQuotePdfBlob(documentData);
      downloadBlob(blob, `${getQuoteFileName(documentData)}.pdf`);
      setActionState({
        kind: "success",
        message: "Le devis PDF a ete telecharge.",
      });
    } catch (error) {
      setActionState({
        kind: "error",
        message:
          "Impossible de generer le PDF pour le moment. Verifiez la connexion ou la politique de scripts du site.",
      });
    }
  }

  function handlePrint() {
    if (!summary.selectedCount) {
      setActionState({
        kind: "error",
        message: "Ajoutez au moins une prestation avant impression.",
      });
      return;
    }

    try {
      openPrintWindow(documentData, true);
      setActionState({
        kind: "success",
        message: "La version imprimable du devis a ete ouverte.",
      });
    } catch (error) {
      setActionState({
        kind: "error",
        message:
          "Impossible d'ouvrir la fenetre d'impression. Verifiez le blocage des pop-ups.",
      });
    }
  }

  async function handleShare() {
    if (!summary.selectedCount) {
      setActionState({
        kind: "error",
        message: "Ajoutez au moins une prestation avant partage.",
      });
      return;
    }

    try {
      if (navigator.share) {
        let file;

        try {
          const blob = await createQuotePdfBlob(documentData);
          file = new File([blob], `${getQuoteFileName(documentData)}.pdf`, {
            type: "application/pdf",
          });
        } catch (error) {
          file = null;
        }

        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${documentData.studio.legalName} - ${documentData.quoteNumber}`,
            text: documentData.shareText,
            files: [file],
          });
        } else {
          await navigator.share({
            title: `${documentData.studio.legalName} - ${documentData.quoteNumber}`,
            text: documentData.shareText,
            url: window.location.href,
          });
        }

        setActionState({
          kind: "success",
          message: "Le devis a ete partage.",
        });
        return;
      }

      await navigator.clipboard.writeText(documentData.shareText);
      setActionState({
        kind: "success",
        message:
          "Le recapitulatif du devis a ete copie dans le presse-papiers.",
      });
    } catch (error) {
      setActionState({
        kind: "error",
        message:
          "Le partage n'a pas abouti. Essayez le PDF ou l'impression a la place.",
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!summary.selectedCount) {
      setSubmitState("error");
      return;
    }

    setSubmitState("sending");

    const payload = {
      contact,
      summary,
      quoteMeta,
      documentData,
      selectedServices: summary.lines,
      recapText: buildRecapText(summary, contact, quoteMeta),
    };

    try {
      if (onSubmitRequest) {
        await onSubmitRequest(payload);
      }

      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
    }
  }

  return (
    <div className="quote-page">
      <div className="quote-page__background-orb quote-page__background-orb--amber" />
      <div className="quote-page__background-orb quote-page__background-orb--sand" />

      <div className="quote-page__shell">
        <QuoteHero />

        <section className="quote-page__simulator" id="simulateur-devis">
          <div className="quote-page__simulator-head">
            <SectionHeading
              eyebrow={quotePageContent.simulatorEyebrow}
              title={quotePageContent.simulatorTitle}
              description={quotePageContent.simulatorBody}
            />
          </div>

          <div className="quote-page__simulator-layout">
            <div className="quote-page__catalog">
              {quoteCategories.map((category) => (
                <CategoryBlock
                  category={category}
                  key={category.id}
                  selections={selections}
                  onToggle={handleToggle}
                  onStepQuantity={handleStepQuantity}
                />
              ))}
            </div>

            <SummaryPanel
              summary={summary}
              selections={selections}
              onReset={handleReset}
            />
          </div>
        </section>

        <QuoteDocumentSection
          actionState={actionState}
          canExport={summary.selectedCount > 0}
          documentData={documentData}
          onDownloadPdf={handleDownloadPdf}
          onPrint={handlePrint}
          onShare={handleShare}
        />

        <ContactForm
          contact={contact}
          onContactChange={handleContactChange}
          onDownloadPdf={handleDownloadPdf}
          onSubmit={handleSubmit}
          submitState={submitState}
          summary={summary}
        />

        <FaqSection />
      </div>
    </div>
  );
}
