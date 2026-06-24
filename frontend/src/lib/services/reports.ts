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
  date: string;
  dateLabel: string;
  displayDate: string;
  id: string;
  itemId: string;
  subcategory: string;
  title: string;
  url: string;
};

export type ReleaseReportSubcategory = {
  items: ReleaseReportDocument[];
  label: string;
  total: number;
};

export type ReleaseReportCategory = {
  category: "projects" | "tasks";
  categoryLabel: string;
  emptyMessage: string;
  items: ReleaseReportDocument[];
  subcategories: ReleaseReportSubcategory[];
  total: number;
};

export type MonthlyReleaseReport = {
  categories: ReleaseReportCategory[];
  generatedAt: string;
  html: string;
  month: string;
  monthLabel: string;
  totalItems: number;
};

export type CodaCellValue =
  | boolean
  | number
  | string
  | null
  | CodaCellValue[]
  | { [key: string]: CodaCellValue };

export type MonthlyReleaseCodaRow = {
  browserLink?: string;
  href?: string;
  id?: string;
  name?: string;
  values?: Record<string, CodaCellValue>;
};

export type MonthlyReleaseCodaSourceRows = {
  generatedAt?: string;
  projects: MonthlyReleaseCodaRow[];
  tasks: MonthlyReleaseCodaRow[];
};

export type MonthlyReleaseCodaSource = MonthlyReleaseCodaSourceRows & {
  generatedAt: string;
};

export type MonthlyReleaseNoteApprover = {
  email: string;
  name: string;
};

export type CreateMonthlyReleaseNoteInput = {
  approver: MonthlyReleaseNoteApprover;
  month: string;
  sourceRows: MonthlyReleaseCodaSourceRows;
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

type MonthlyReleaseCodaSourceResponse = {
  data: MonthlyReleaseCodaSource;
};

export const releaseNoteQueryKeys = {
  all: ["release-notes"] as const,
  codaSource: () => [...releaseNoteQueryKeys.all, "coda-source"] as const,
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
      sourceRows: input.sourceRows,
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

export async function listMonthlyReleaseCodaSource() {
  const response = await axiosInstance.get<MonthlyReleaseCodaSourceResponse>(
    "/api/reports/monthly-release/source",
  );

  return response.data.data;
}

export async function postMonthlyReleaseReportToCoda(
  month: string,
  sourceRows?: MonthlyReleaseCodaSourceRows,
) {
  const response = await axiosInstance.post<CodaPostResponse>(
    "/api/reports/monthly-release/coda",
    { month, sourceRows },
  );

  return response.data.data;
}
