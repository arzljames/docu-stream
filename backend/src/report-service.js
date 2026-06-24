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
const RELEASE_NOTES_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/release_notes.json";
const CODA_ROW_FETCH_LIMIT = 500;
const RELEASE_NOTE_FETCH_LIMIT = 100;
const CODA_RELEASE_SOURCES = {
  projects: {
    dateColumnId: "c-IiOXYPAoC4",
    dateLabel: "Project ended",
    emptyMessage: "No completed projects for this month.",
    idColumnId: "c-MZWGOGE3S2",
    label: "Projects",
    statusColumnId: "c-zEJPS6RLGv",
    subcategoryColumnId: "c-IUaciDIwiQ",
    tableId: "grid-MfXSumoruY",
    titleFallback: "Untitled project",
  },
  tasks: {
    dateColumnId: "c-VvDTGrk0Ax",
    dateLabel: "Date completed",
    emptyMessage: "No completed tasks for this month.",
    idColumnId: "c-S4TMGalGwk",
    label: "Tasks",
    statusColumnId: "c-lYEuP77-Zi",
    subcategoryColumnId: "c-QDryrHPAHD",
    tableId: "grid-i-KqDtiqCI",
    titleFallback: "Untitled task",
  },
};
const CODA_RELEASE_SOURCE_ORDER = ["projects", "tasks"];

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
  const normalizedValue =
    typeof value === "string" ? value.trim() : String(value ?? "").trim();
  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch.map(Number);

    return new Date(year, month - 1, day);
  }

  const dateTimeValue = /^\d{4}-\d{2}-\d{2}\s/.test(normalizedValue)
    ? normalizedValue.replace(" ", "T")
    : normalizedValue;

  return new Date(dateTimeValue);
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

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getCodaRowsConfig() {
  const codaConfig = getCodaConfig();

  return {
    docId: codaConfig.docId,
    token: codaConfig.token,
  };
}

async function fetchCodaRowsForSource(sourceKey, config = getCodaRowsConfig()) {
  const source = CODA_RELEASE_SOURCES[sourceKey];
  const rows = [];
  let nextPageUrl = `${CODA_API_BASE_URL}/docs/${encodeURIComponent(
    config.docId,
  )}/tables/${encodeURIComponent(source.tableId)}/rows`;
  let params = {
    limit: CODA_ROW_FETCH_LIMIT,
    query: `${source.statusColumnId}:"Completed"`,
    useColumnNames: false,
  };

  for (let page = 0; page < 50 && nextPageUrl; page += 1) {
    const response = await axios.get(nextPageUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      params,
      validateStatus: () => true,
    });

    assertUpstreamSuccess(response, "Coda rows could not be loaded.");

    const items = Array.isArray(response.data?.items)
      ? response.data.items
      : [];

    rows.push(...items);
    nextPageUrl =
      typeof response.data?.nextPageLink === "string"
        ? response.data.nextPageLink
        : "";
    params = undefined;

    if (items.length < CODA_ROW_FETCH_LIMIT && !nextPageUrl) {
      break;
    }
  }

  return rows;
}

async function fetchMonthlyReleaseCodaRows() {
  const config = getCodaRowsConfig();
  const [projects, tasks] = await Promise.all([
    fetchCodaRowsForSource("projects", config),
    fetchCodaRowsForSource("tasks", config),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    projects,
    tasks,
  };
}

export async function listMonthlyReleaseCodaRows({ authorization }) {
  await verifyInstanceWriteAccess(authorization);

  return fetchMonthlyReleaseCodaRows();
}

function sanitizeCodaRows(rows) {
  return Array.isArray(rows) ? rows.filter(isRecord) : [];
}

function getSubmittedCodaRows(sourceRows) {
  if (!isRecord(sourceRows)) {
    return null;
  }

  return {
    generatedAt:
      typeof sourceRows.generatedAt === "string"
        ? sourceRows.generatedAt
        : new Date().toISOString(),
    projects: sanitizeCodaRows(sourceRows.projects),
    tasks: sanitizeCodaRows(sourceRows.tasks),
  };
}

async function getMonthlyReleaseCodaRows(sourceRows) {
  return getSubmittedCodaRows(sourceRows) ?? fetchMonthlyReleaseCodaRows();
}

function getCodaRowValues(row) {
  return isRecord(row?.values) ? row.values : {};
}

function getCodaCellText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getCodaCellText).filter(Boolean).join(", ");
  }

  if (!isRecord(value)) {
    return "";
  }

  for (const key of [
    "date",
    "start",
    "end",
    "display",
    "name",
    "title",
    "value",
    "text",
    "url",
  ]) {
    const text = getCodaCellText(value[key]);

    if (text) {
      return text;
    }
  }

  return "";
}

function getMonthKeyFromDateValue(value) {
  const text = getCodaCellText(value);

  if (!text) {
    return "";
  }

  const isoMatch = text.match(/(\d{4})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const date = parseDateValue(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function isCodaRowInMonth(row, sourceKey, monthKey) {
  const source = CODA_RELEASE_SOURCES[sourceKey];
  const values = getCodaRowValues(row);

  return getMonthKeyFromDateValue(values[source.dateColumnId]) === monthKey;
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

function getSortableDateTime(value) {
  const date = parseDateValue(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function normalizeCodaReleaseItem(row, sourceKey, index) {
  const source = CODA_RELEASE_SOURCES[sourceKey];
  const values = getCodaRowValues(row);
  const date = getCodaCellText(values[source.dateColumnId]);
  const itemId = getCodaCellText(values[source.idColumnId]);
  const subcategory =
    getCodaCellText(values[source.subcategoryColumnId]) || "Uncategorized";
  const title = getStringField(row, ["name"]) || source.titleFallback;
  const url = getStringField(row, ["browserLink", "href"]);

  return {
    date,
    dateLabel: source.dateLabel,
    displayDate: formatDisplayDate(date),
    id: getStringField(row, ["id"]) || `${sourceKey}-${index}`,
    itemId,
    subcategory,
    title,
    url,
  };
}

function buildCodaReleaseSubcategories(items) {
  const groups = new Map();

  for (const item of items) {
    const key = item.subcategory.trim().toLowerCase() || "uncategorized";
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      existing.total += 1;
      continue;
    }

    groups.set(key, {
      items: [item],
      label: item.subcategory,
      total: 1,
    });
  }

  return Array.from(groups.values()).sort((first, second) => {
    if (first.label === "Uncategorized") {
      return 1;
    }

    if (second.label === "Uncategorized") {
      return -1;
    }

    return first.label.localeCompare(second.label);
  });
}

function buildCodaReleaseCategories(sourceRows, monthKey) {
  return CODA_RELEASE_SOURCE_ORDER.map((sourceKey) => {
    const source = CODA_RELEASE_SOURCES[sourceKey];
    const items = sanitizeCodaRows(sourceRows[sourceKey])
      .filter((row) => isCodaRowInMonth(row, sourceKey, monthKey))
      .map((row, index) => normalizeCodaReleaseItem(row, sourceKey, index))
      .sort(
        (first, second) =>
          getSortableDateTime(second.date) - getSortableDateTime(first.date),
      );

    return {
      category: sourceKey,
      categoryLabel: source.label,
      emptyMessage: source.emptyMessage,
      items,
      subcategories: buildCodaReleaseSubcategories(items),
      total: items.length,
    };
  });
}

function renderCodaReleaseItemList(items) {
  if (items.length === 0) {
    return "";
  }

  return items
    .map((item) => {
      const title = item.url
        ? `<a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a>`
        : `<strong>${escapeHtml(item.title)}</strong>`;

      return [
        "<li>",
        title,
        ` - <em>${escapeHtml(item.displayDate)}</em>`,
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
      const itemsHtml =
        category.subcategories.length > 0
          ? category.subcategories
              .map(
                (subcategory) => `
                 <span style="font-weight:bold;">${escapeHtml(subcategory.label)} (${subcategory.total})</span>
                  <ul>${renderCodaReleaseItemList(subcategory.items)}</ul>
                `,
              )
              .join("")
          : `<p>${escapeHtml(category.emptyMessage)}</p>`;

      return `
        <h3>${escapeHtml(category.categoryLabel)} (${category.total})</h3>
        ${itemsHtml}
      `;
    })
    .join("");

  return `
    <h2>Monthly Release Notes - ${escapeHtml(report.monthLabel)}</h2>
    <p><strong>Total completed items:</strong> ${report.totalItems}</p>
    <ul>${categorySummary}</ul>
    ${categorySections}
    <hr />
  `;
}

async function buildMonthlyReleaseReport(month, sourceRows) {
  const reportMonth = parseReportMonth(month);
  const codaRows = await getMonthlyReleaseCodaRows(sourceRows);
  const categories = buildCodaReleaseCategories(codaRows, reportMonth.key);
  const totalItems = categories.reduce(
    (total, category) => total + category.total,
    0,
  );
  const report = {
    categories,
    generatedAt: new Date().toISOString(),
    month: reportMonth.key,
    monthLabel: reportMonth.monthLabel,
    totalItems,
  };

  return {
    ...report,
    html: renderReportHtml(report),
  };
}

export async function generateMonthlyReleaseReport({
  authorization,
  month,
  sourceRows,
}) {
  await verifyInstanceWriteAccess(authorization);

  return buildMonthlyReleaseReport(month, sourceRows);
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

export async function createMonthlyReleaseNote({ authorization, body }) {
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

  const report = await buildMonthlyReleaseReport(body?.month, body?.sourceRows);

  if (report.totalItems === 0) {
    throw new HttpError(
      "There are no completed Coda projects or tasks to generate release notes for this month.",
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
          content: html,
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

export async function postMonthlyReleaseReportToCoda({
  authorization,
  month,
  sourceRows,
}) {
  await verifyInstanceWriteAccess(authorization);

  const report = await buildMonthlyReleaseReport(month, sourceRows);
  const coda = await postHtmlToCoda(report.html);

  return {
    coda,
    report,
  };
}

export async function approveMonthlyReleaseNote({ authorization, body }) {
  const itemZuid =
    typeof body?.itemZuid === "string" ? body.itemZuid.trim() : "";

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
