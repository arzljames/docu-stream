import axios from "axios";
import axiosInstance from "./axios-instance";

const RELEASE_NOTES_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/release_notes.json";

const publicReleaseNotesClient = axios.create({
  headers: {
    Accept: "application/json",
  },
});

export type ReleaseReportDocument = {
  category: "Backend" | "Frontend" | "Mobile";
  date: string;
  description: string;
  displayDate: string;
  fileExtension: string;
  fileUrl: string;
  id: string;
  subCategory: "Media" | "Project Documentation" | "RCA_Reports";
  subCategoryLabel: string;
  title: string;
};

export type ReleaseReportSubcategory = {
  documents: ReleaseReportDocument[];
  label: string;
  subCategory: ReleaseReportDocument["subCategory"];
  total: number;
};

export type ReleaseReportCategory = {
  category: ReleaseReportDocument["category"];
  categoryLabel: string;
  documents: ReleaseReportDocument[];
  subcategories: ReleaseReportSubcategory[];
  total: number;
};

export type MonthlyReleaseReport = {
  categories: ReleaseReportCategory[];
  generatedAt: string;
  html: string;
  month: string;
  monthLabel: string;
  totalDocuments: number;
};

export type MonthlyReleaseNoteApprover = {
  email: string;
  name: string;
};

export type CreateMonthlyReleaseNoteInput = {
  approver: MonthlyReleaseNoteApprover;
  month: string;
};

export type MonthlyReleaseNoteCreation = {
  dateGenerated: string;
  item: unknown;
  pathPart: string;
  releaseMonthDate: string;
  report: MonthlyReleaseReport;
};

export type ApproveMonthlyReleaseNoteInput = {
  itemZuid: string;
};

export type ReleaseNoteListItem = {
  data: {
    approver_email: string;
    approver_name: string;
    date_generated: string;
    generated_by_email: string;
    generated_by_name: string;
    is_approved: string | boolean | number;
    notes: string;
    release_month_date: string;
  };
  meta: {
    contentModelZUID: string;
    createdAt?: string;
    masterZUID: string;
    updatedAt?: string;
    ZUID: string;
  };
};

export type ReleaseNoteListResponse = {
  _meta: {
    limit: number;
    page: number;
    pages: number;
    skip: number;
    sortBy: string;
    sortOrder: string;
    totalItems: number;
  };
  data: ReleaseNoteListItem[];
};

type MonthlyReleaseNoteCreationResponse = {
  data: MonthlyReleaseNoteCreation;
};

type MonthlyReleaseNoteApproval = {
  coda: unknown;
  item: unknown;
  note: ReleaseNoteListItem;
};

type MonthlyReleaseNoteApprovalResponse = {
  data: MonthlyReleaseNoteApproval;
};

type CodaPostResponse = {
  data: {
    coda: unknown;
    report: MonthlyReleaseReport;
  };
};

export const releaseNoteQueryKeys = {
  all: ["release-notes"] as const,
  list: () => [...releaseNoteQueryKeys.all, "list"] as const,
  pending: (email: string) =>
    [...releaseNoteQueryKeys.all, "pending", email] as const,
};

export function getServiceErrorMessage(
  error: unknown,
  fallback = "Request failed.",
) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;

    if (typeof responseMessage === "string" && responseMessage.length > 0) {
      return responseMessage;
    }
  }

  return error instanceof Error && error.message.length > 0
    ? error.message
    : fallback;
}

export function isAuthenticationError(error: unknown) {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 401 || error.response?.status === 403)
  );
}

export async function createMonthlyReleaseNote(
  input: CreateMonthlyReleaseNoteInput,
) {
  const response = await axiosInstance.post<MonthlyReleaseNoteCreationResponse>(
    "/api/reports/monthly-release",
    {
      approverEmail: input.approver.email,
      approverName: input.approver.name,
      month: input.month,
    },
  );

  return response.data.data;
}

export async function approveMonthlyReleaseNote(
  input: ApproveMonthlyReleaseNoteInput,
) {
  const response =
    await axiosInstance.patch<MonthlyReleaseNoteApprovalResponse>(
      "/api/reports/monthly-release/approve",
      {
        itemZuid: input.itemZuid,
      },
    );

  return response.data.data;
}

export async function listReleaseNotes() {
  const response =
    await publicReleaseNotesClient.get<ReleaseNoteListResponse>(
      RELEASE_NOTES_ENDPOINT,
    );

  return response.data;
}

export async function listReleaseNotesForApproval(email: string) {
  const response =
    await publicReleaseNotesClient.get<ReleaseNoteListResponse>(
      RELEASE_NOTES_ENDPOINT,
      {
        params: { email },
      },
    );

  return response.data;
}

export async function postMonthlyReleaseReportToCoda(month: string) {
  const response = await axiosInstance.post<CodaPostResponse>(
    "/api/reports/monthly-release/coda",
    { month },
  );

  return response.data.data;
}
