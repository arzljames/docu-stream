import { useMemo } from "react";
import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import type { IDocument } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";
import {
  IconExternalLink,
  IconFileDescription,
  IconFileText,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ViewerDocument = {
  description: string;
  fileExtension: string;
  fileUrl: string;
  subCategory?: string;
  tag: string;
  title: string;
};

type DocumentViewerModalProps = {
  document: ViewerDocument | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const TEXT_EXTENSION_ALIASES = new Set([
  "json",
  "log",
  "markdown",
  "md",
  "xml",
  "yaml",
  "yml",
]);

const OFFICE_EXTENSION_ALIASES: Record<string, string> = {
  odp: "ppt",
  ods: "xls",
  rtf: "doc",
};

export function DocumentViewerModal({
  document,
  onOpenChange,
  open,
}: DocumentViewerModalProps) {
  const viewerDocuments = useMemo<IDocument[]>(() => {
    if (!document?.fileUrl) {
      return [];
    }

    return [
      {
        fileName: document.title,
        fileType: getViewerFileType(document.fileExtension),
        uri: document.fileUrl,
      },
    ];
  }, [document]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="grid h-[calc(100svh-0.5rem)] !w-[calc(100vw-0.5rem)] !max-w-[calc(100vw-0.5rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border-slate-200 bg-white p-0 text-slate-950 shadow-2xl sm:h-[calc(100svh-1rem)] sm:!w-[calc(100vw-1rem)] sm:!max-w-[calc(100vw-1rem)] sm:rounded-xl"
        showCloseButton
      >
        {document ? (
          <>
            <DialogHeader className="gap-0 border-b border-slate-200 px-5 py-4 pr-14">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-orange-600">
                      {document.tag}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-slate-800">
                      {document.fileExtension}
                    </span>
                    {document.subCategory ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-slate-800">
                        {document.subCategory}
                      </span>
                    ) : null}
                  </div>
                  <DialogTitle className="truncate text-lg font-semibold text-slate-950">
                    {document.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 line-clamp-2 max-w-3xl text-sm text-slate-500">
                    {document.description}
                  </DialogDescription>
                </div>
                <Button
                  asChild
                  className="h-8 shrink-0 rounded-lg border-slate-200 bg-white px-3 text-slate-900 shadow-sm hover:bg-slate-50"
                  variant="outline"
                >
                  <a
                    href={document.fileUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <IconExternalLink className="size-4" stroke={1.8} />
                    Open file
                  </a>
                </Button>
              </div>
            </DialogHeader>

            <div className="min-h-0 bg-slate-100 p-2 sm:p-4">
              <div className="h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-white [&_#header-bar]:hidden [&_#msdoc-iframe]:h-full [&_#msdoc-iframe]:w-full [&_#msdoc-renderer]:h-full [&_#msdoc-renderer]:w-full [&_#pdf-renderer]:h-full [&_#pdf-renderer]:min-h-0 [&_#pdf-renderer]:overflow-x-auto [&_#pdf-renderer]:overflow-y-auto [&_#proxy-renderer]:flex [&_#proxy-renderer]:h-full [&_#proxy-renderer]:min-h-0 [&_#proxy-renderer]:w-full [&_#proxy-renderer]:flex-1 [&_#proxy-renderer]:flex-col [&_#proxy-renderer]:overflow-hidden [&_#react-doc-viewer]:h-full [&_#react-doc-viewer]:w-full [&_#react-doc-viewer]:bg-white [&_iframe]:min-h-full">
                <DocViewer
                  className="h-full"
                  config={{
                    header: {
                      disableHeader: true,
                    },
                    noRenderer: {
                      overrideComponent: () => (
                        <UnsupportedDocumentPreview document={document} />
                      ),
                    },
                    pdfVerticalScrollByDefault: true,
                    pdfZoom: {
                      defaultZoom: 1,
                      zoomJump: 0.2,
                    },
                  }}
                  documents={viewerDocuments}
                  pluginRenderers={DocViewerRenderers}
                  prefetchMethod="GET"
                  style={{ height: "100%" }}
                  theme={{
                    primary: "#4f46e5",
                    secondary: "#e2e8f0",
                    tertiary: "#f8fafc",
                    textPrimary: "#0f172a",
                    textSecondary: "#475569",
                    textTertiary: "#64748b",
                  }}
                />
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getViewerFileType(fileExtension: string) {
  const extension = fileExtension.toLowerCase();

  if (TEXT_EXTENSION_ALIASES.has(extension)) {
    return "txt";
  }

  return OFFICE_EXTENSION_ALIASES[extension] ?? extension;
}

function UnsupportedDocumentPreview({
  document,
}: {
  document: ViewerDocument;
}) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {document.fileExtension === "FILE" ? (
          <IconFileDescription className="size-7" stroke={1.8} />
        ) : (
          <IconFileText className="size-7" stroke={1.8} />
        )}
      </div>
      <h2 className="mt-5 text-base font-semibold text-slate-950">
        Preview unavailable for {document.fileExtension}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Open the file in a new tab to view it with your browser or installed
        document tools.
      </p>
      <Button
        asChild
        className="mt-6 h-8 rounded-lg bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#4338ca]"
      >
        <a href={document.fileUrl} rel="noreferrer" target="_blank">
          <IconExternalLink className="size-4" stroke={1.8} />
          Open file
        </a>
      </Button>
    </div>
  );
}

export default DocumentViewerModal;
