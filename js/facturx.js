"use strict";

/**
 * Génération XML Factur-X (profil MINIMUM — CII / EN 16931)
 * + Embedding dans un PDF existant via pdf-lib (PDF/A-3b)
 *
 * Spec : https://fnfe-mpe.org/factur-x/
 */
window.FacturX = (function () {

  const PDF_LIB_CDN = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";

  // ─── Utilitaires ──────────────────────────────────────────────────────────

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // ISO "2026-07-01" → "20260701" (format 102 Factur-X)
  function fmt102(isoStr) {
    return String(isoStr || "").replace(/-/g, "").slice(0, 8);
  }

  function fmtAmount(num) {
    return Number(num || 0).toFixed(2);
  }

  // ─── Génération XML ───────────────────────────────────────────────────────

  /**
   * Génère le XML Factur-X MINIMUM pour une facture.
   * @param {Object} invoice  Données facture (computeInvoice dans crm.js)
   * @param {Object} settings Paramètres CRM (infos entreprise)
   * @returns {string} XML string
   */
  function buildFacturXml(invoice, settings) {
    const s = settings || {};
    const inv = invoice || {};
    const client = inv.client || {};

    const sellerName    = esc(s.trade_name || s.legal_name || s.company || "Digitalexis Studio");
    const sellerSiret   = (s.siret || "").replace(/\s/g, "");
    const sellerAddr1   = esc(s.address_line1 || "");
    const sellerAddr2   = esc(s.address_line2 || "");
    const sellerZip     = esc(s.postal_code || "");
    const sellerCity    = esc(s.city || "");
    const sellerCountry = esc((s.country || "FR").slice(0, 2).toUpperCase());
    const sellerEmail   = esc(s.email || "");

    const buyerName    = esc(
      client.display_name ||
      client.company_name ||
      [client.first_name, client.last_name].filter(Boolean).join(" ") ||
      "Client"
    );
    const buyerSiret   = (client.client_siret || "").replace(/\s/g, "");
    const buyerCountry = esc((client.country || "FR").slice(0, 2).toUpperCase());

    const invoiceNumber = esc(inv.number || "FACTURE");
    const issueDate     = fmt102(inv.issue_date);
    const dueDate       = fmt102(inv.due_date);
    const currency      = esc(s.currency || "EUR");

    const taxBasis   = fmtAmount(inv.subtotal_amount ?? inv.total_amount ?? 0);
    const vatAmount  = fmtAmount(inv.vat_amount || 0);
    const grandTotal = fmtAmount(inv.total_amount || 0);
    const duePayable = fmtAmount(inv.amount_due ?? inv.total_amount ?? 0);
    const vatRate    = Number(inv.vat_rate ?? s.default_vat_rate ?? 0);
    const noVat      = vatRate === 0;

    const sellerSiretXml = sellerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(sellerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : "";

    const sellerEmailXml = sellerEmail ? `
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${sellerEmail}</ram:URIID>
        </ram:URIUniversalCommunication>` : "";

    const sellerAddrLines = [
      sellerAddr1 && `<ram:LineOne>${sellerAddr1}</ram:LineOne>`,
      sellerAddr2 && `<ram:LineTwo>${sellerAddr2}</ram:LineTwo>`,
      sellerZip   && `<ram:PostcodeCode>${sellerZip}</ram:PostcodeCode>`,
      sellerCity  && `<ram:CityName>${sellerCity}</ram:CityName>`,
      `<ram:CountryID>${sellerCountry}</ram:CountryID>`,
    ].filter(Boolean).map(l => `          ${l}`).join("\n");

    const buyerSiretXml = buyerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(buyerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : "";

    const dueDateXml = dueDate ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : "";

    // Micro-entreprise sans TVA → catégorie E + mention art. 293 B CGI
    const taxXml = noVat ? `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${vatAmount}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:ExemptionReason>TVA non applicable, article 293 B du CGI</ram:ExemptionReason>
        <ram:BasisAmount>${taxBasis}</ram:BasisAmount>
        <ram:CategoryCode>E</ram:CategoryCode>
        <ram:RateApplicablePercent>0</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>` : `
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${vatAmount}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${taxBasis}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${vatRate}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${sellerName}</ram:Name>${sellerSiretXml}
        <ram:PostalTradeAddress>
${sellerAddrLines}
        </ram:PostalTradeAddress>${sellerEmailXml}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${buyerName}</ram:Name>${buyerSiretXml}
        <ram:PostalTradeAddress>
          <ram:CountryID>${buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery/>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${taxXml}${dueDateXml}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:TaxBasisTotalAmount>${taxBasis}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${vatAmount}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${grandTotal}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${duePayable}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>

</rsm:CrossIndustryInvoice>`;
  }

  // ─── XMP Metadata (déclaration PDF/A-3b + Factur-X) ──────────────────────

  function buildXmpMetadata() {
    return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>MINIMUM</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  }

  // ─── Chargement lazy de pdf-lib ───────────────────────────────────────────

  let _pdfLibPromise = null;

  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (_pdfLibPromise) return _pdfLibPromise;

    _pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDF_LIB_CDN;
      script.crossOrigin = "anonymous";
      script.onload = () => {
        if (window.PDFLib) resolve(window.PDFLib);
        else reject(new Error("pdf-lib chargé mais window.PDFLib introuvable."));
      };
      script.onerror = () => {
        _pdfLibPromise = null;
        reject(new Error("Impossible de charger pdf-lib depuis le CDN."));
      };
      document.head.appendChild(script);
    });

    return _pdfLibPromise;
  }

  // ─── Embedding PDF/A-3 ────────────────────────────────────────────────────

  /**
   * Charge un PDF Blob (généré par jsPDF), y embarque le XML Factur-X
   * en pièce jointe avec AFRelationship = Alternative, et injecte
   * les métadonnées XMP (déclaration PDF/A-3b + namespace Factur-X).
   *
   * @param {Blob}   pdfBlob  PDF d'origine (jsPDF output)
   * @param {Object} invoice  Données de la facture
   * @param {Object} settings Paramètres CRM
   * @returns {Promise<Blob>} PDF enrichi
   */
  async function embedInPdf(pdfBlob, invoice, settings) {
    const PDFLib = await loadPdfLib();
    const { PDFDocument, AFRelationshipValue, PDFName } = PDFLib;

    const pdfBytes = await pdfBlob.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // 1. Génère le XML
    const xmlString = buildFacturXml(invoice, settings);
    const xmlBytes  = new TextEncoder().encode(xmlString);

    // 2. Embarque le XML avec le bon AFRelationship (Alternative pour MINIMUM)
    await pdfDoc.attach(xmlBytes, "factur-x.xml", {
      mimeType: "text/xml",
      description: "Factur-X MINIMUM — Facture électronique structurée (EN 16931)",
      creationDate: new Date(),
      modificationDate: new Date(),
      afRelationship: AFRelationshipValue.Alternative,
    });

    // 3. Injecte le stream XMP dans le catalogue PDF (déclaration PDF/A-3b)
    try {
      const xmpBytes = new TextEncoder().encode(buildXmpMetadata());
      const metaStream = pdfDoc.context.stream(xmpBytes, {
        Type: "Metadata",
        Subtype: "XML",
      });
      const metaRef = pdfDoc.context.register(metaStream);
      pdfDoc.catalog.set(PDFName.of("Metadata"), metaRef);
    } catch (err) {
      // L'injection XMP est best-effort : le PDF reste valide sans elle
      console.warn("[FacturX] XMP metadata injection skipped:", err);
    }

    // 4. Métadonnées de base
    pdfDoc.setProducer("Digitalexis Studio — CRM (Factur-X MINIMUM / pdf-lib)");
    pdfDoc.setSubject("Facture électronique Factur-X MINIMUM");
    pdfDoc.setKeywords(["Factur-X", "MINIMUM", "e-facturation", invoice?.number || ""]);

    const resultBytes = await pdfDoc.save();
    return new Blob([resultBytes], { type: "application/pdf" });
  }

  // ─── API publique ─────────────────────────────────────────────────────────

  /**
   * Télécharge uniquement le fichier XML Factur-X (sans PDF).
   */
  function downloadFacturXml(invoice, settings) {
    const xml  = buildFacturXml(invoice, settings);
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `factur-x_${(invoice?.number || "facture").replace(/[^a-zA-Z0-9_-]/g, "_")}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  return { buildFacturXml, downloadFacturXml, embedInPdf, loadPdfLib };
})();
