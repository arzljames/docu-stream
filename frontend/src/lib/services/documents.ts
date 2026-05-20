import axios from "axios";

const DOCUMENT_LIST_ENDPOINT =
  "https://17vd2mpt-dev.webengine.zesty.io/datasets/document_list.json";

const publicDocumentsClient = axios.create({
  headers: {
    Accept: "application/json",
  },
});

export type DocumentCategory = "Backend" | "Frontend" | "Mobile";
export type DocumentSubCategory =
  | "Media"
  | "Project Documentation"
  | "RCA_Reports";

export type DocumentListParams = {
  category?: DocumentCategory;
  limit?: number;
  search?: string;
  skip?: number;
  sort_by?: "date" | "title";
  sort_order?: "asc" | "desc";
  sub_category?: DocumentSubCategory;
};

export type DocumentListItem = {
  data: {
    author?: string;
    category: DocumentCategory;
    description: string;
    document_date_created?: string;
    file: string;
    sub_category: DocumentSubCategory;
    title: string;
  };
  meta: {
    createdAt?: string;
    ZUID: string;
    contentModelZUID: string;
    masterZUID: string;
    updatedAt?: string;
  };
};

export type DocumentListResponse = {
  _meta: {
    limit: number;
    page: number;
    pages: number;
    search: string;
    skip: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    totalItems: number;
  };
  data: DocumentListItem[];
};

export const documentQueryKeys = {
  all: ["documents"] as const,
  list: (params: DocumentListParams = {}) =>
    [...documentQueryKeys.lists(), cleanDocumentListParams(params)] as const,
  lists: () => [...documentQueryKeys.all, "list"] as const,
};

function cleanDocumentListParams(params: DocumentListParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      return value !== undefined && value !== null && value !== "";
    }),
  ) as DocumentListParams;
}

export async function listDocuments(params: DocumentListParams = {}) {
  const queryParams = cleanDocumentListParams(params);
  const response = await publicDocumentsClient.get<DocumentListResponse>(
    DOCUMENT_LIST_ENDPOINT,
    {
      params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    },
  );

  return response.data;
}
