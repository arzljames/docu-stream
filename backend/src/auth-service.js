import axios from "axios";
import { HttpError } from "./upload-service.js";

const AUTH_API_BASE_URL = "https://auth.api.zesty.io";
const ACCOUNTS_API_BASE_URL = "https://accounts.api.zesty.io/v1";
const DEFAULT_INSTANCE_ZUID = "8-e8e981c5f6-2twrfl";

function getBearerAuthorization(authorization) {
  return authorization?.startsWith("Bearer ") ? authorization : null;
}

function getBearerToken(authorization) {
  return authorization.slice("Bearer ".length);
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

function createSessionRequestConfig(authorization) {
  return {
    headers: {
      Accept: "application/json",
      Authorization: authorization,
    },
    validateStatus: () => true,
  };
}

export async function resolveAuthenticatedSession({ authorization }) {
  const userAuthorization = getBearerAuthorization(authorization);

  if (!userAuthorization) {
    throw new HttpError("Sign in before continuing.", 401);
  }

  const verifyResponse = await axios.get(
    `${AUTH_API_BASE_URL}/verify`,
    createSessionRequestConfig(userAuthorization),
  );

  if (verifyResponse.status < 200 || verifyResponse.status >= 300) {
    throw new HttpError("Your Zesty session could not be verified.", 401);
  }

  const userZuid = getVerifiedUserZuid(verifyResponse.data);

  if (!userZuid) {
    throw new HttpError("Your Zesty session could not be verified.", 401);
  }

  const [userResponse, instancesResponse] = await Promise.all([
    axios.get(
      `${ACCOUNTS_API_BASE_URL}/users/${userZuid}`,
      createSessionRequestConfig(userAuthorization),
    ),
    axios.get(
      `${ACCOUNTS_API_BASE_URL}/users/${userZuid}/instances`,
      createSessionRequestConfig(userAuthorization),
    ),
  ]);

  if (userResponse.status < 200 || userResponse.status >= 300) {
    throw new HttpError("Your Zesty user profile could not be loaded.", 502);
  }

  if (instancesResponse.status < 200 || instancesResponse.status >= 300) {
    throw new HttpError("Your instance access could not be verified.", 403);
  }

  const user = unwrapData(userResponse.data);
  const instances = unwrapArray(instancesResponse.data);
  const instanceZuid = process.env.ZESTY_INSTANCE_ZUID ?? DEFAULT_INSTANCE_ZUID;

  if (!user || typeof user !== "object") {
    throw new HttpError("Your Zesty user profile could not be loaded.", 502);
  }

  if (!instances.some((instance) => userHasInstanceAccess(instance, instanceZuid))) {
    throw new HttpError(
      "Your Zesty account does not have access to this DocuStream instance.",
      403,
    );
  }

  return {
    token: getBearerToken(userAuthorization),
    user,
  };
}

export async function logoutSession({ authorization }) {
  const userAuthorization = getBearerAuthorization(authorization);

  if (!userAuthorization) {
    return;
  }

  await axios
    .post(
      `${AUTH_API_BASE_URL}/logout`,
      undefined,
      createSessionRequestConfig(userAuthorization),
    )
    .catch(() => undefined);
}
