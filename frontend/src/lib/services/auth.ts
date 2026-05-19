import { APP_ZUID } from "@/constant";
import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import axiosInstance from "./axios-instance";
import { readStoredSessionToken } from "./session-token";

const AUTH_API_BASE_URL = "https://auth.api.zesty.io";
const ACCOUNTS_API_BASE_URL = "https://accounts.api.zesty.io/v1";

export type User = {
  ID: number;
  ZUID: string;
  authSource: string;
  authyPhoneCountryCode: null | string | number;
  authyPhoneNumber: null | string | number;
  authyUserID: null | string | number;
  createdAt: string;
  email: string;
  emailHash: string;
  firstName: string;
  lastLogin: string | null;
  lastName: string;
  prefs: string;
  signupInfo: string | null;
  staff: boolean;
  unverifiedEmails: string;
  updatedAt: string;
  verifiedEmails: string | null;
  websiteCreator: boolean;
};

type ApiEnvelope<T> = {
  code?: number;
  data?: T;
  message?: string;
  meta?: {
    userZuid?: string;
  };
  status?: string;
};

type VerifySessionResponse = ApiEnvelope<number | string>;

type UserInstance = Record<string, unknown>;

export type AuthenticatedSession = {
  token: string;
  user: User;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const message = payload.message;

  return typeof message === "string" && message.length > 0 ? message : null;
}

function getRequestErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseMessage = getApiErrorMessage(error.response?.data);

    if (responseMessage) {
      return responseMessage;
    }

    if (error.response?.status) {
      return `Request failed with status ${error.response.status}`;
    }
  }

  return error instanceof Error && error.message.length > 0
    ? error.message
    : "Request failed.";
}

function unwrapData<T>(payload: unknown): T | null {
  if (payload === null) {
    return null;
  }

  if (isRecord(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function unwrapArray<T>(payload: unknown): T[] {
  const data = unwrapData<unknown>(payload);

  if (Array.isArray(data)) {
    return data as T[];
  }

  if (isRecord(data) && Array.isArray(data.instances)) {
    return data.instances as T[];
  }

  return [];
}

function getVerifiedUserZuid(response: VerifySessionResponse) {
  const metaUserZuid = response.meta?.userZuid;

  if (typeof metaUserZuid === "string" && metaUserZuid.length > 0) {
    return metaUserZuid;
  }

  return typeof response.data === "string" && response.data.startsWith("5-")
    ? response.data
    : null;
}

function userHasAppInstanceAccess(instance: UserInstance) {
  const possibleZuidFields = [
    "ZUID",
    "zuid",
    "instanceZUID",
    "instanceZuid",
    "instance_zuid",
  ];

  return (
    possibleZuidFields.some((field) => instance[field] === APP_ZUID) ||
    Object.values(instance).some((value) => value === APP_ZUID)
  );
}

function createSessionRequestConfig(token: string): AxiosRequestConfig {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export async function resolveAuthenticatedSession(
  token: string,
): Promise<AuthenticatedSession> {
  try {
    const verifyResponse = await axiosInstance.get<VerifySessionResponse>(
      `${AUTH_API_BASE_URL}/verify`,
      createSessionRequestConfig(token),
    );
    const userZuid = getVerifiedUserZuid(verifyResponse.data);

    if (!userZuid) {
      throw new Error("Your Zesty session could not be verified.");
    }

    const [userResponse, instancesResponse] = await Promise.all([
      axiosInstance.get<ApiEnvelope<User> | User>(
        `${ACCOUNTS_API_BASE_URL}/users/${userZuid}`,
        createSessionRequestConfig(token),
      ),
      axiosInstance.get<ApiEnvelope<UserInstance[]> | UserInstance[]>(
        `${ACCOUNTS_API_BASE_URL}/users/${userZuid}/instances`,
        createSessionRequestConfig(token),
      ),
    ]);
    const user = unwrapData<User>(userResponse.data);
    const instances = unwrapArray<UserInstance>(instancesResponse.data);

    if (!user) {
      throw new Error("Your Zesty user profile could not be loaded.");
    }

    if (!instances.some(userHasAppInstanceAccess)) {
      throw new Error(
        "Your Zesty account does not have access to this DocuStream instance.",
      );
    }

    return {
      token,
      user,
    };
  } catch (error) {
    throw new Error(getRequestErrorMessage(error), { cause: error });
  }
}

export async function logoutSession(token = readStoredSessionToken()) {
  if (!token) {
    return;
  }

  await axiosInstance
    .post(`${AUTH_API_BASE_URL}/logout`, undefined, createSessionRequestConfig(token))
    .catch(() => undefined);
}
