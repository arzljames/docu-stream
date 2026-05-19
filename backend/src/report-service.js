import axios from "axios";
import { HttpError, verifyInstanceWriteAccess } from "./upload-service.js";

const CODA_API_BASE_URL = "https://coda.io/apis/v1";
const DEFAULT_CODA_DOC_ID = "GNetDKGq5M";
const DEFAULT_CODA_RELEASE_NOTES_PAGE = "Release Notes";
const DOCUMENT_LIST_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/document_list.json";
const DOCUMENT_FETCH_LIMIT = 100;
const CATEGORY_ORDER = ["Mobile", "Frontend", "Backend"];
const SUBCATEGORY_ORDER = ["Project Documentation", "RCA_Reports", "Media"];

function parseReportMonth(month) {
  const match = typeof month === "string" ? month.match(/^(\d{4})-(\d{2})$/) : null;

  if (!match) {
    throw new HttpError("Choose a valid report month.", 400);
  }

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (monthNumber < 1 || monthNumber > 12) {
    throw new HttpError("Choose a valid report month.", 400);
  }

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));

  return {
    key: month,
    monthLabel,
  };
}

function getItemDate(item) {
  return item?.meta?.createdAt ?? item?.meta?.updatedAt ?? "";
}

function isItemInMonth(item, monthKey) {
  return getItemDate(item).slice(0, 7) === monthKey;
}

function getFileExtension(filePath) {
  const cleanPath = typeof filePath === "string" ? filePath.split(/[?#]/)[0] : "";
  const fileName = cleanPath.split("/").pop() ?? "";
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];

  return extension ? extension.toUpperCase() : "FILE";
}

function formatDisplayDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSubcategory(subCategory) {
  return subCategory === "RCA_Reports" ? "RCA / Reports" : subCategory;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchDocumentPage(skip) {
  const response = await axios.get(DOCUMENT_LIST_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
    params: {
      limit: DOCUMENT_FETCH_LIMIT,
      skip,
      sort_by: "date",
      sort_order: "desc",
    },
  });

  return response.data;
}

async function fetchAllDocuments() {
  const documents = [];
  let skip = 0;
  let totalItems = null;

  for (let page = 0; page < 50; page += 1) {
    const payload = await fetchDocumentPage(skip);
    const items = Array.isArray(payload?.data) ? payload.data : [];

    documents.push(...items);
    totalItems = Number(payload?._meta?.totalItems) || totalItems;

    if (items.length < DOCUMENT_FETCH_LIMIT) {
      break;
    }

    skip += DOCUMENT_FETCH_LIMIT;

    if (totalItems !== null && skip >= totalItems) {
      break;
    }
  }

  return documents;
}

function normalizeDocument(item) {
  const date = getItemDate(item);

  return {
    category: item.data.category,
    date,
    description: item.data.description,
    displayDate: formatDisplayDate(date),
    fileExtension: getFileExtension(item.data.file),
    fileUrl: item.data.file,
    id: item.meta.ZUID,
    subCategory: item.data.sub_category,
    subCategoryLabel: formatSubcategory(item.data.sub_category),
    title: item.data.title || "Untitled document",
  };
}

function groupDocuments(documents) {
  return CATEGORY_ORDER.map((category) => {
    const categoryDocuments = documents.filter(
      (document) => document.category === category,
    );
    const subcategories = SUBCATEGORY_ORDER.map((subCategory) => {
      const items = categoryDocuments.filter(
        (document) => document.subCategory === subCategory,
      );

      return {
        documents: items,
        label: formatSubcategory(subCategory),
        subCategory,
        total: items.length,
      };
    }).filter((item) => item.total > 0);

    return {
      category,
      documents: categoryDocuments,
      subcategories,
      total: categoryDocuments.length,
    };
  });
}

function renderDocumentList(documents) {
  if (documents.length === 0) {
    return "<p>No documents uploaded for this category.</p>";
  }

  return documents
    .map((document) => {
      const description = document.description
        ? ` - ${escapeHtml(document.description)}`
        : "";

      return [
        "<li>",
        `<a href="${escapeHtml(document.fileUrl)}">${escapeHtml(document.title)}</a>`,
        ` <strong>${escapeHtml(document.fileExtension)}</strong>`,
        ` <em>${escapeHtml(document.displayDate)}</em>`,
        description,
        "</li>",
      ].join("");
    })
    .join("");
}

function renderReportHtml(report) {
  const categorySummary = report.categories
    .map(
      (category) =>
        `<li><strong>${category.category}:</strong> ${category.total}</li>`,
    )
    .join("");
  const categorySections = report.categories
    .map((category) => {
      const subcategorySections =
        category.subcategories.length > 0
          ? category.subcategories
              .map(
                (subcategory) => `
                  <h4>${escapeHtml(subcategory.label)} (${subcategory.total})</h4>
                  <ul>${renderDocumentList(subcategory.documents)}</ul>
                `,
              )
              .join("")
          : "<p>No documents uploaded for this category.</p>";

      return `
        <h3>${escapeHtml(category.category)} (${category.total})</h3>
        ${subcategorySections}
      `;
    })
    .join("");

  return `
    <hr />
    <h2>Monthly Release Notes - ${escapeHtml(report.monthLabel)}</h2>
    <p><strong>Total documents:</strong> ${report.totalDocuments}</p>
    <ul>${categorySummary}</ul>
    ${categorySections}
  `;
}

async function buildMonthlyReleaseReport(month) {
  const reportMonth = parseReportMonth(month);
  const allDocuments = await fetchAllDocuments();
  const documents = allDocuments
    .filter((item) => isItemInMonth(item, reportMonth.key))
    .map(normalizeDocument)
    .sort((first, second) => second.date.localeCompare(first.date));
  const categories = groupDocuments(documents);
  const report = {
    categories,
    generatedAt: new Date().toISOString(),
    month: reportMonth.key,
    monthLabel: reportMonth.monthLabel,
    totalDocuments: documents.length,
  };

  return {
    ...report,
    html: renderReportHtml(report),
  };
}

export async function generateMonthlyReleaseReport({ authorization, month }) {
  await verifyInstanceWriteAccess(authorization);

  return buildMonthlyReleaseReport(month);
}

function getCodaConfig() {
  const token = process.env.CODA_API_TOKEN;

  if (!token) {
    throw new HttpError("Missing Coda environment variable: CODA_API_TOKEN.", 501);
  }

  return {
    docId: process.env.CODA_DOC_ID ?? DEFAULT_CODA_DOC_ID,
    pageIdOrName:
      process.env.CODA_RELEASE_NOTES_PAGE_ID ??
      process.env.CODA_RELEASE_NOTES_PAGE_NAME ??
      DEFAULT_CODA_RELEASE_NOTES_PAGE,
    token,
  };
}

export async function postMonthlyReleaseReportToCoda({ authorization, month }) {
  await verifyInstanceWriteAccess(authorization);

  const report = await buildMonthlyReleaseReport(month);
  const config = getCodaConfig();
  const response = await axios.put(
    `${CODA_API_BASE_URL}/docs/${encodeURIComponent(
      config.docId,
    )}/pages/${encodeURIComponent(config.pageIdOrName)}`,
    {
      contentUpdate: {
        canvasContent: {
          content: report.html,
          format: "html",
        },
        insertionMode: "append",
      },
    },
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(
      typeof response.data?.message === "string" && response.data.message
        ? response.data.message
        : `Coda post failed. Status ${response.status}.`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }

  return {
    coda: response.data,
    report,
  };
}
