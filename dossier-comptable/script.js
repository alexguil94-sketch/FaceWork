"use strict";

/* =========================
   Configuration
========================= */

const STORAGE_KEYS = {
    transactions: "comptaclair-transactions",
    settings: "comptaclair-settings",
    theme: "comptaclair-theme",
    invoices: "comptaclair-invoices"
};

const LOCAL_INVOICE_FILE_SIZE = 2 * 1024 * 1024;
const DATABASE_INVOICE_FILE_SIZE = 10 * 1024 * 1024;
const INVOICE_TABLE = "comptaclair_invoices";
const PDFJS_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
const PDFJS_WORKER_URL =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
const TESSERACT_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const STORAGE_BUCKET =
    String(window.FW_ENV?.SUPABASE_BUCKET || "facework").trim() ||
    "facework";

const CATEGORY_OPTIONS = {
    income: [
        "Prestations",
        "Vente de produits",
        "Acompte",
        "Remboursement",
        "Autre recette"
    ],
    expense: [
        "Logiciels",
        "Matériel",
        "Déplacement",
        "Téléphone / Internet",
        "Publicité",
        "Formation",
        "Fournitures",
        "Autre dépense"
    ]
};

const DEFAULT_SETTINGS = {
    contributionRate: 25,
    taxRate: 5
};

function createId() {
    if (
        globalThis.crypto &&
        typeof globalThis.crypto.randomUUID === "function"
    ) {
        return globalThis.crypto.randomUUID();
    }

    return `transaction-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_TRANSACTIONS = [
    {
        id: createId(),
        type: "income",
        date: getTodayISO(),
        description: "Création d’un site vitrine",
        category: "Prestations",
        amount: 850,
        note: "Donnée d'exemple"
    },
    {
        id: createId(),
        type: "expense",
        date: getTodayISO(),
        description: "Abonnement logiciel",
        category: "Logiciels",
        amount: 24.99,
        note: "Donnée d'exemple"
    }
];


/* =========================
   Éléments du DOM
========================= */

const monthFilter = document.querySelector("#monthFilter");

const incomeAmount = document.querySelector("#incomeAmount");
const incomeCount = document.querySelector("#incomeCount");

const expenseAmount = document.querySelector("#expenseAmount");
const expenseCount = document.querySelector("#expenseCount");

const contributionAmount = document.querySelector("#contributionAmount");
const contributionRateText = document.querySelector("#contributionRateText");
const availableAmount = document.querySelector("#availableAmount");

const expenseShareText = document.querySelector("#expenseShareText");
const contributionShareText = document.querySelector("#contributionShareText");
const taxShareText = document.querySelector("#taxShareText");
const availableShareText = document.querySelector("#availableShareText");

const expenseProgress = document.querySelector("#expenseProgress");
const contributionProgress = document.querySelector("#contributionProgress");
const taxProgress = document.querySelector("#taxProgress");
const availableProgress = document.querySelector("#availableProgress");

const reserveContribution = document.querySelector("#reserveContribution");
const reserveTax = document.querySelector("#reserveTax");
const reserveTotal = document.querySelector("#reserveTotal");

const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const categoryFilter = document.querySelector("#categoryFilter");
const transactionsTableBody = document.querySelector("#transactionsTableBody");
const emptyState = document.querySelector("#emptyState");

const openTransactionButton = document.querySelector("#openTransactionButton");
const openTransactionButtonSecondary = document.querySelector(
    "#openTransactionButtonSecondary"
);

const transactionModal = document.querySelector("#transactionModal");
const closeModalButton = document.querySelector("#closeModalButton");
const cancelTransactionButton = document.querySelector(
    "#cancelTransactionButton"
);

const transactionForm = document.querySelector("#transactionForm");
const transactionType = document.querySelector("#transactionType");
const transactionDate = document.querySelector("#transactionDate");
const transactionDescription = document.querySelector(
    "#transactionDescription"
);
const transactionCategory = document.querySelector("#transactionCategory");
const transactionAmount = document.querySelector("#transactionAmount");
const transactionNote = document.querySelector("#transactionNote");

const invoiceForm = document.querySelector("#invoiceForm");
const invoiceDocumentType = document.querySelector("#invoiceDocumentType");
const invoiceSupplier = document.querySelector("#invoiceSupplier");
const invoiceReference = document.querySelector("#invoiceReference");
const invoiceDate = document.querySelector("#invoiceDate");
const invoiceAmount = document.querySelector("#invoiceAmount");
const invoiceVatAmount = document.querySelector("#invoiceVatAmount");
const invoiceVatRate = document.querySelector("#invoiceVatRate");
const invoiceCategory = document.querySelector("#invoiceCategory");
const invoiceEmailFrom = document.querySelector("#invoiceEmailFrom");
const invoiceEmailSubject = document.querySelector("#invoiceEmailSubject");
const invoiceFile = document.querySelector("#invoiceFile");
const invoiceFileHelp = document.querySelector("#invoiceFileHelp");
const invoiceFormTitle = document.querySelector("#invoiceFormTitle");
const invoiceSubmitButton = document.querySelector("#invoiceSubmitButton");
const cancelInvoiceEditButton = document.querySelector(
    "#cancelInvoiceEditButton"
);
const scanInvoiceButton = document.querySelector("#scanInvoiceButton");
const invoiceScanStatus = document.querySelector("#invoiceScanStatus");
const createExpenseFromInvoice = document.querySelector(
    "#createExpenseFromInvoice"
);
const invoiceList = document.querySelector("#invoiceList");
const invoiceEmptyState = document.querySelector("#invoiceEmptyState");
const exportInvoicesButton = document.querySelector("#exportInvoicesButton");

const settingsForm = document.querySelector("#settingsForm");
const contributionRateInput = document.querySelector(
    "#contributionRateInput"
);
const taxRateInput = document.querySelector("#taxRateInput");
const resetDataButton = document.querySelector("#resetDataButton");

const exportCsvButton = document.querySelector("#exportCsvButton");
const themeButton = document.querySelector("#themeButton");
const menuButton = document.querySelector("#menuButton");
const sidebar = document.querySelector("#sidebar");
const toast = document.querySelector("#toast");


/* =========================
   État
========================= */

let transactions = loadTransactions();
let settings = loadSettings();
let invoices = loadInvoices();
let toastTimeout;
let editingInvoiceId = "";
let invoiceStorageMode = "local";
let currentComptaUser = null;
let invoiceDatabaseReady = false;
const scannerScriptPromises = new Map();


/* =========================
   Initialisation
========================= */

async function initializeApp() {
    const currentMonth = getTodayISO().slice(0, 7);

    monthFilter.value = currentMonth;
    transactionDate.value = getTodayISO();
    invoiceDate.value = getTodayISO();

    contributionRateInput.value = settings.contributionRate;
    taxRateInput.value = settings.taxRate;

    populateTransactionCategories();
    populateInvoiceCategories();
    populateCategoryFilter();
    initializeTheme();
    refreshInterface();
    await initializeInvoiceDatabase();
}

function loadTransactions() {
    try {
        const storedTransactions = localStorage.getItem(
            STORAGE_KEYS.transactions
        );

        if (!storedTransactions) {
            localStorage.setItem(
                STORAGE_KEYS.transactions,
                JSON.stringify(DEFAULT_TRANSACTIONS)
            );

            return [...DEFAULT_TRANSACTIONS];
        }

        const parsedTransactions = JSON.parse(storedTransactions);

        return Array.isArray(parsedTransactions)
            ? parsedTransactions
            : [];
    } catch (error) {
        console.error("Impossible de lire les opérations :", error);
        return [];
    }
}

function loadSettings() {
    try {
        const storedSettings = localStorage.getItem(STORAGE_KEYS.settings);

        if (!storedSettings) {
            return { ...DEFAULT_SETTINGS };
        }

        return {
            ...DEFAULT_SETTINGS,
            ...JSON.parse(storedSettings)
        };
    } catch (error) {
        console.error("Impossible de lire les réglages :", error);
        return { ...DEFAULT_SETTINGS };
    }
}

function saveTransactions() {
    localStorage.setItem(
        STORAGE_KEYS.transactions,
        JSON.stringify(transactions)
    );
}

function saveSettings() {
    localStorage.setItem(
        STORAGE_KEYS.settings,
        JSON.stringify(settings)
    );
}

function loadInvoices() {
    try {
        const storedInvoices = localStorage.getItem(STORAGE_KEYS.invoices);

        if (!storedInvoices) {
            return [];
        }

        const parsedInvoices = JSON.parse(storedInvoices);

        return Array.isArray(parsedInvoices)
            ? parsedInvoices
            : [];
    } catch (error) {
        console.error("Impossible de lire les factures :", error);
        return [];
    }
}

function saveInvoices() {
    try {
        const invoicesToStore =
            invoiceStorageMode === "database"
                ? invoices.map((invoice) => ({
                    ...invoice,
                    fileData: ""
                }))
                : invoices;

        localStorage.setItem(
            STORAGE_KEYS.invoices,
            JSON.stringify(invoicesToStore)
        );

        return true;
    } catch (error) {
        console.error("Impossible d’enregistrer les factures :", error);
        showToast("Stockage plein : facture non enregistrée.");
        return false;
    }
}

function getSupabaseClient() {
    return window.fwSupabase?.enabled
        ? window.fwSupabase.client
        : null;
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem("fwUser") || "null");
    } catch (error) {
        return null;
    }
}

function getMaxInvoiceFileSize() {
    return invoiceStorageMode === "database"
        ? DATABASE_INVOICE_FILE_SIZE
        : LOCAL_INVOICE_FILE_SIZE;
}

function updateInvoiceStorageHelp() {
    invoiceFileHelp.textContent =
        invoiceStorageMode === "database"
            ? `Les documents jusqu’à ${formatFileSize(DATABASE_INVOICE_FILE_SIZE)} sont stockés en base Supabase.`
            : `Les pièces jusqu’à ${formatFileSize(LOCAL_INVOICE_FILE_SIZE)} sont gardées dans ce navigateur.`;
}

function loadScannerScript(src, globalName) {
    if (window[globalName]) {
        return Promise.resolve();
    }

    if (scannerScriptPromises.has(src)) {
        return scannerScriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src = src;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(
            new Error(`Chargement impossible : ${src}`)
        );

        document.head.append(script);
    }).catch((error) => {
        scannerScriptPromises.delete(src);
        throw error;
    });

    scannerScriptPromises.set(src, promise);

    return promise;
}

async function ensurePdfScanner() {
    if (!window.pdfjsLib) {
        setInvoiceScanStatus("Chargement du lecteur PDF...");
        await loadScannerScript(PDFJS_SCRIPT_URL, "pdfjsLib");
    }

    if (!window.pdfjsLib) {
        throw new Error("Module PDF indisponible.");
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
}

async function ensureOcrScanner() {
    if (!window.Tesseract) {
        setInvoiceScanStatus("Chargement de l’OCR...");
        await loadScannerScript(TESSERACT_SCRIPT_URL, "Tesseract");
    }

    if (!window.Tesseract) {
        throw new Error("Module OCR indisponible.");
    }
}

async function initializeInvoiceDatabase() {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient || !window.fwSupabase) {
        invoiceStorageMode = "local";
        updateInvoiceStorageHelp();
        return;
    }

    try {
        await window.fwSupabase.syncLocalUser();
        currentComptaUser = getStoredUser();

        if (!currentComptaUser?.id) {
            invoiceStorageMode = "local";
            updateInvoiceStorageHelp();
            showToast("Connecte-toi pour stocker les factures en base.");
            return;
        }

        const { data, error } = await supabaseClient
            .from(INVOICE_TABLE)
            .select("*")
            .order("invoice_date", { ascending: false });

        if (error) {
            throw error;
        }

        invoiceStorageMode = "database";
        invoiceDatabaseReady = true;

        const migratedRows = await migrateLocalInvoicesToDatabase(data || []);
        invoices = migratedRows.map(mapInvoiceRow);
        syncTransactionsFromInvoices();
        saveInvoices();
        updateInvoiceStorageHelp();
        refreshInterface();
        showToast("Factures chargées depuis la base.");
    } catch (error) {
        console.warn("Base factures indisponible :", error);
        invoiceStorageMode = "local";
        invoiceDatabaseReady = false;
        updateInvoiceStorageHelp();
    }
}

async function migrateLocalInvoicesToDatabase(remoteRows) {
    const existingIds = new Set((remoteRows || []).map((row) => row.id));
    const localInvoices = loadInvoices().filter(
        (invoice) => invoice.fileData && !existingIds.has(invoice.id)
    );

    if (localInvoices.length === 0) {
        return remoteRows;
    }

    const migratedRows = [...remoteRows];

    for (const localInvoice of localInvoices) {
        try {
            const response = await fetch(localInvoice.fileData);
            const blob = await response.blob();
            const file = new File(
                [blob],
                localInvoice.fileName || "facture",
                { type: localInvoice.fileType || blob.type || "application/octet-stream" }
            );

            const fileUrl = await uploadInvoiceFile(localInvoice.id, file);
            const invoiceForDatabase = {
                ...localInvoice,
                fileData: "",
                fileUrl,
                fileType: file.type,
                fileSize: file.size
            };

            const { data, error } = await getSupabaseClient()
                .from(INVOICE_TABLE)
                .insert(mapInvoiceToRow(invoiceForDatabase))
                .select("*")
                .single();

            if (error) {
                throw error;
            }

            migratedRows.push(data);
        } catch (error) {
            console.warn("Migration facture locale impossible :", error);
        }
    }

    if (migratedRows.length > remoteRows.length) {
        showToast("Factures locales migrées en base.");
    }

    return migratedRows;
}


/* =========================
   Utilitaires
========================= */

function getTodayISO() {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60_000);

    return localDate.toISOString().slice(0, 10);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR"
    }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(`${value}T12:00:00`);

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeText(value) {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function clampPercentage(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatFileSize(size) {
    const bytes = Number(size) || 0;

    if (bytes < 1024) {
        return `${bytes} o`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1).replace(".", ",")} Ko`;
    }

    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener("load", () => {
            resolve(String(reader.result || ""));
        });

        reader.addEventListener("error", () => {
            reject(reader.error || new Error("Lecture du fichier impossible."));
        });

        reader.readAsDataURL(file);
    });
}

function normalizeCompanyForPath(company) {
    return String(company || "")
        .trim()
        .replace(/[\\\/]+/g, "-")
        .replace(/\s+/g, " ")
        .slice(0, 60) || "Entreprise";
}

function safeFileName(name) {
    const rawName = String(name || "").trim();

    if (!rawName) {
        return "facture";
    }

    const parts = rawName.split(".");
    const extension = parts.length > 1 ? parts.pop() : "";
    const baseName = parts.join(".") || "facture";
    const safeBaseName = baseName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 80) || "facture";

    const safeExtension = extension
        ? extension
            .normalize("NFKD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]+/g, "")
            .slice(0, 12)
        : "";

    return safeExtension
        ? `${safeBaseName}.${safeExtension}`
        : safeBaseName;
}

function parseStorageUrl(value) {
    const match = String(value || "").trim().match(/^sb:\/\/([^/]+)\/(.+)$/i);

    if (!match) {
        return null;
    }

    return {
        bucket: match[1],
        path: match[2]
    };
}

function mapInvoiceRow(row) {
    return {
        id: row.id,
        documentType: row.document_type || "facture",
        supplier: row.supplier || "",
        reference: row.reference || "",
        date: row.invoice_date || getTodayISO(),
        amount: Number(row.amount) || 0,
        vatAmount: Number(row.vat_amount) || 0,
        vatRate: Number(row.vat_rate) || 0,
        category: row.category || CATEGORY_OPTIONS.expense[0],
        emailFrom: row.email_from || "",
        emailSubject: row.email_subject || "",
        fileName: row.file_name || "",
        fileType: row.file_type || "",
        fileSize: Number(row.file_size) || 0,
        fileData: "",
        fileUrl: row.file_url || "",
        transactionId: row.transaction_id || "",
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || ""
    };
}

function mapInvoiceToRow(invoice) {
    return {
        id: invoice.id,
        company: currentComptaUser?.company || "Entreprise",
        user_id: currentComptaUser?.id,
        document_type: invoice.documentType || "facture",
        supplier: invoice.supplier || "",
        reference: invoice.reference || "",
        invoice_date: invoice.date || getTodayISO(),
        amount: Number(invoice.amount) || 0,
        vat_amount: Number(invoice.vatAmount) || 0,
        vat_rate: Number(invoice.vatRate) || 0,
        category: invoice.category || "",
        email_from: invoice.emailFrom || "",
        email_subject: invoice.emailSubject || "",
        file_url: invoice.fileUrl || "",
        file_name: invoice.fileName || "",
        file_type: invoice.fileType || "",
        file_size: Number(invoice.fileSize) || 0,
        transaction_id: invoice.transactionId || "",
        updated_at: new Date().toISOString()
    };
}

async function uploadInvoiceFile(invoiceId, file) {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient || !currentComptaUser?.id || !file) {
        return null;
    }

    const company = normalizeCompanyForPath(currentComptaUser.company);
    const path = [
        company,
        "comptaclair",
        "invoices",
        currentComptaUser.id,
        invoiceId,
        safeFileName(file.name)
    ].join("/");

    const uploadResult = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
            upsert: true,
            contentType: file.type || undefined,
            cacheControl: "3600"
        });

    if (uploadResult.error) {
        throw uploadResult.error;
    }

    return `sb://${STORAGE_BUCKET}/${path}`;
}

async function removeInvoiceFile(fileUrl) {
    const supabaseClient = getSupabaseClient();
    const storageUrl = parseStorageUrl(fileUrl);

    if (!supabaseClient || !storageUrl) {
        return;
    }

    const removeResult = await supabaseClient
        .storage
        .from(storageUrl.bucket)
        .remove([storageUrl.path]);

    if (removeResult.error) {
        console.warn("Suppression fichier facture impossible :", removeResult.error);
    }
}

async function getInvoiceBlob(invoice) {
    if (invoice.fileData) {
        const response = await fetch(invoice.fileData);
        return response.blob();
    }

    const supabaseClient = getSupabaseClient();
    const storageUrl = parseStorageUrl(invoice.fileUrl);

    if (!supabaseClient || !storageUrl) {
        throw new Error("Document introuvable.");
    }

    const downloadResult = await supabaseClient
        .storage
        .from(storageUrl.bucket)
        .download(storageUrl.path);

    if (downloadResult.error) {
        throw downloadResult.error;
    }

    return downloadResult.data;
}

async function openInvoiceDocument(invoiceId, shouldDownload = false) {
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
        return;
    }

    try {
        const blob = await getInvoiceBlob(invoice);
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = blobUrl;

        if (shouldDownload) {
            link.download = invoice.fileName || "facture";
        } else {
            link.target = "_blank";
            link.rel = "noreferrer";
        }

        document.body.append(link);
        link.click();
        link.remove();

        window.setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 60_000);
    } catch (error) {
        console.error("Ouverture facture impossible :", error);
        showToast("Impossible d’ouvrir ce document.");
    }
}

function setInvoiceScanStatus(message) {
    invoiceScanStatus.textContent = message;
}

function parseFrenchNumber(value) {
    const rawValue = String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/[^\d,.\s-]/g, "")
        .trim();

    if (!rawValue) {
        return null;
    }

    let normalizedValue = rawValue.replace(/\s+/g, "");
    const commaIndex = normalizedValue.lastIndexOf(",");
    const dotIndex = normalizedValue.lastIndexOf(".");

    if (commaIndex > -1 && dotIndex > -1) {
        const decimalSeparator = commaIndex > dotIndex ? "," : ".";
        const thousandsSeparator = decimalSeparator === "," ? "." : ",";

        normalizedValue = normalizedValue
            .replaceAll(thousandsSeparator, "")
            .replace(decimalSeparator, ".");
    } else if (commaIndex > -1) {
        normalizedValue = normalizedValue.replace(",", ".");
    }

    const parsedValue = Number(normalizedValue);

    return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatNumberForInput(value) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue)
        ? numberValue.toFixed(2)
        : "";
}

function toISODate(value) {
    const rawValue = String(value || "").trim();

    if (!rawValue) {
        return "";
    }

    const isoMatch = rawValue.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);

    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const frenchMatch = rawValue.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);

    if (!frenchMatch) {
        return "";
    }

    const [, day, month, yearPart] = frenchMatch;
    const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanExtractedText(text) {
    return String(text || "")
        .replace(/\u0000/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function getLikelySupplier(text) {
    const excludedPatterns = [
        /facture/i,
        /devis/i,
        /avoir/i,
        /invoice/i,
        /date/i,
        /total/i,
        /montant/i,
        /tva/i,
        /siret/i,
        /siren/i,
        /client/i,
        /référence|reference/i,
        /n[°o]\s*\d/i
    ];

    const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 3 && line.length <= 80);

    return lines.find((line) =>
        /[a-zà-ÿ]{3,}/i.test(line) &&
        !excludedPatterns.some((pattern) => pattern.test(line))
    ) || "";
}

function getFirstAmountMatch(text, patterns) {
    for (const pattern of patterns) {
        const match = text.match(pattern);

        if (!match) {
            continue;
        }

        const parsedAmount = parseFrenchNumber(match[1]);

        if (parsedAmount !== null) {
            return parsedAmount;
        }
    }

    return null;
}

function getLargestEuroAmount(text) {
    const amountPattern =
        /([0-9]{1,3}(?:[\s.][0-9]{3})*(?:[,.][0-9]{2})|[0-9]+(?:[,.][0-9]{2}))\s*(?:€|eur|euros)/gi;

    const amounts = [...String(text || "").matchAll(amountPattern)]
        .map((match) => parseFrenchNumber(match[1]))
        .filter((amount) => amount !== null);

    return amounts.length ? Math.max(...amounts) : null;
}

function extractInvoiceFields(text, fileName = "") {
    const cleanedText = cleanExtractedText(text);
    const searchableText = cleanedText.replace(/\s+/g, " ");
    const amountGroup =
        "([0-9]{1,3}(?:[\\s.][0-9]{3})*(?:[,.][0-9]{2})|[0-9]+(?:[,.][0-9]{2}))";

    const lowerText = searchableText.toLowerCase();
    const documentType =
        /\bavoir\b/.test(lowerText)
            ? "avoir"
            : /\bdevis\b|quotation|quote/.test(lowerText)
                ? "devis"
                : /\bfacture\b|invoice/.test(lowerText)
                    ? "facture"
                    : "autre";

    const referenceMatch = searchableText.match(
        /\b(?:facture|devis|avoir|invoice|quote)\s*(?:n[°oº]?|num[eé]ro|no|#|ref(?:erence|érence)?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i
    ) || searchableText.match(
        /\b(?:n[°oº]?|num[eé]ro|ref(?:erence|érence))\s*[:\-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i
    );

    const dateMatch = searchableText.match(
        /\b(?:date(?:\s+(?:de\s+)?(?:facture|devis|document))?)\D{0,30}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})/i
    ) || searchableText.match(
        /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/
    );

    const totalAmount = getFirstAmountMatch(searchableText, [
        new RegExp(`(?:net\\s*(?:à|a)\\s*payer|total\\s*(?:ttc|t\\.t\\.c\\.?|(?:à|a)\\s*payer)|montant\\s*(?:ttc|du)|(?:à|a)\\s*payer)[^0-9]{0,70}${amountGroup}`, "i"),
        new RegExp(`(?:total)[^0-9]{0,70}${amountGroup}\\s*(?:€|eur|euros)`, "i")
    ]) ?? getLargestEuroAmount(searchableText);

    const vatRateMatch = searchableText.match(
        /\btva\s*(?:\(?\s*)?([0-9]{1,2}(?:[,.][0-9]{1,2})?)\s*%/i
    );

    const vatAmount = getFirstAmountMatch(searchableText, [
        new RegExp(`(?:total\\s*)?tva\\s*(?:[0-9]{1,2}(?:[,.][0-9]{1,2})?\\s*%)?[^0-9]{0,70}${amountGroup}\\s*(?:€|eur|euros)?`, "i")
    ]);

    return {
        documentType,
        reference: referenceMatch ? referenceMatch[1].trim() : "",
        supplier: getLikelySupplier(cleanedText) || fileName.replace(/\.[^.]+$/, ""),
        date: dateMatch ? toISODate(dateMatch[1]) : "",
        amount: totalAmount,
        vatAmount,
        vatRate: vatRateMatch ? parseFrenchNumber(vatRateMatch[1]) : null
    };
}

async function extractPdfText(file) {
    await ensurePdfScanner();

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pdfDocument = await window.pdfjsLib
        .getDocument({ data: pdfBytes })
        .promise;

    const pageLimit = Math.min(pdfDocument.numPages, 3);
    const textParts = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        setInvoiceScanStatus(`Lecture du PDF : page ${pageNumber}/${pageLimit}...`);

        const page = await pdfDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item) => item.str)
            .join("\n");

        textParts.push(pageText);
    }

    const text = cleanExtractedText(textParts.join("\n"));

    return text.length > 40
        ? text
        : ocrPdfPages(pdfDocument, pageLimit);
}

async function ocrPdfPages(pdfDocument, pageLimit) {
    await ensureOcrScanner();

    const textParts = [];
    const canvas = document.createElement("canvas");
    const canvasContext = canvas.getContext("2d");

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        setInvoiceScanStatus(`OCR du PDF scanné : page ${pageNumber}/${pageLimit}...`);

        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.7 });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({
            canvasContext,
            viewport
        }).promise;

        const result = await window.Tesseract.recognize(
            canvas,
            "fra+eng",
            {
                logger(event) {
                    if (event.status === "recognizing text") {
                        const progress = Math.round((event.progress || 0) * 100);
                        setInvoiceScanStatus(`OCR du PDF scanné : ${progress} %`);
                    }
                }
            }
        );

        textParts.push(result.data.text || "");
    }

    return cleanExtractedText(textParts.join("\n"));
}

async function extractImageText(file) {
    await ensureOcrScanner();

    const result = await window.Tesseract.recognize(
        file,
        "fra+eng",
        {
            logger(event) {
                if (event.status === "recognizing text") {
                    const progress = Math.round((event.progress || 0) * 100);
                    setInvoiceScanStatus(`OCR de l’image : ${progress} %`);
                }
            }
        }
    );

    return cleanExtractedText(result.data.text || "");
}

function applyInvoiceScanResult(result) {
    let filledFields = 0;

    if (result.documentType) {
        invoiceDocumentType.value = result.documentType;
        filledFields += 1;
    }

    if (result.reference) {
        invoiceReference.value = result.reference;
        filledFields += 1;
    }

    if (result.supplier) {
        invoiceSupplier.value = result.supplier;
        filledFields += 1;
    }

    if (result.date) {
        invoiceDate.value = result.date;
        filledFields += 1;
    }

    if (result.amount !== null && result.amount !== undefined) {
        invoiceAmount.value = formatNumberForInput(result.amount);
        filledFields += 1;
    }

    if (result.vatAmount !== null && result.vatAmount !== undefined) {
        invoiceVatAmount.value = formatNumberForInput(result.vatAmount);
        filledFields += 1;
    }

    if (result.vatRate !== null && result.vatRate !== undefined) {
        invoiceVatRate.value = String(result.vatRate);
        filledFields += 1;
    }

    return filledFields;
}

async function scanSelectedInvoice() {
    const selectedFile = invoiceFile.files[0];

    if (!selectedFile) {
        showToast("Ajoute d’abord un PDF ou une image.");
        return;
    }

    scanInvoiceButton.disabled = true;
    setInvoiceScanStatus("Analyse du fichier...");

    try {
        const isPdf =
            selectedFile.type === "application/pdf" ||
            selectedFile.name.toLowerCase().endsWith(".pdf");

        const extractedText = isPdf
            ? await extractPdfText(selectedFile)
            : await extractImageText(selectedFile);

        if (!extractedText) {
            setInvoiceScanStatus("Aucun texte détecté. Renseigne les champs manuellement.");
            showToast("Aucun texte détecté.");
            return;
        }

        const detectedFields = extractInvoiceFields(
            extractedText,
            selectedFile.name
        );

        const filledFields = applyInvoiceScanResult(detectedFields);

        setInvoiceScanStatus(
            `${filledFields} champ${filledFields > 1 ? "s" : ""} rempli${filledFields > 1 ? "s" : ""} automatiquement.`
        );

        showToast("Scan terminé.");
    } catch (error) {
        console.error("Scan facture impossible :", error);
        setInvoiceScanStatus("Scan impossible. Tu peux saisir la facture manuellement.");
        showToast("Scan impossible pour ce fichier.");
    } finally {
        scanInvoiceButton.disabled = false;
    }
}


/* =========================
   Calculs du tableau de bord
========================= */

function getSelectedMonthTransactions() {
    const selectedMonth = monthFilter.value;

    if (!selectedMonth) {
        return transactions;
    }

    return transactions.filter((transaction) =>
        transaction.date.startsWith(selectedMonth)
    );
}

function calculateSummary() {
    const monthTransactions = getSelectedMonthTransactions();

    const incomeTransactions = monthTransactions.filter(
        (transaction) => transaction.type === "income"
    );

    const expenseTransactions = monthTransactions.filter(
        (transaction) => transaction.type === "expense"
    );

    const income = incomeTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0
    );

    const expenses = expenseTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount),
        0
    );

    const contributions = income * (settings.contributionRate / 100);
    const taxes = income * (settings.taxRate / 100);

    const available = Math.max(
        0,
        income - expenses - contributions - taxes
    );

    return {
        income,
        expenses,
        contributions,
        taxes,
        available,
        incomeCount: incomeTransactions.length,
        expenseCount: expenseTransactions.length
    };
}

function renderDashboard() {
    const summary = calculateSummary();

    incomeAmount.textContent = formatCurrency(summary.income);
    expenseAmount.textContent = formatCurrency(summary.expenses);
    contributionAmount.textContent = formatCurrency(summary.contributions);
    availableAmount.textContent = formatCurrency(summary.available);

    incomeCount.textContent =
        `${summary.incomeCount} recette${summary.incomeCount > 1 ? "s" : ""}`;

    expenseCount.textContent =
        `${summary.expenseCount} dépense${summary.expenseCount > 1 ? "s" : ""}`;

    contributionRateText.textContent =
        `Taux estimatif : ${settings.contributionRate.toLocaleString("fr-FR")} %`;

    reserveContribution.textContent = formatCurrency(
        summary.contributions
    );

    reserveTax.textContent = formatCurrency(summary.taxes);

    reserveTotal.textContent = formatCurrency(
        summary.contributions + summary.taxes
    );

    const base = summary.income > 0 ? summary.income : 1;

    const expenseShare = clampPercentage(
        (summary.expenses / base) * 100
    );

    const contributionShare = clampPercentage(
        (summary.contributions / base) * 100
    );

    const taxShare = clampPercentage(
        (summary.taxes / base) * 100
    );

    const availableShare = clampPercentage(
        (summary.available / base) * 100
    );

    updateProgress(
        expenseProgress,
        expenseShareText,
        expenseShare
    );

    updateProgress(
        contributionProgress,
        contributionShareText,
        contributionShare
    );

    updateProgress(
        taxProgress,
        taxShareText,
        taxShare
    );

    updateProgress(
        availableProgress,
        availableShareText,
        availableShare
    );
}

function updateProgress(progressElement, textElement, value) {
    const roundedValue = Math.round(value);

    progressElement.style.width = `${roundedValue}%`;
    textElement.textContent = `${roundedValue} %`;
}


/* =========================
   Tableau des opérations
========================= */

function getFilteredTransactions() {
    const searchValue = normalizeText(searchInput.value);
    const selectedType = typeFilter.value;
    const selectedCategory = categoryFilter.value;

    return [...transactions]
        .filter((transaction) => {
            const searchableText = normalizeText([
                transaction.description,
                transaction.category,
                transaction.note
            ].join(" "));

            const matchesSearch =
                searchValue === "" ||
                searchableText.includes(searchValue);

            const matchesType =
                selectedType === "all" ||
                transaction.type === selectedType;

            const matchesCategory =
                selectedCategory === "all" ||
                transaction.category === selectedCategory;

            return matchesSearch && matchesType && matchesCategory;
        })
        .sort((firstTransaction, secondTransaction) =>
            secondTransaction.date.localeCompare(firstTransaction.date)
        );
}

function renderTransactions() {
    const filteredTransactions = getFilteredTransactions();

    transactionsTableBody.innerHTML = "";

    emptyState.classList.toggle(
        "hidden",
        filteredTransactions.length > 0
    );

    filteredTransactions.forEach((transaction) => {
        const row = document.createElement("tr");

        const typeLabel =
            transaction.type === "income"
                ? "Recette"
                : "Dépense";

        const amountPrefix =
            transaction.type === "income"
                ? "+"
                : "−";

        row.innerHTML = `
            <td>${escapeHTML(formatDate(transaction.date))}</td>

            <td
                class="transaction-description"
                title="${escapeHTML(transaction.note || transaction.description)}"
            >
                ${escapeHTML(transaction.description)}
            </td>

            <td>${escapeHTML(transaction.category)}</td>

            <td>
                <span
                    class="type-badge ${
                        transaction.type === "income"
                            ? "type-income"
                            : "type-expense"
                    }"
                >
                    ${typeLabel}
                </span>
            </td>

            <td
                class="${
                    transaction.type === "income"
                        ? "amount-income"
                        : "amount-expense"
                }"
            >
                ${amountPrefix}${formatCurrency(transaction.amount)}
            </td>

            <td class="actions-column">
                <button
                    class="delete-button"
                    type="button"
                    aria-label="Supprimer ${escapeHTML(transaction.description)}"
                    data-delete-id="${escapeHTML(transaction.id)}"
                    title="Supprimer"
                >
                    🗑
                </button>
            </td>
        `;

        transactionsTableBody.append(row);
    });

    document
        .querySelectorAll("[data-delete-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                deleteTransaction(button.dataset.deleteId);
            });
        });
}

/* =========================
   Factures reçues par email
========================= */

function populateInvoiceCategories() {
    invoiceCategory.innerHTML = "";

    CATEGORY_OPTIONS.expense.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        invoiceCategory.append(option);
    });
}

function renderInvoices() {
    invoiceList.innerHTML = "";

    const sortedInvoices = [...invoices].sort((firstInvoice, secondInvoice) =>
        secondInvoice.date.localeCompare(firstInvoice.date)
    );

    invoiceEmptyState.classList.toggle(
        "hidden",
        sortedInvoices.length > 0
    );

    sortedInvoices.forEach((invoice) => {
        const item = document.createElement("article");
        item.className = "invoice-item";

        const emailDetails = [
            invoice.emailFrom,
            invoice.emailSubject
        ].filter(Boolean).join(" • ");

        item.innerHTML = `
            <div class="invoice-item-main">
                <div class="invoice-item-top">
                    <strong>${escapeHTML(invoice.supplier)}</strong>
                    <span>${escapeHTML(formatCurrency(invoice.amount))}</span>
                </div>

                <div class="invoice-meta">
                    <span>${escapeHTML(invoice.documentType || "facture")}</span>
                    ${
                        invoice.reference
                            ? `<span>${escapeHTML(invoice.reference)}</span>`
                            : ""
                    }
                    <span>${escapeHTML(formatDate(invoice.date))}</span>
                    <span>${escapeHTML(invoice.category)}</span>
                    ${
                        Number(invoice.vatAmount) > 0
                            ? `<span>TVA ${escapeHTML(formatCurrency(invoice.vatAmount))}</span>`
                            : ""
                    }
                    <span>${escapeHTML(invoice.fileName || "Sans fichier")}</span>
                </div>

                ${
                    emailDetails
                        ? `<p>${escapeHTML(emailDetails)}</p>`
                        : ""
                }
            </div>

            <div class="invoice-actions">
                ${
                    invoice.fileData || invoice.fileUrl
                        ? `<button
                            class="secondary-button invoice-file-button"
                            type="button"
                            data-open-invoice-id="${escapeHTML(invoice.id)}"
                        >
                            Voir
                        </button>

                        <button
                            class="secondary-button invoice-file-button"
                            type="button"
                            data-download-invoice-id="${escapeHTML(invoice.id)}"
                        >
                            Télécharger
                        </button>`
                        : ""
                }

                <button
                    class="secondary-button invoice-file-button"
                    type="button"
                    data-edit-invoice-id="${escapeHTML(invoice.id)}"
                >
                    Modifier
                </button>

                <button
                    class="delete-button"
                    type="button"
                    aria-label="Supprimer la facture ${escapeHTML(invoice.supplier)}"
                    data-delete-invoice-id="${escapeHTML(invoice.id)}"
                    title="Supprimer"
                >
                    🗑
                </button>
            </div>
        `;

        invoiceList.append(item);
    });

    document
        .querySelectorAll("[data-open-invoice-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                openInvoiceDocument(button.dataset.openInvoiceId, false);
            });
        });

    document
        .querySelectorAll("[data-download-invoice-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                openInvoiceDocument(button.dataset.downloadInvoiceId, true);
            });
        });

    document
        .querySelectorAll("[data-edit-invoice-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                editInvoice(button.dataset.editInvoiceId);
            });
        });

    document
        .querySelectorAll("[data-delete-invoice-id]")
        .forEach((button) => {
            button.addEventListener("click", () => {
                deleteInvoice(button.dataset.deleteInvoiceId);
            });
        });
}

function getDocumentTypeLabel(documentType) {
    const labels = {
        facture: "Facture",
        devis: "Devis",
        avoir: "Avoir",
        autre: "Document"
    };

    return labels[documentType] || labels.autre;
}

function getInvoiceTransactionPayload(invoice) {
    return {
        id: invoice.transactionId,
        type: "expense",
        date: invoice.date,
        description: `${getDocumentTypeLabel(invoice.documentType)} ${invoice.supplier}`,
        category: invoice.category,
        amount: invoice.amount,
        note: [
            "Document importé depuis email",
            invoice.reference
                ? `Référence : ${invoice.reference}`
                : "",
            invoice.vatAmount
                ? `TVA : ${formatCurrency(invoice.vatAmount)}`
                : "",
            invoice.emailFrom
                ? `Expéditeur : ${invoice.emailFrom}`
                : "",
            invoice.emailSubject
                ? `Objet : ${invoice.emailSubject}`
                : "",
            invoice.fileName
                ? `Fichier : ${invoice.fileName}`
                : ""
        ].filter(Boolean).join(" | ")
    };
}

function syncInvoiceTransaction(invoice, previousTransactionId = "") {
    if (previousTransactionId && previousTransactionId !== invoice.transactionId) {
        transactions = transactions.filter(
            (transaction) => transaction.id !== previousTransactionId
        );
    }

    if (!invoice.transactionId) {
        return;
    }

    const linkedTransaction = getInvoiceTransactionPayload(invoice);
    const transactionIndex = transactions.findIndex(
        (transaction) => transaction.id === invoice.transactionId
    );

    if (transactionIndex >= 0) {
        transactions[transactionIndex] = {
            ...transactions[transactionIndex],
            ...linkedTransaction
        };
    } else {
        transactions.push(linkedTransaction);
    }
}

function syncTransactionsFromInvoices() {
    let changed = false;

    invoices
        .filter((invoice) => invoice.transactionId)
        .forEach((invoice) => {
            const transactionIndex = transactions.findIndex(
                (transaction) => transaction.id === invoice.transactionId
            );

            if (transactionIndex >= 0) {
                return;
            }

            transactions.push(getInvoiceTransactionPayload(invoice));
            changed = true;
        });

    if (changed) {
        saveTransactions();
        populateCategoryFilter();
    }
}

async function saveInvoiceToDatabase(invoice, existingInvoice, previousFileUrl = "") {
    const supabaseClient = getSupabaseClient();

    if (!supabaseClient || !invoiceDatabaseReady) {
        throw new Error("Base factures indisponible.");
    }

    const row = mapInvoiceToRow(invoice);
    const query = existingInvoice
        ? supabaseClient
            .from(INVOICE_TABLE)
            .update(row)
            .eq("id", invoice.id)
        : supabaseClient
            .from(INVOICE_TABLE)
            .insert(row);

    const { data, error } = await query
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    if (
        previousFileUrl &&
        previousFileUrl !== invoice.fileUrl
    ) {
        await removeInvoiceFile(previousFileUrl);
    }

    return mapInvoiceRow(data);
}

function resetInvoiceForm() {
    editingInvoiceId = "";
    invoiceForm.reset();
    invoiceDocumentType.value = "facture";
    invoiceDate.value = getTodayISO();
    createExpenseFromInvoice.checked = true;
    invoiceFormTitle.textContent = "Enregistrer une pièce jointe";
    invoiceSubmitButton.textContent = "Enregistrer la facture";
    updateInvoiceStorageHelp();
    cancelInvoiceEditButton.classList.add("hidden");
    setInvoiceScanStatus("Ajoute un PDF ou une image, puis lance le scan.");
}

function editInvoice(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
        return;
    }

    editingInvoiceId = invoice.id;
    invoiceDocumentType.value = invoice.documentType || "facture";
    invoiceSupplier.value = invoice.supplier || "";
    invoiceReference.value = invoice.reference || "";
    invoiceDate.value = invoice.date || getTodayISO();
    invoiceAmount.value = formatNumberForInput(invoice.amount);
    invoiceVatAmount.value = invoice.vatAmount
        ? formatNumberForInput(invoice.vatAmount)
        : "";
    invoiceVatRate.value = invoice.vatRate || "";
    invoiceCategory.value = invoice.category || CATEGORY_OPTIONS.expense[0];
    invoiceEmailFrom.value = invoice.emailFrom || "";
    invoiceEmailSubject.value = invoice.emailSubject || "";
    createExpenseFromInvoice.checked = Boolean(invoice.transactionId);
    invoiceFile.value = "";

    invoiceFormTitle.textContent = "Modifier une facture";
    invoiceSubmitButton.textContent = "Enregistrer les modifications";
    invoiceFileHelp.textContent =
        invoice.fileName
            ? `Document actuel : ${invoice.fileName}. Ajoute un fichier seulement pour le remplacer.`
            : "Ajoute un fichier si tu veux joindre un document.";
    cancelInvoiceEditButton.classList.remove("hidden");
    setInvoiceScanStatus("Tu peux modifier les champs ou remplacer le document.");

    invoiceForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

async function handleInvoiceSubmit(event) {
    event.preventDefault();

    const amount = Number(invoiceAmount.value);
    const selectedFile = invoiceFile.files[0];
    const existingInvoice = editingInvoiceId
        ? invoices.find((item) => item.id === editingInvoiceId)
        : null;

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Le montant de la facture doit être supérieur à zéro.");
        return;
    }

    if (!selectedFile && !existingInvoice?.fileData && !existingInvoice?.fileUrl) {
        showToast("Ajoute la facture PDF ou image.");
        return;
    }

    if (selectedFile && selectedFile.size > getMaxInvoiceFileSize()) {
        showToast(`Fichier trop lourd : maximum ${formatFileSize(getMaxInvoiceFileSize())}.`);
        return;
    }

    const invoiceId = existingInvoice?.id || createId();
    const previousFileUrl = existingInvoice?.fileUrl || "";
    let fileData = existingInvoice?.fileData || "";
    let fileUrl = existingInvoice?.fileUrl || "";
    let fileName = existingInvoice?.fileName || "";
    let fileType = existingInvoice?.fileType || "";
    let fileSize = existingInvoice?.fileSize || 0;

    if (selectedFile) {
        try {
            if (invoiceStorageMode === "database" && invoiceDatabaseReady) {
                showToast("Upload du document...");
                fileUrl = await uploadInvoiceFile(invoiceId, selectedFile);
                fileData = "";
            } else {
                fileData = await readFileAsDataUrl(selectedFile);
                fileUrl = "";
            }

            fileName = selectedFile.name;
            fileType = selectedFile.type;
            fileSize = selectedFile.size;
        } catch (error) {
            console.error("Lecture facture impossible :", error);
            showToast("Impossible de lire cette facture.");
            return;
        }
    }

    const previousTransactionId = existingInvoice?.transactionId || "";
    const linkedTransactionId =
        createExpenseFromInvoice.checked
            ? previousTransactionId || createId()
            : "";

    const savedInvoice = {
        id: invoiceId,
        documentType: invoiceDocumentType.value,
        supplier: invoiceSupplier.value.trim(),
        reference: invoiceReference.value.trim(),
        date: invoiceDate.value,
        amount,
        vatAmount: Number(invoiceVatAmount.value) || 0,
        vatRate: Number(invoiceVatRate.value) || 0,
        category: invoiceCategory.value,
        emailFrom: invoiceEmailFrom.value.trim(),
        emailSubject: invoiceEmailSubject.value.trim(),
        fileName,
        fileType,
        fileSize,
        fileData,
        fileUrl,
        transactionId: linkedTransactionId,
        createdAt: existingInvoice?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const previousInvoices = [...invoices];
    let finalInvoice = savedInvoice;

    if (invoiceStorageMode === "database" && invoiceDatabaseReady) {
        try {
            finalInvoice = await saveInvoiceToDatabase(
                savedInvoice,
                existingInvoice,
                previousFileUrl
            );
        } catch (error) {
            console.error("Enregistrement base facture impossible :", error);

            if (selectedFile && savedInvoice.fileUrl && savedInvoice.fileUrl !== previousFileUrl) {
                await removeInvoiceFile(savedInvoice.fileUrl);
            }

            showToast("Base indisponible : facture non enregistrée.");
            return;
        }
    }

    if (existingInvoice) {
        invoices = invoices.map((invoice) =>
            invoice.id === existingInvoice.id
                ? finalInvoice
                : invoice
        );
    } else {
        invoices.push(finalInvoice);
    }

    if (!saveInvoices()) {
        invoices = previousInvoices;
        return;
    }

    syncInvoiceTransaction(finalInvoice, previousTransactionId);
    saveTransactions();
    populateCategoryFilter();
    resetInvoiceForm();
    refreshInterface();
    showToast(existingInvoice ? "Facture modifiée." : "Facture enregistrée.");
}

async function deleteInvoice(invoiceId) {
    const invoice = invoices.find((item) => item.id === invoiceId);

    if (!invoice) {
        return;
    }

    const confirmed = window.confirm(
        `Supprimer la facture « ${invoice.supplier} » ?`
    );

    if (!confirmed) {
        return;
    }

    invoices = invoices.filter((item) => item.id !== invoiceId);

    if (invoiceStorageMode === "database" && invoiceDatabaseReady) {
        const supabaseClient = getSupabaseClient();

        if (supabaseClient) {
            const { error } = await supabaseClient
                .from(INVOICE_TABLE)
                .delete()
                .eq("id", invoice.id);

            if (error) {
                console.error("Suppression base facture impossible :", error);
                showToast("Suppression en base impossible.");
                invoices.push(invoice);
                refreshInterface();
                return;
            }

            await removeInvoiceFile(invoice.fileUrl);
        }
    }

    if (invoice.transactionId) {
        transactions = transactions.filter(
            (transaction) => transaction.id !== invoice.transactionId
        );
        saveTransactions();
        populateCategoryFilter();
    }

    saveInvoices();
    refreshInterface();
    showToast("Facture supprimée.");
}

function exportInvoicesToCsv() {
    if (invoices.length === 0) {
        showToast("Aucune facture à exporter.");
        return;
    }

    const headers = [
        "Date",
        "Type",
        "Référence",
        "Fournisseur",
        "Catégorie",
        "Montant",
        "TVA",
        "Taux TVA",
        "Email expéditeur",
        "Objet du mail",
        "Fichier"
    ];

    const rows = invoices.map((invoice) => [
        invoice.date,
        invoice.documentType || "facture",
        invoice.reference || "",
        invoice.supplier,
        invoice.category,
        Number(invoice.amount).toFixed(2),
        Number(invoice.vatAmount || 0).toFixed(2),
        invoice.vatRate || "",
        invoice.emailFrom || "",
        invoice.emailSubject || "",
        invoice.fileName || ""
    ]);

    const csvContent = [headers, ...rows]
        .map((row) =>
            row
                .map((value) =>
                    `"${String(value).replaceAll('"', '""')}"`
                )
                .join(";")
        )
        .join("\n");

    const blob = new Blob(
        ["\uFEFF", csvContent],
        { type: "text/csv;charset=utf-8" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `comptaclair-factures-${getTodayISO()}.csv`;

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
    showToast("Export factures créé.");
}

function deleteTransaction(transactionId) {
    const transaction = transactions.find(
        (item) => item.id === transactionId
    );

    if (!transaction) {
        return;
    }

    const confirmed = window.confirm(
        `Supprimer l’opération « ${transaction.description} » ?`
    );

    if (!confirmed) {
        return;
    }

    transactions = transactions.filter(
        (item) => item.id !== transactionId
    );

    saveTransactions();
    populateCategoryFilter();
    refreshInterface();
    showToast("Opération supprimée.");
}


/* =========================
   Ajout d'une opération
========================= */

function populateTransactionCategories() {
    const selectedType = transactionType.value;
    const options = CATEGORY_OPTIONS[selectedType] || [];

    transactionCategory.innerHTML = "";

    options.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        transactionCategory.append(option);
    });
}

function populateCategoryFilter() {
    const categories = [
        ...new Set(
            transactions
                .map((transaction) => transaction.category)
                .filter(Boolean)
        )
    ].sort((firstCategory, secondCategory) =>
        firstCategory.localeCompare(secondCategory, "fr")
    );

    const previousValue = categoryFilter.value;

    categoryFilter.innerHTML =
        '<option value="all">Toutes les catégories</option>';

    categories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.append(option);
    });

    categoryFilter.value =
        categories.includes(previousValue)
            ? previousValue
            : "all";
}

function openTransactionModal() {
    transactionModal.classList.remove("hidden");
    document.body.classList.add("modal-open");

    transactionDate.value = transactionDate.value || getTodayISO();

    window.setTimeout(() => {
        transactionDescription.focus();
    }, 50);
}

function closeTransactionModal() {
    transactionModal.classList.add("hidden");
    document.body.classList.remove("modal-open");

    transactionForm.reset();
    transactionType.value = "income";
    transactionDate.value = getTodayISO();
    populateTransactionCategories();
}

function handleTransactionSubmit(event) {
    event.preventDefault();

    const amount = Number(transactionAmount.value);

    if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Le montant doit être supérieur à zéro.");
        return;
    }

    const newTransaction = {
        id: createId(),
        type: transactionType.value,
        date: transactionDate.value,
        description: transactionDescription.value.trim(),
        category: transactionCategory.value,
        amount,
        note: transactionNote.value.trim()
    };

    transactions.push(newTransaction);

    saveTransactions();
    populateCategoryFilter();
    refreshInterface();
    closeTransactionModal();
    showToast("Opération enregistrée.");
}


/* =========================
   Réglages
========================= */

function handleSettingsSubmit(event) {
    event.preventDefault();

    const contributionRate = Number(
        contributionRateInput.value
    );

    const taxRate = Number(taxRateInput.value);

    if (
        !Number.isFinite(contributionRate) ||
        contributionRate < 0 ||
        contributionRate > 100 ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
    ) {
        showToast("Les taux doivent être compris entre 0 et 100.");
        return;
    }

    settings = {
        contributionRate,
        taxRate
    };

    saveSettings();
    renderDashboard();
    showToast("Réglages enregistrés.");
}

async function resetAllData() {
    const confirmed = window.confirm(
        "Effacer toutes les opérations et réinitialiser les réglages ?"
    );

    if (!confirmed) {
        return;
    }

    if (invoiceStorageMode === "database" && invoiceDatabaseReady) {
        const supabaseClient = getSupabaseClient();

        if (supabaseClient && invoices.length > 0) {
            const { error } = await supabaseClient
                .from(INVOICE_TABLE)
                .delete()
                .in("id", invoices.map((invoice) => invoice.id));

            if (error) {
                console.error("Suppression factures base impossible :", error);
                showToast("Impossible d’effacer les factures en base.");
                return;
            }

            await Promise.all(
                invoices
                    .map((invoice) => invoice.fileUrl)
                    .filter(Boolean)
                    .map((fileUrl) => removeInvoiceFile(fileUrl))
            );
        }
    }

    transactions = [];
    invoices = [];
    settings = { ...DEFAULT_SETTINGS };

    saveTransactions();
    saveInvoices();
    saveSettings();

    contributionRateInput.value = settings.contributionRate;
    taxRateInput.value = settings.taxRate;
    resetInvoiceForm();

    populateCategoryFilter();
    refreshInterface();
    showToast("Toutes les données ont été effacées.");
}


/* =========================
   Export CSV
========================= */

function exportTransactionsToCsv() {
    if (transactions.length === 0) {
        showToast("Aucune opération à exporter.");
        return;
    }

    const headers = [
        "Date",
        "Type",
        "Description",
        "Catégorie",
        "Montant",
        "Note"
    ];

    const rows = transactions.map((transaction) => [
        transaction.date,
        transaction.type === "income" ? "Recette" : "Dépense",
        transaction.description,
        transaction.category,
        Number(transaction.amount).toFixed(2),
        transaction.note || ""
    ]);

    const csvContent = [headers, ...rows]
        .map((row) =>
            row
                .map((value) =>
                    `"${String(value).replaceAll('"', '""')}"`
                )
                .join(";")
        )
        .join("\n");

    const blob = new Blob(
        ["\uFEFF", csvContent],
        { type: "text/csv;charset=utf-8" }
    );

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `comptaclair-export-${getTodayISO()}.csv`;

    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
    showToast("Export CSV créé.");
}


/* =========================
   Thème et navigation mobile
========================= */

function initializeTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);

    if (savedTheme === "dark") {
        document.body.classList.add("dark-theme");
    }

    updateThemeButton();
}

function toggleTheme() {
    document.body.classList.toggle("dark-theme");

    const selectedTheme =
        document.body.classList.contains("dark-theme")
            ? "dark"
            : "light";

    localStorage.setItem(STORAGE_KEYS.theme, selectedTheme);
    updateThemeButton();
}

function updateThemeButton() {
    const darkMode =
        document.body.classList.contains("dark-theme");

    themeButton.textContent = darkMode ? "☾" : "☀";
    themeButton.setAttribute(
        "aria-label",
        darkMode
            ? "Activer le thème clair"
            : "Activer le thème sombre"
    );
}

function toggleSidebar() {
    const isOpen = sidebar.classList.toggle("open");

    menuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
    );
}

function closeSidebarOnNavigation() {
    sidebar.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
}

function updateActiveNavigation() {
    const currentHash = window.location.hash || "#dashboard";

    document
        .querySelectorAll(".nav-link[href^='#']")
        .forEach((link) => {
            link.classList.toggle(
                "active",
                link.getAttribute("href") === currentHash
            );
        });
}


/* =========================
   Interface générale
========================= */

function refreshInterface() {
    renderDashboard();
    renderTransactions();
    renderInvoices();
}

function showToast(message) {
    window.clearTimeout(toastTimeout);

    toast.textContent = message;
    toast.classList.remove("hidden");

    toastTimeout = window.setTimeout(() => {
        toast.classList.add("hidden");
    }, 2600);
}


/* =========================
   Événements
========================= */

monthFilter.addEventListener("change", renderDashboard);

searchInput.addEventListener("input", renderTransactions);
typeFilter.addEventListener("change", renderTransactions);
categoryFilter.addEventListener("change", renderTransactions);

openTransactionButton.addEventListener(
    "click",
    openTransactionModal
);

openTransactionButtonSecondary.addEventListener(
    "click",
    openTransactionModal
);

closeModalButton.addEventListener(
    "click",
    closeTransactionModal
);

cancelTransactionButton.addEventListener(
    "click",
    closeTransactionModal
);

transactionModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) {
        closeTransactionModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        !transactionModal.classList.contains("hidden")
    ) {
        closeTransactionModal();
    }
});

transactionType.addEventListener(
    "change",
    populateTransactionCategories
);

transactionForm.addEventListener(
    "submit",
    handleTransactionSubmit
);

invoiceForm.addEventListener(
    "submit",
    handleInvoiceSubmit
);

scanInvoiceButton.addEventListener(
    "click",
    scanSelectedInvoice
);

cancelInvoiceEditButton.addEventListener(
    "click",
    resetInvoiceForm
);

settingsForm.addEventListener(
    "submit",
    handleSettingsSubmit
);

resetDataButton.addEventListener(
    "click",
    resetAllData
);

exportCsvButton.addEventListener(
    "click",
    exportTransactionsToCsv
);

exportInvoicesButton.addEventListener(
    "click",
    exportInvoicesToCsv
);

themeButton.addEventListener(
    "click",
    toggleTheme
);

menuButton.addEventListener(
    "click",
    toggleSidebar
);

document
    .querySelectorAll(".nav-link")
    .forEach((link) => {
        link.addEventListener("click", () => {
            closeSidebarOnNavigation();
            window.setTimeout(updateActiveNavigation, 0);
        });
    });

window.addEventListener("hashchange", updateActiveNavigation);

updateActiveNavigation();
initializeApp();
