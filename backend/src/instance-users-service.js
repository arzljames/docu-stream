import axios from "axios";
import { HttpError, verifyInstanceWriteAccess } from "./upload-service.js";

const ACCOUNTS_API_BASE_URL = "https://accounts.api.zesty.io/v1";
const DEFAULT_INSTANCE_ZUID = "8-e8e981c5f6-2twrfl";

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

  if (data && typeof data === "object" && Array.isArray(data.users)) {
    return data.users;
  }

  return [];
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

    if (typeof value === "number") {
      return String(value);
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
      const email = parsedValue.find(
        (item) => typeof item === "string" && item.includes("@"),
      );

      return email ?? "";
    }

    if (parsedValue && typeof parsedValue === "object") {
      return getStringField(parsedValue, ["email", "address"]);
    }
  } catch {
    return "";
  }

  return "";
}

function getUserName(user) {
  const firstName = getStringField(user, ["firstName", "first_name"]);
  const lastName = getStringField(user, ["lastName", "last_name"]);
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    fullName ||
    getStringField(user, ["name", "fullName", "full_name", "username"])
  );
}

function normalizeUser(user) {
  const id =
    getStringField(user, ["ZUID", "zuid", "ID", "id", "userZUID"]) || "";

  if (id.startsWith("55-")) {
    return null;
  }

  const email =
    getStringField(user, ["email"]) ||
    getEmailFromUnknown(user?.verifiedEmails) ||
    getEmailFromUnknown(user?.unverifiedEmails);
  const name = getUserName(user) || email;
  const normalizedId = id || email;

  if (!email || !name || !normalizedId) {
    return null;
  }

  return {
    email,
    id: normalizedId,
    name,
  };
}

function normalizeUsers(payload) {
  return unwrapArray(payload)
    .map(normalizeUser)
    .filter(Boolean)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export async function listInstanceUsers({ authorization }) {
  const userAuthorization = await verifyInstanceWriteAccess(authorization);
  const instanceZuid = process.env.ZESTY_INSTANCE_ZUID ?? DEFAULT_INSTANCE_ZUID;
  const response = await axios.get(
    `${ACCOUNTS_API_BASE_URL}/instances/${encodeURIComponent(
      instanceZuid,
    )}/users`,
    {
      headers: {
        Accept: "application/json",
        Authorization: userAuthorization,
      },
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(
      typeof response.data?.message === "string" &&
        response.data.message.length > 0
        ? response.data.message
        : `Instance users could not be loaded. Status ${response.status}.`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }

  return {
    users: normalizeUsers(response.data),
  };
}
