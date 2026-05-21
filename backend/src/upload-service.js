import axios from "axios";
import { randomUUID } from "node:crypto";

const AUTH_API_BASE_URL = "https://auth.api.zesty.io";
const ACCOUNTS_API_BASE_URL = "https://accounts.api.zesty.io/v1";
const DEFAULT_INSTANCE_ZUID = "8-e8e981c5f6-2twrfl";
const DEFAULT_DOCS_MODEL_ZUID = "6-bcf1eac59e-4xdbl3";

const CATEGORY_VALUES = new Set(["Backend", "Frontend", "Mobile"]);

const SUBCATEGORY_VALUES = new Set([
  "Media",
  "Project Documentation",
  "RCA_Reports",
]);

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function getErrorMessage(error, fallback = "Upload failed.") {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;

    if (typeof responseMessage === "string" && responseMessage.length > 0) {
      return responseMessage;
    }

    if (error.response?.status) {
      return `${fallback} Status ${error.response.status}.`;
    }
  }

  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}

function getBearerAuthorization(authorization) {
  return authorization?.startsWith("Bearer ") ? authorization : null;
}

function unwrapData(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function unwrapArray(payload) {
  const data = unwrapData(payload);

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object" && Array.isArray(data.instances)) {
    return data.instances;
  }

  return [];
}

function getUserAuthorName(user) {
  if (!user || typeof user !== "object") {
    return "";
  }

  const firstName =
    typeof user.firstName === "string" ? user.firstName.trim() : "";
  const lastName =
    typeof user.lastName === "string" ? user.lastName.trim() : "";

  return `${firstName} ${lastName}`.trim();
}

function isValidDateString(value) {
  const match =
    typeof value === "string"
      ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      : null;

  if (!match) {
    return false;
  }

  const [, year, month, day] = match.map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function getVerifiedUserZuid(response) {
  const metaUserZuid = response?.meta?.userZuid;

  if (typeof metaUserZuid === "string" && metaUserZuid.length > 0) {
    return metaUserZuid;
  }

  return typeof response?.data === "string" && response.data.startsWith("5-")
    ? response.data
    : null;
}

function userHasInstanceAccess(instance, instanceZuid) {
  if (!instance || typeof instance !== "object") {
    return false;
  }

  const possibleZuidFields = [
    "ZUID",
    "zuid",
    "instanceZUID",
    "instanceZuid",
    "instance_zuid",
  ];

  return (
    possibleZuidFields.some((field) => instance[field] === instanceZuid) ||
    Object.values(instance).some((value) => value === instanceZuid)
  );
}

function getConfig(userAuthorization) {
  const config = {
    bucketName: process.env.MEDIA_BUCKET_NAME,
    docsModelZuid:
      process.env.DOCS_MODEL_ZUID ??
      process.env.CONTENT_MODEL_ZUID ??
      DEFAULT_DOCS_MODEL_ZUID,
    instanceZuid: process.env.ZESTY_INSTANCE_ZUID ?? DEFAULT_INSTANCE_ZUID,
    mediaDriver: process.env.MEDIA_DRIVER,
    mediaZuid: process.env.MEDIA_ZUID,
    parentZuid: process.env.CONTENT_PARENT_ZUID ?? "0",
    upstreamAuthorization: userAuthorization,
  };
  const missing = Object.entries({
    MEDIA_BUCKET_NAME: config.bucketName,
    MEDIA_DRIVER: config.mediaDriver,
    MEDIA_ZUID: config.mediaZuid,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new HttpError(
      `Missing upload environment variables: ${missing.join(", ")}.`,
      501,
    );
  }

  return config;
}

function getUploadFile(file) {
  if (!file?.buffer || !file.originalname) {
    throw new HttpError("Choose a file to upload.");
  }

  return file;
}

function getContentItemFields(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const category = typeof data.category === "string" ? data.category : "";
  const documentDateCreated =
    typeof data.document_date_created === "string"
      ? data.document_date_created.trim()
      : "";
  const subCategory =
    typeof data.sub_category === "string" ? data.sub_category : "";
  const fileZuid = typeof data.file === "string" ? data.file.trim() : "";

  if (!title) {
    throw new HttpError("Document title is required.");
  }

  if (!CATEGORY_VALUES.has(category)) {
    throw new HttpError("Choose a valid category.");
  }

  if (!SUBCATEGORY_VALUES.has(subCategory)) {
    throw new HttpError("Choose a valid subcategory.");
  }

  if (!isValidDateString(documentDateCreated)) {
    throw new HttpError("Date created must use YYYY-MM-DD format.");
  }

  if (!fileZuid) {
    throw new HttpError("File ZUID must be a string.");
  }

  return {
    category,
    description,
    documentDateCreated,
    fileZuid,
    subCategory,
    title,
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
    502,
  );
}

async function verifyUserSession(userAuthorization, instanceZuid) {
  const verifyResponse = await axios.get(`${AUTH_API_BASE_URL}/verify`, {
    headers: {
      Accept: "application/json",
      Authorization: userAuthorization,
    },
    validateStatus: () => true,
  });

  if (verifyResponse.status < 200 || verifyResponse.status >= 300) {
    throw new HttpError("Your session could not be verified.", 401);
  }

  const userZuid = getVerifiedUserZuid(verifyResponse.data);

  if (!userZuid) {
    throw new HttpError("Your session could not be verified.", 401);
  }

  const instancesResponse = await axios.get(
    `${ACCOUNTS_API_BASE_URL}/users/${userZuid}/instances`,
    {
      headers: {
        Accept: "application/json",
        Authorization: userAuthorization,
      },
      validateStatus: () => true,
    },
  );

  if (instancesResponse.status < 200 || instancesResponse.status >= 300) {
    throw new HttpError("Your instance access could not be verified.", 403);
  }

  const instances = unwrapArray(instancesResponse.data);

  if (
    !instances.some((instance) => userHasInstanceAccess(instance, instanceZuid))
  ) {
    throw new HttpError(
      "Your Zesty account does not have access to this DocuStream instance.",
      403,
    );
  }

  return { userZuid };
}

async function getCurrentUserAuthorName(userAuthorization, userZuid) {
  const userResponse = await axios.get(
    `${ACCOUNTS_API_BASE_URL}/users/${userZuid}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: userAuthorization,
      },
      validateStatus: () => true,
    },
  );

  if (userResponse.status < 200 || userResponse.status >= 300) {
    throw new HttpError("Your Zesty user profile could not be loaded.", 502);
  }

  const authorName = getUserAuthorName(unwrapData(userResponse.data));

  if (!authorName) {
    throw new HttpError("Your Zesty user profile is missing a name.", 502);
  }

  return authorName;
}

export async function resolveVerifiedInstanceUser(authorization) {
  const userAuthorization = getBearerAuthorization(authorization);

  if (!userAuthorization) {
    throw new HttpError("Sign in before continuing.", 401);
  }

  const session = await verifyUserSession(
    userAuthorization,
    process.env.ZESTY_INSTANCE_ZUID ?? DEFAULT_INSTANCE_ZUID,
  );

  return {
    userAuthorization,
    userZuid: session.userZuid,
  };
}

export async function getCurrentInstanceUser(authorization) {
  const { userAuthorization, userZuid } =
    await resolveVerifiedInstanceUser(authorization);
  const userResponse = await axios.get(
    `${ACCOUNTS_API_BASE_URL}/users/${userZuid}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: userAuthorization,
      },
      validateStatus: () => true,
    },
  );

  if (userResponse.status < 200 || userResponse.status >= 300) {
    throw new HttpError("Your Zesty user profile could not be loaded.", 502);
  }

  return {
    user: unwrapData(userResponse.data),
    userAuthorization,
    userZuid,
  };
}

export async function verifyInstanceWriteAccess(authorization) {
  const { userAuthorization } = await resolveVerifiedInstanceUser(authorization);

  return userAuthorization;
}

function findZuid(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const zuid =
    value.id ??
    value.ZUID ??
    value.zuid ??
    value.fileZUID ??
    value.fileZuid ??
    value.mediaZUID ??
    value.mediaZuid;

  return typeof zuid === "string" && zuid.length > 0 ? zuid : null;
}

function getUploadedFileZuid(payload) {
  const data = unwrapData(payload);
  const candidates = Array.isArray(data) ? data : [data, payload];

  for (const candidate of candidates) {
    const zuid = findZuid(candidate);

    if (zuid) {
      return zuid;
    }
  }

  return null;
}

async function uploadMediaFile(file, config) {
  const formData = new FormData();
  const blob = new Blob([file.buffer], {
    type: file.mimetype || "application/octet-stream",
  });

  formData.append("file", blob, file.originalname);
  formData.append("bin_id", config.mediaZuid);

  const response = await axios.post(
    `https://media-storage.api.zesty.io/upload/${config.mediaDriver}/${config.bucketName}`,
    formData,
    {
      headers: {
        Accept: "application/json",
        Authorization: config.upstreamAuthorization,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    },
  );

  assertUpstreamSuccess(response, "Media upload failed.");

  const fileZuid = getUploadedFileZuid(response.data);

  if (!fileZuid) {
    throw new HttpError(
      "Media upload succeeded but no file ZUID was returned.",
      502,
    );
  }

  return {
    fileZuid,
    responseData: response.data,
  };
}

async function createContentItem(fields, fileZuid, config, authorName) {
  if (typeof fileZuid !== "string" || fileZuid.length === 0) {
    throw new HttpError("File ZUID must be a string.", 502);
  }

  const uniqueMetaTitle = `${fields.title}-${randomUUID()}`;

  const response = await axios.post(
    `https://${config.instanceZuid}.api.zesty.io/v1/content/models/${config.docsModelZuid}/items`,
    {
      data: {
        category: fields.category,
        description: fields.description,
        document_date_created: fields.documentDateCreated,
        file: fileZuid,
        sub_category: fields.subCategory,
        title: fields.title,
        author: authorName,
      },
      web: {
        canonicalTagMode: 1,
        parentZUID: config.parentZuid,
        pathPart: uniqueMetaTitle,
        metaTitle: uniqueMetaTitle,
      },
      meta: {
        langID: 1,
        contentModelZUID: config.docsModelZuid,
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

  assertUpstreamSuccess(response, "Content item creation failed.");

  return response.data;
}

export async function uploadMedia({ authorization, file }) {
  const userAuthorization = getBearerAuthorization(authorization);

  if (!userAuthorization) {
    throw new HttpError("Sign in before uploading a document.", 401);
  }

  const config = getConfig(userAuthorization);
  const uploadFile = getUploadFile(file);

  await verifyUserSession(userAuthorization, config.instanceZuid);

  const media = await uploadMediaFile(uploadFile, config);

  return {
    fileZUID: media.fileZuid,
    media: media.responseData,
  };
}

export async function createDocumentItem({ authorization, body }) {
  const userAuthorization = getBearerAuthorization(authorization);

  if (!userAuthorization) {
    throw new HttpError("Sign in before creating a document.", 401);
  }

  const config = getConfig(userAuthorization);
  const fields = getContentItemFields(body);

  const session = await verifyUserSession(userAuthorization, config.instanceZuid);
  const authorName = await getCurrentUserAuthorName(
    userAuthorization,
    session.userZuid,
  );

  const item = await createContentItem(
    fields,
    fields.fileZuid,
    config,
    authorName,
  );

  return {
    fileZUID: fields.fileZuid,
    item,
  };
}
