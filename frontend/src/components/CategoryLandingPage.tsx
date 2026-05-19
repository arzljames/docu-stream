import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconAlertCircle,
  IconCalendar,
  IconExternalLink,
  IconFileText,
  IconFolder,
  IconPhoto,
  IconUpload,
  IconUser,
  IconVideo,
} from "@tabler/icons-react";
import mediaPreviewFallback from "@/assets/hero.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentList } from "@/hooks/use-document-list";
import type { DocumentListItem, DocumentListParams } from "@/lib/services";
import { useUploadDocumentAction } from "@/lib/upload-document-action";
import { cn } from "@/lib/utils";

const DocumentViewerModal = lazy(
  () => import("@/components/DocumentViewerModal"),
);

type CategoryRoute =
  | "/mobile/project-documentation"
  | "/mobile/rca-reports"
  | "/mobile/media"
  | "/frontend/project-documentation"
  | "/frontend/rca-reports"
  | "/frontend/media"
  | "/backend/project-documentation"
  | "/backend/rca-reports"
  | "/backend/media";

type CategoryIcon = typeof IconFileText;

type FolderItem = {
  label: string;
  description: string;
  to: CategoryRoute;
  icon: CategoryIcon;
};

type DocumentItem = {
  accent?: "red" | "green";
  author?: string;
  date?: string;
  description: string;
  fileExtension: string;
  fileUrl: string;
  id: string;
  mediaType?: "Image" | "Video";
  previewUrl?: string;
  size?: string;
  subCategory?: string;
  tag: string;
  title: string;
};

type CategoryLandingPageProps = {
  description: string;
  folders?: FolderItem[];
  icon: CategoryIcon;
  query?: DocumentListParams;
  title: string;
  variant?: "documents" | "media";
};

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const VIDEO_EXTENSIONS = new Set(["avi", "mov", "mp4", "mpeg", "ogg", "webm"]);

export function CategoryLandingPage({
  title,
  description,
  icon: Icon,
  folders = [],
  query = {},
  variant = "documents",
}: CategoryLandingPageProps) {
  const handleUploadClick = useUploadDocumentAction();
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(
    null,
  );
  const { data, error, isError, isLoading } = useDocumentList(query);
  const documents = useMemo(
    () =>
      (data?.data ?? []).map((item) =>
        mapDocumentListItemToCard(item, variant),
      ),
    [data?.data, variant],
  );
  const documentCount = data?._meta.totalItems ?? documents.length;

  return (
    <section className="min-h-full w-full bg-[#f8fafc] px-6 py-9 text-slate-950 md:px-14">
      <div className="mx-auto w-full max-w-375">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eceafe] text-[#4f46e5]">
            <Icon className="size-5" stroke={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none text-slate-950">
              {title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
            <p className="mt-4 text-sm text-slate-600">
              {isLoading
                ? "Loading documents..."
                : `${documentCount} ${
                    documentCount === 1 ? "document" : "documents"
                  }`}
            </p>
          </div>
        </div>

        {folders.length > 0 ? (
          <div className="mt-8">
            <h2 className="mb-6 text-xs font-semibold uppercase text-slate-500">
              Folders
            </h2>
            <div className="flex flex-wrap gap-4">
              {folders.map((folder) => (
                <Link
                  className="group relative flex min-h-24 w-full max-w-90 items-center gap-3 overflow-hidden rounded-lg border border-[#d8d5fb] bg-[#f3f2ff] p-4 transition-colors hover:border-[#8b83ee] hover:bg-[#eceafe]"
                  key={folder.to}
                  to={folder.to}
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-[#4f46e5]" />
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#4f46e5] shadow-sm ring-1 ring-[#d8d5fb] transition-colors group-hover:ring-[#8b83ee]">
                    <folder.icon className="size-5" stroke={2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[#1d1a9d]">
                      {folder.label}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                      {folder.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-14">
              <h2 className="text-xs font-semibold uppercase text-slate-500">
                Files
              </h2>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "grid gap-4",
            variant === "media"
              ? "md:grid-cols-2 xl:grid-cols-3"
              : "lg:grid-cols-2 xl:grid-cols-3",
            folders.length > 0 ? "mt-6" : "mt-8",
          )}
        >
          {isLoading ? (
            <DocumentSkeletonCards variant={variant} />
          ) : isError ? (
            <DocumentListError error={error} />
          ) : documents.length > 0 ? (
            documents.map((document) => (
              <DocumentCard
                document={document}
                key={document.id}
                onView={() => setSelectedDocument(document)}
                variant={variant}
              />
            ))
          ) : (
            <DocumentListEmpty
              onUploadClick={handleUploadClick}
              title={title}
              variant={variant}
            />
          )}
        </div>
        {selectedDocument ? (
          <Suspense fallback={null}>
            <DocumentViewerModal
              document={selectedDocument}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                  setSelectedDocument(null);
                }
              }}
              open={Boolean(selectedDocument)}
            />
          </Suspense>
        ) : null}
      </div>
    </section>
  );
}

function mapDocumentListItemToCard(
  item: DocumentListItem,
  variant: "documents" | "media",
): DocumentItem {
  const fileExtension = getFileExtension(item.data.file);
  const mediaType = variant === "media" ? getMediaType(fileExtension) : undefined;

  return {
    accent: item.data.sub_category === "RCA_Reports" ? "red" : "green",
    author: item.data.author || undefined,
    date: formatDateTime(item.meta.updatedAt ?? item.meta.createdAt),
    description: item.data.description || "No description provided.",
    fileExtension: fileExtension || "FILE",
    fileUrl: item.data.file,
    id: item.meta.ZUID,
    mediaType,
    previewUrl:
      variant === "media" && mediaType === "Image" ? item.data.file : undefined,
    subCategory: formatSubcategory(item.data.sub_category),
    tag: item.data.category,
    title: item.data.title || "Untitled document",
  };
}

function getFileExtension(filePath: string) {
  const cleanPath = filePath.split(/[?#]/)[0] ?? "";
  const fileName = cleanPath.split("/").pop() ?? "";
  const extension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];

  return extension ? extension.toUpperCase() : "";
}

function getMediaType(fileExtension: string) {
  const extension = fileExtension.toLowerCase();

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "Video";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "Image";
  }

  return "Image";
}

function formatDateTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSubcategory(subCategory: string) {
  return subCategory === "RCA_Reports" ? "RCA / Reports" : subCategory;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "The document list could not be loaded.";
}

function DocumentSkeletonCards({
  variant,
}: {
  variant: "documents" | "media";
}) {
  return Array.from({ length: 6 }, (_, index) => (
    <article
      className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
      key={index}
    >
      {variant === "media" ? (
        <Skeleton className="-mx-4 -mt-4 mb-4 h-40 rounded-b-none bg-slate-200" />
      ) : null}
      <div className="flex gap-3">
        {variant === "documents" ? (
          <Skeleton className="size-9 shrink-0 bg-slate-200" />
        ) : null}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3 bg-slate-200" />
          <Skeleton className="h-4 w-full bg-slate-200" />
          <Skeleton className="h-4 w-4/5 bg-slate-200" />
        </div>
      </div>
      <Skeleton className="mt-5 h-3 w-full bg-slate-200" />
    </article>
  ));
}

function DocumentListError({ error }: { error: unknown }) {
  return (
    <div className="col-span-full flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
      <IconAlertCircle className="mt-0.5 size-5 shrink-0" stroke={2} />
      <div>
        <h2 className="text-sm font-semibold">Unable to load documents</h2>
        <p className="mt-1 text-sm text-red-700">{getErrorMessage(error)}</p>
      </div>
    </div>
  );
}

function DocumentListEmpty({
  onUploadClick,
  title,
  variant,
}: {
  onUploadClick: () => void;
  title: string;
  variant: "documents" | "media";
}) {
  const itemLabel = variant === "media" ? "media files" : "documents";

  return (
    <div className="col-span-full flex min-h-[360px] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500">
        <IconFileText className="size-7" stroke={1.8} />
      </div>
      <h2 className="mt-5 text-base font-semibold text-slate-950">
        No {itemLabel} in {title}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Upload your first document to get started.
      </p>
      <Button
        className="mt-6 h-8 rounded-lg bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#4338ca]"
        onClick={onUploadClick}
        type="button"
      >
        <IconUpload className="size-4" stroke={2} />
        Upload Document
      </Button>
    </div>
  );
}

function DocumentCard({
  document,
  onView,
  variant,
}: {
  document: DocumentItem;
  onView: () => void;
  variant: "documents" | "media";
}) {
  if (variant === "media") {
    return <MediaCard document={document} onView={onView} />;
  }

  return <StandardDocumentCard document={document} onView={onView} />;
}

function handleDocumentCardKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  onView: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onView();
  }
}

function StandardDocumentCard({
  document,
  onView,
}: {
  document: DocumentItem;
  onView: () => void;
}) {
  return (
    <article
      aria-label={`View ${document.title}`}
      className="flex min-h-40 cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-[#d8d5fb] hover:shadow-md focus:outline-none focus-visible:border-[#8b83ee] focus-visible:ring-3 focus-visible:ring-[#eceafe]"
      onClick={onView}
      onKeyDown={(event) => handleDocumentCardKeyDown(event, onView)}
      role="button"
      tabIndex={0}
    >
      <div className="flex gap-3 pb-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <IconFileText
            className={cn(
              "size-4",
              document.accent === "green" ? "text-emerald-500" : "text-red-500",
            )}
            stroke={1.8}
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-slate-950">
            {document.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
            {document.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-orange-600">
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
        </div>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 text-[11px] text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconUser className="size-3.5 shrink-0" stroke={1.7} />
            <span className="truncate">{document.author ?? "DocuStream"}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <IconCalendar className="size-3.5" stroke={1.7} />
            {document.date ?? "N/A"}
          </span>
          <span>{document.size ?? "N/A"}</span>
        </div>
      </div>
    </article>
  );
}

function MediaCard({
  document,
  onView,
}: {
  document: DocumentItem;
  onView: () => void;
}) {
  const MediaIcon = document.mediaType === "Video" ? IconVideo : IconPhoto;

  return (
    <article
      aria-label={`View ${document.title}`}
      className="cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md shadow-slate-200/80 transition hover:-translate-y-0.5 hover:border-[#d8d5fb] hover:shadow-lg focus:outline-none focus-visible:border-[#8b83ee] focus-visible:ring-3 focus-visible:ring-[#eceafe]"
      onClick={onView}
      onKeyDown={(event) => handleDocumentCardKeyDown(event, onView)}
      role="button"
      tabIndex={0}
    >
      <div className="relative h-40 overflow-hidden bg-[#dfe7e6]">
        <img
          alt=""
          className="h-full w-full object-cover"
          src={document.previewUrl ?? mediaPreviewFallback}
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-[#1d4ed8] shadow-sm">
          <MediaIcon className="size-3.5" stroke={2} />
          {document.mediaType ?? "Image"}
        </span>
        <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md bg-slate-900/70 text-white shadow-lg">
          <IconExternalLink className="size-5" stroke={2} />
        </span>
      </div>

      <div className="p-4">
        <h2 className="truncate text-sm font-semibold text-[#1d4ed8]">
          {document.title}
        </h2>
        <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">
          {document.description}
        </p>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 text-[11px] text-slate-500">
          <span className="flex min-w-0 items-center gap-1.5">
            <IconUser className="size-3.5 shrink-0" stroke={1.7} />
            <span className="truncate">{document.author ?? "DocuStream"}</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <IconCalendar className="size-3.5" stroke={1.7} />
            {document.date ?? "N/A"}
          </span>
          <span className="whitespace-nowrap">{document.size ?? "N/A"}</span>
        </div>
      </div>
    </article>
  );
}

export function buildCategoryFolders(
  basePath: "/mobile" | "/frontend" | "/backend",
) {
  return [
    {
      label: "Project Documentation",
      description: "Guides, setup notes, and implementation references.",
      to: `${basePath}/project-documentation` as CategoryRoute,
      icon: IconFolder,
    },
    {
      label: "RCA / Reports",
      description: "Incident writeups, analysis, and status reports.",
      to: `${basePath}/rca-reports` as CategoryRoute,
      icon: IconFileText,
    },
    {
      label: "Media",
      description: "Images, recordings, diagrams, and supporting assets.",
      to: `${basePath}/media` as CategoryRoute,
      icon: IconFolder,
    },
  ];
}
