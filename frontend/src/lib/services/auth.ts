import axios from "axios";
import axiosInstance from "./axios-instance";
import { readStoredSessionToken } from "./session-token";

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

export type AuthenticatedSession = {
  token: string;
  user: User;
};

type AuthenticatedSessionResponse = {
  data: AuthenticatedSession;
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

function createSessionRequestConfig(token: string) {
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
    const response = await axiosInstance.post<AuthenticatedSessionResponse>(
      "/api/auth/session",
      undefined,
      createSessionRequestConfig(token),
    );

    return response.data.data;
  } catch (error) {
    throw new Error(getRequestErrorMessage(error), { cause: error });
  }
}

export async function logoutSession(token = readStoredSessionToken()) {
  if (!token) {
    return;
  }

  await axiosInstance
    .post("/api/auth/logout", undefined, createSessionRequestConfig(token))
    .catch(() => undefined);
}
