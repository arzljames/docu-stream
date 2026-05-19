import { useQuery } from "@tanstack/react-query";
import {
  documentQueryKeys,
  listDocuments,
  type DocumentListParams,
} from "@/lib/services";

export function useDocumentList(params: DocumentListParams = {}) {
  return useQuery({
    queryFn: () => listDocuments(params),
    queryKey: documentQueryKeys.list(params),
    staleTime: 30_000,
  });
}
