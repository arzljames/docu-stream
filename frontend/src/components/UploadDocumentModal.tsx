import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconFileUpload, IconInfoCircle, IconUpload } from "@tabler/icons-react";
import axios from "axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { documentQueryKeys, uploadDocument } from "@/lib/services";
import { cn } from "@/lib/utils";

type UploadDocumentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CategoryValue = "Backend" | "Frontend" | "Mobile";
type SubcategoryValue = "Media" | "Project Documentation" | "RCA_Reports";
type UploadFileKind = "document" | "media";

const EMPTY_VALUE = "none";
const MEDIA_ACCEPT = "image/*,video/*";
const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.rtf,.odt,.ppt,.pptx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv";
const ALL_ACCEPT = `${DOCUMENT_ACCEPT},${MEDIA_ACCEPT}`;
const DOCUMENT_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "md",
  "odt",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]);

const CATEGORIES = [
  {
    value: "Mobile",
    label: "Mobile",
    path: "/mobile",
    subcategories: [
      {
        value: "Project Documentation",
        label: "Project Documentation",
        path: "/mobile/project-documentation",
      },
      {
        value: "RCA_Reports",
        label: "RCA / Reports",
        path: "/mobile/rca-reports",
      },
      { value: "Media", label: "Media", path: "/mobile/media" },
    ],
  },
  {
    value: "Frontend",
    label: "Frontend",
    path: "/frontend",
    subcategories: [
      {
        value: "Project Documentation",
        label: "Project Documentation",
        path: "/frontend/project-documentation",
      },
      {
        value: "RCA_Reports",
        label: "RCA / Reports",
        path: "/frontend/rca-reports",
      },
      { value: "Media", label: "Media", path: "/frontend/media" },
    ],
  },
  {
    value: "Backend",
    label: "Backend",
    path: "/backend",
    subcategories: [
      {
        value: "Project Documentation",
        label: "Project Documentation",
        path: "/backend/project-documentation",
      },
      {
        value: "RCA_Reports",
        label: "RCA / Reports",
        path: "/backend/rca-reports",
      },
      { value: "Media", label: "Media", path: "/backend/media" },
    ],
  },
] satisfies Array<{
  value: CategoryValue;
  label: string;
  path: string;
  subcategories: Array<{
    value: SubcategoryValue;
    label: string;
    path: string;
  }>;
}>;

function getRouteDefaults(pathname: string) {
  for (const category of CATEGORIES) {
    const subcategory = category.subcategories.find(
      (item) => item.path === pathname,
    );

    if (subcategory) {
      return {
        category: category.value,
        subcategory: subcategory.value,
      };
    }

    if (category.path === pathname) {
      return {
        category: category.value,
        subcategory: "",
      };
    }
  }

  return {
    category: "",
    subcategory: "",
  };
}

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseMessage = error.response?.data?.message;

    if (typeof responseMessage === "string" && responseMessage.length > 0) {
      return responseMessage;
    }
  }

  return error instanceof Error && error.message.length > 0
    ? error.message
    : "Upload failed.";
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop();

  return extension ? extension.toLowerCase() : "";
}

function getUploadFileKind(file: File): UploadFileKind | null {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return "media";
  }

  if (
    file.type.startsWith("text/") ||
    file.type === "application/pdf" ||
    file.type.includes("document") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("presentation") ||
    DOCUMENT_EXTENSIONS.has(getFileExtension(file.name))
  ) {
    return "document";
  }

  return null;
}

function isDocumentSubcategory(subcategory: SubcategoryValue | "") {
  return subcategory === "Project Documentation" || subcategory === "RCA_Reports";
}

function isSubcategoryAllowedForFileKind(
  subcategory: SubcategoryValue,
  fileKind: UploadFileKind | null,
) {
  if (!fileKind) {
    return true;
  }

  return fileKind === "media"
    ? subcategory === "Media"
    : isDocumentSubcategory(subcategory);
}

function isFileAllowedForSubcategory(
  fileKind: UploadFileKind,
  subcategory: SubcategoryValue | "",
) {
  if (!subcategory) {
    return true;
  }

  return subcategory === "Media"
    ? fileKind === "media"
    : fileKind === "document";
}

function getFileRestrictionMessage(subcategory: SubcategoryValue | "") {
  if (subcategory === "Media") {
    return "Media only accepts image and video files.";
  }

  if (isDocumentSubcategory(subcategory)) {
    return "Project Documentation and RCA / Reports only accept document files.";
  }

  return "Choose an image, video, or document file.";
}

export function UploadDocumentModal({
  open,
  onOpenChange,
}: UploadDocumentModalProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryValue | "">("");
  const [subcategory, setSubcategory] = useState<SubcategoryValue | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    isPending: isUploading,
    mutate: upload,
    reset: resetUpload,
  } = useMutation({
    mutationFn: uploadDocument,
    onError: (error) => {
      setUploadError(getErrorMessage(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentQueryKeys.lists(),
      });
      onOpenChange(false);
      toast({
        description: `${title} has been added to DocuStream.`,
        title: "Document uploaded",
        variant: "success",
      });
    },
  });

  const selectedCategory = useMemo(
    () => CATEGORIES.find((item) => item.value === category),
    [category],
  );
  const selectedFileKind = selectedFile
    ? getUploadFileKind(selectedFile)
    : null;
  const fileInputAccept =
    subcategory === "Media"
      ? MEDIA_ACCEPT
      : isDocumentSubcategory(subcategory) || selectedFileKind === "document"
        ? DOCUMENT_ACCEPT
        : selectedFileKind === "media"
          ? MEDIA_ACCEPT
          : ALL_ACCEPT;

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaults = getRouteDefaults(pathname);
    setTitle("");
    setDescription("");
    setCategory(defaults.category as CategoryValue | "");
    setSubcategory(defaults.subcategory as SubcategoryValue | "");
    setSelectedFile(null);
    setSelectedFileName("");
    setIsDraggingFile(false);
    setUploadError("");
    resetUpload();
  }, [open, pathname, resetUpload]);

  function handleCategoryChange(nextCategory: string) {
    setCategory(
      nextCategory === EMPTY_VALUE ? "" : (nextCategory as CategoryValue),
    );
    setSubcategory(selectedFileKind === "media" ? "Media" : "");
  }

  function handleSubcategoryChange(nextSubcategory: string) {
    const nextValue =
      nextSubcategory === EMPTY_VALUE
        ? ""
        : (nextSubcategory as SubcategoryValue);

    if (
      selectedFileKind &&
      nextValue &&
      !isFileAllowedForSubcategory(selectedFileKind, nextValue)
    ) {
      setSelectedFile(null);
      setSelectedFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setUploadError(getFileRestrictionMessage(nextValue));
    }

    setSubcategory(nextValue);
  }

  function handleFile(file?: File) {
    if (!file) {
      return;
    }

    const fileKind = getUploadFileKind(file);

    if (!fileKind) {
      setUploadError("Choose an image, video, or document file.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (!isFileAllowedForSubcategory(fileKind, subcategory)) {
      setUploadError(getFileRestrictionMessage(subcategory));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setUploadError("");

    if (fileKind === "media") {
      setSubcategory("Media");
      return;
    }

    if (subcategory === "Media") {
      setSubcategory("");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    if (!title.trim() || !category || !subcategory) {
      setUploadError("Complete the title, category, and subcategory fields.");
      return;
    }

    const fileKind = getUploadFileKind(selectedFile);

    if (!fileKind || !isFileAllowedForSubcategory(fileKind, subcategory)) {
      setUploadError(getFileRestrictionMessage(subcategory));
      return;
    }

    setUploadError("");

    upload({
      category,
      description,
      file: selectedFile,
      subCategory: subcategory,
      title,
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="w-full max-w-[512px] gap-0 rounded-lg border-slate-200 bg-white p-6 text-slate-950 shadow-2xl sm:max-w-[512px]"
        showCloseButton
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="gap-0 pr-9">
            <DialogTitle className="text-lg font-semibold text-slate-950">
              Upload Document
            </DialogTitle>
            <DialogDescription className="mt-3 text-sm text-slate-500">
              Add a new document to the documentation portal.
            </DialogDescription>
          </DialogHeader>

          {uploadError ? (
            <Alert className="mt-5 border-red-200 bg-red-50 px-3 py-3 text-red-900">
              <IconInfoCircle className="size-4" stroke={2} />
              <AlertTitle className="text-sm font-semibold">
                Upload failed
              </AlertTitle>
              <AlertDescription className="text-sm text-red-700">
                {uploadError}
              </AlertDescription>
            </Alert>
          ) : null}

          <Label
            className={cn(
              "mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition-colors",
              isDraggingFile && "border-[#8b83ee] bg-[#f3f2ff]",
            )}
            htmlFor="document-upload-file"
            onDragLeave={() => setIsDraggingFile(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFile(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingFile(false);
              handleFile(event.dataTransfer.files[0]);
            }}
          >
            <Input
              className="sr-only"
              id="document-upload-file"
              accept={fileInputAccept}
              onChange={(event) => handleFile(event.target.files?.[0])}
              ref={fileInputRef}
              required
              type="file"
            />
            <IconFileUpload className="size-8 text-slate-500" stroke={1.8} />
            <span className="mt-3 text-sm font-medium text-slate-500">
              {selectedFileName ? selectedFileName : "Drop your file here or "}
              {!selectedFileName ? (
                <Button
                  className="h-auto p-0 align-baseline font-semibold text-[#4f46e5] hover:text-[#4338ca] hover:no-underline"
                  onClick={(event) => {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }}
                  type="button"
                  variant="link"
                >
                  browse
                </Button>
              ) : null}
            </span>
            <span className="mt-2 text-xs font-medium text-slate-500">
              {getFileRestrictionMessage(subcategory)}
            </span>
          </Label>

          <div className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="document-upload-title">Title</Label>
              <Input
                className="h-9 border-slate-200 bg-white px-3 text-slate-950 shadow-sm placeholder:text-slate-500 focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe]"
                id="document-upload-title"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Document title"
                required
                value={title}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  onValueChange={handleCategoryChange}
                  value={category || EMPTY_VALUE}
                >
                  <SelectTrigger className="h-9 w-full border-slate-200 bg-white px-3 text-slate-950 shadow-sm focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_VALUE}>Category</SelectItem>
                    {CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select
                  disabled={!selectedCategory}
                  onValueChange={handleSubcategoryChange}
                  value={subcategory || EMPTY_VALUE}
                >
                  <SelectTrigger className="h-9 w-full border-slate-200 bg-white px-3 text-slate-950 shadow-sm focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe] disabled:bg-slate-50 disabled:text-slate-400">
                    <SelectValue placeholder="Subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      disabled={selectedFileKind === "media"}
                      value={EMPTY_VALUE}
                    >
                      Subcategory
                    </SelectItem>
                    {selectedCategory?.subcategories.map((item) => (
                      <SelectItem
                        disabled={
                          !isSubcategoryAllowedForFileKind(
                            item.value,
                            selectedFileKind,
                          )
                        }
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-upload-description">
                Description (optional)
              </Label>
              <Textarea
                className="min-h-20 resize-y border-slate-200 bg-white px-3 py-2 text-slate-950 shadow-sm placeholder:text-slate-500 focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe]"
                id="document-upload-description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Brief description of this document..."
                value={description}
              />
            </div>
          </div>

          <DialogFooter className="mt-5 -mx-0 -mb-0 flex-row justify-end border-0 bg-transparent p-0">
            <DialogClose asChild>
              <Button
                className="h-9 border-slate-200 bg-white px-4 text-slate-900 shadow-sm hover:bg-slate-50"
                disabled={isUploading}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              className="h-9 bg-[#8b83ee] px-4 text-white shadow-sm hover:bg-[#746ce0]"
              disabled={isUploading}
              type="submit"
            >
              <IconUpload className="size-4" stroke={2} />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
