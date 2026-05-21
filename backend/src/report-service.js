import axios from "axios";
import { randomUUID } from "node:crypto";
import {
  getCurrentInstanceUser,
  HttpError,
  verifyInstanceWriteAccess,
} from "./upload-service.js";

const CODA_API_BASE_URL = "https://coda.io/apis/v1";
const DEFAULT_CODA_DOC_ID = "GNetDKGq5M";
const DEFAULT_CODA_RELEASE_NOTES_PAGE = "Release Notes";
const DEFAULT_INSTANCE_ZUID = "8-e8e981c5f6-2twrfl";
const DEFAULT_NOTES_MODEL_ZUID = "6-ea94cae6b2-7dskj0";
const DOCUMENT_LIST_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/document_list.json";
const RELEASE_NOTES_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/release_notes.json";
const DOCUMENT_FETCH_LIMIT = 100;
const RELEASE_NOTE_FETCH_LIMIT = 100;
const CATEGORY_ORDER = [
  { value: "Mobile", label: "📱 Mobile" },
  { value: "Frontend", label: "🖥️ Frontend" },
  { value: "Backend", label: "📊 Backend" },
];
const SUBCATEGORY_ORDER = ["Project Documentation", "RCA_Reports", "Media"];

function parseReportMonth(month) {
  const match =
    typeof month === "string" ? month.match(/^(\d{4})-(\d{2})$/) : null;

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
  return (
    item?.data?.document_date_created ||
    item?.meta?.createdAt ||
    item?.meta?.updatedAt ||
    ""
  );
}

function isItemInMonth(item, monthKey) {
  return getItemDate(item).slice(0, 7) === monthKey;
}

function getFileExtension(filePath) {
  const cleanPath =
    typeof filePath === "string" ? filePath.split(/[?#]/)[0] : "";
  const fileName = cleanPath.split("/").pop() ?? "";
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];

  return extension ? extension.toUpperCase() : "FILE";
}

function formatDisplayDate(value) {
  if (!value) {
    return "No date";
  }

  const date = parseDateValue(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function parseDateValue(value) {
  const dateOnlyMatch =
    typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch.map(Number);

    return new Date(year, month - 1, day);
  }

  return new Date(value.replace(" ", "T"));
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

function getTodayDateValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function getReleaseMonthDateValue(month) {
  return `${month}-01`;
}

function getReleaseNoteFields(body) {
  const approverName =
    typeof body?.approverName === "string" ? body.approverName.trim() : "";
  const approverEmail =
    typeof body?.approverEmail === "string" ? body.approverEmail.trim() : "";

  if (!approverName) {
    throw new HttpError("Choose an approver.", 400);
  }

  if (!approverEmail) {
    throw new HttpError("Choose an approver with an email address.", 400);
  }

  return {
    approverEmail,
    approverName,
  };
}

function getReleaseNotesConfig(userAuthorization) {
  return {
    instanceZuid: process.env.ZESTY_INSTANCE_ZUID ?? DEFAULT_INSTANCE_ZUID,
    notesModelZuid: process.env.NOTES_MODEL_ZUID ?? DEFAULT_NOTES_MODEL_ZUID,
    parentZuid: process.env.CONTENT_PARENT_ZUID ?? "0",
    upstreamAuthorization: userAuthorization,
  };
}

function assertUpstreamSuccess(response, message) {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  throw new HttpError(
    typeof response.data?.message === "string" &&
      response.data.message.length > 0
      ? response.data.message
      : `${message} Status ${response.status}.`,
    response.status >= 400 && response.status < 500 ? response.status : 502,
  );
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

async function fetchReleaseNotePage(skip) {
  const response = await axios.get(RELEASE_NOTES_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
    params: {
      limit: RELEASE_NOTE_FETCH_LIMIT,
      skip,
    },
  });

  return response.data;
}

async function fetchAllReleaseNotes() {
  const releaseNotes = [];
  let skip = 0;
  let totalItems = null;

  for (let page = 0; page < 50; page += 1) {
    const payload = await fetchReleaseNotePage(skip);
    const items = Array.isArray(payload?.data) ? payload.data : [];

    releaseNotes.push(...items);
    totalItems = Number(payload?._meta?.totalItems) || totalItems;

    if (items.length < RELEASE_NOTE_FETCH_LIMIT) {
      break;
    }

    skip += RELEASE_NOTE_FETCH_LIMIT;

    if (totalItems !== null && skip >= totalItems) {
      break;
    }
  }

  return releaseNotes;
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

async function assertReleaseNoteDoesNotExist(month) {
  const releaseNotes = await fetchAllReleaseNotes();
  const hasExistingMonth = releaseNotes.some(
    (item) => item?.data?.release_month_date?.slice(0, 7) === month,
  );

  if (hasExistingMonth) {
    throw new HttpError(
      "Release notes for this month have already been generated.",
      409,
    );
  }
}

function isApprovedValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return typeof value === "string"
    ? value === "1" || value.toLowerCase() === "true"
    : false;
}

function getStringField(item, fields) {
  if (!item || typeof item !== "object") {
    return "";
  }

  for (const field of fields) {
    const value = item[field];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
}

function getEmailFromUnknown(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  const trimmedValue = value.trim();

  if (trimmedValue.includes("@")) {
    return trimmedValue;
  }

  try {
    const parsedValue = JSON.parse(trimmedValue);

    if (Array.isArray(parsedValue)) {
      return (
        parsedValue.find(
          (item) => typeof item === "string" && item.includes("@"),
        ) ?? ""
      );
    }

    if (parsedValue && typeof parsedValue === "object") {
      return getStringField(parsedValue, ["email", "address"]);
    }
  } catch {
    return "";
  }

  return "";
}

function getUserEmail(user) {
  return (
    getStringField(user, ["email"]) ||
    getEmailFromUnknown(user?.verifiedEmails) ||
    getEmailFromUnknown(user?.unverifiedEmails)
  );
}

function getUserName(user) {
  const firstName = getStringField(user, ["firstName", "first_name"]);
  const lastName = getStringField(user, ["lastName", "last_name"]);
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    getStringField(user, ["name", "fullName", "full_name", "username"]) ||
    getUserEmail(user)
  );
}

async function getReleaseNoteByZuid(itemZuid) {
  const releaseNotes = await fetchAllReleaseNotes();

  return releaseNotes.find(
    (item) =>
      item?.meta?.ZUID === itemZuid || item?.meta?.masterZUID === itemZuid,
  );
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
      (document) => document.category === category.value,
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
      category: category.value,
      categoryLabel: category.label,
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
        `<li><strong>${escapeHtml(category.categoryLabel)}:</strong> ${category.total}</li>`,
    )
    .join("");
  const categorySections = report.categories
    .map((category) => {
      const subcategorySections =
        category.subcategories.length > 0
          ? category.subcategories
              .map(
                (subcategory) => `
                  <span style="font-weight:bold;">
                    ${escapeHtml(subcategory.label)} (${subcategory.total})
                  </span>
                  <ul>${renderDocumentList(subcategory.documents)}</ul>
                `,
              )
              .join("")
          : "<p>No documents uploaded for this category.</p>";

      return `
        <h3>${escapeHtml(category.categoryLabel)} (${category.total})</h3>
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

async function createReleaseNoteItem({ fields, generatedBy, report, config }) {
  const releaseMonthDate = getReleaseMonthDateValue(report.month);
  const dateGenerated = getTodayDateValue();
  const pathPart = `${releaseMonthDate}-${randomUUID()}`;
  const response = await axios.post(
    `https://${config.instanceZuid}.api.zesty.io/v1/content/models/${config.notesModelZuid}/items`,
    {
      data: {
        release_month_date: releaseMonthDate,
        date_generated: dateGenerated,
        notes: report.html,
        approver_name: fields.approverName,
        approver_email: fields.approverEmail,
        generated_by_email: generatedBy.email,
        generated_by_name: generatedBy.name,
        is_approved: false,
      },
      web: {
        canonicalTagMode: 1,
        parentZUID: config.parentZuid,
        pathPart,
        metaTitle: pathPart,
      },
      meta: {
        langID: 1,
        contentModelZUID: config.notesModelZuid,
      },
    },
    {
      headers: {
        Accept: "application/json",
        Authorization: config.upstreamAuthorization,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    },
  );

  assertUpstreamSuccess(response, "Release note creation failed.");

  return {
    dateGenerated,
    item: response.data,
    pathPart,
    releaseMonthDate,
  };
}

async function approveReleaseNoteItem({ config, itemZuid }) {
  const response = await axios.patch(
    `https://${config.instanceZuid}.api.zesty.io/v1/content/models/${config.notesModelZuid}/items/${encodeURIComponent(
      itemZuid,
    )}`,
    {
      data: {
        is_approved: true,
      },
    },
    {
      headers: {
        Accept: "application/json",
        Authorization: config.upstreamAuthorization,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    },
  );

  assertUpstreamSuccess(response, "Release note approval failed.");

  return response.data;
}

export async function createMonthlyReleaseNote({
  authorization,
  body,
}) {
  const { user, userAuthorization } =
    await getCurrentInstanceUser(authorization);
  const fields = getReleaseNoteFields(body);
  const generatedBy = {
    email: getUserEmail(user),
    name: getUserName(user),
  };
  const reportMonth = parseReportMonth(body?.month);

  if (!generatedBy.email) {
    throw new HttpError("Your Zesty user profile is missing an email.", 502);
  }

  await assertReleaseNoteDoesNotExist(reportMonth.key);

  const report = await buildMonthlyReleaseReport(body?.month);

  if (report.totalDocuments === 0) {
    throw new HttpError(
      "There are no documents to generate release notes for this month.",
      400,
    );
  }

  const config = getReleaseNotesConfig(userAuthorization);
  const created = await createReleaseNoteItem({
    config,
    fields,
    generatedBy,
    report,
  });

  return {
    ...created,
    report,
  };
}

function getCodaConfig() {
  const token = process.env.CODA_API_TOKEN;

  if (!token) {
    throw new HttpError(
      "Missing Coda environment variable: CODA_API_TOKEN.",
      501,
    );
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

async function postHtmlToCoda(html, config = getCodaConfig()) {
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

  assertUpstreamSuccess(response, "Coda post failed.");

  return response.data;
}

export async function postMonthlyReleaseReportToCoda({ authorization, month }) {
  await verifyInstanceWriteAccess(authorization);

  const report = await buildMonthlyReleaseReport(month);
  const coda = await postHtmlToCoda(report.html);

  return {
    coda,
    report,
  };
}

export async function approveMonthlyReleaseNote({ authorization, body }) {
  const itemZuid = typeof body?.itemZuid === "string" ? body.itemZuid.trim() : "";

  if (!itemZuid) {
    throw new HttpError("Release note item is required.", 400);
  }

  const { user, userAuthorization } =
    await getCurrentInstanceUser(authorization);
  const currentUserEmail = getUserEmail(user).toLowerCase();

  if (!currentUserEmail) {
    throw new HttpError("Your Zesty user profile is missing an email.", 502);
  }

  const note = await getReleaseNoteByZuid(itemZuid);

  if (!note) {
    throw new HttpError("Release note could not be found.", 404);
  }

  if (isApprovedValue(note?.data?.is_approved)) {
    throw new HttpError("Release note has already been approved.", 409);
  }

  const approverEmail =
    typeof note?.data?.approver_email === "string"
      ? note.data.approver_email.trim().toLowerCase()
      : "";

  if (!approverEmail || approverEmail !== currentUserEmail) {
    throw new HttpError(
      "Only the assigned approver can approve this release note.",
      403,
    );
  }

  const html = typeof note?.data?.notes === "string" ? note.data.notes : "";

  if (!html.trim()) {
    throw new HttpError("Release note HTML is missing.", 502);
  }

  const codaConfig = getCodaConfig();
  const config = getReleaseNotesConfig(userAuthorization);
  const item = await approveReleaseNoteItem({
    config,
    itemZuid: note.meta.ZUID,
  });
  const coda = await postHtmlToCoda(html, codaConfig);

  return {
    coda,
    item,
    note,
  };
}
