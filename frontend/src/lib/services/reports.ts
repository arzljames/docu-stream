import axios from "axios";
import axiosInstance from "./axios-instance";

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

type MonthlyReleaseReportResponse = {
  data: MonthlyReleaseReport;
};

type CodaPostResponse = {
  data: {
    coda: unknown;
    report: MonthlyReleaseReport;
  };
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

export async function generateMonthlyReleaseReport(month: string) {
  const response = await axiosInstance.post<MonthlyReleaseReportResponse>(
    "/api/reports/monthly-release",
    { month },
  );

  return response.data.data;
}

export async function postMonthlyReleaseReportToCoda(month: string) {
  const response = await axiosInstance.post<CodaPostResponse>(
    "/api/reports/monthly-release/coda",
    { month },
  );

  return response.data.data;
}
