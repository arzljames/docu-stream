import { createContext, useContext, type ReactNode } from "react";

type UploadDocumentAction = () => void;

const UploadDocumentActionContext =
  createContext<UploadDocumentAction | null>(null);

export function UploadDocumentActionProvider({
  children,
  onUpload,
}: {
  children: ReactNode;
  onUpload: UploadDocumentAction;
}) {
  return (
    <UploadDocumentActionContext.Provider value={onUpload}>
      {children}
    </UploadDocumentActionContext.Provider>
  );
}

export function useUploadDocumentAction() {
  return useContext(UploadDocumentActionContext) ?? (() => undefined);
}
