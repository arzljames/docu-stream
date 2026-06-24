import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconCalendar,
  IconFileDescription,
  IconInfoCircle,
  IconSparkles,
  IconUserCheck,
  IconUserEdit,
  IconX,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { useToast } from "@/components/ui/toaster";
import { getSafeAppRoutePath } from "@/lib/app-routes";
import {
  approveMonthlyReleaseNote,
  createMonthlyReleaseNote,
  getServiceErrorMessage,
  instanceUserQueryKeys,
  isAuthenticationError,
  listMonthlyReleaseCodaSource,
  listInstanceUsers,
  listReleaseNotes,
  listReleaseNotesForApproval,
  releaseNoteQueryKeys,
  type MonthlyReleaseCodaSource,
  type MonthlyReleaseCodaSourceRows,
  type ReleaseNoteListItem,
} from "@/lib/services";
import { cn } from "@/lib/utils";
import useAppStore from "@/store/store";
import { useShallow } from "zustand/react/shallow";

export const Route = createFileRoute("/monthly-release-notes")({
  component: RouteComponent,
});

type ReleaseNoteFilter = "all" | "pending";

const CODA_PROJECT_DATE_COLUMN_ID = "c-IiOXYPAoC4";
const CODA_TASK_DATE_COLUMN_ID = "c-VvDTGrk0Ax";

function RouteComponent() {
  const navigate = useNavigate();
  const monthInputRef = useRef<HTMLInputElement>(null);
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [approver, setApprover] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReleaseNoteFilter>("all");
  const [selectedReleaseNote, setSelectedReleaseNote] =
    useState<ReleaseNoteListItem | null>(null);
  const [formError, setFormError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthLoading, isUserAuthenticated, isUserAuthorized, user } =
    useAppStore(
      useShallow((state) => ({
        isAuthLoading: state.isAuthLoading,
        isUserAuthenticated: state.isUserAuthenticated,
        isUserAuthorized: state.isUserAuthorized,
        user: state.user,
      })),
    );
  const canRunUserAction = isUserAuthenticated && isUserAuthorized;
  const currentUserEmail = user?.email ?? "";
  const redirectToSignIn = useCallback(() => {
    void navigate({
      search: {
        intent: "action",
        redirectTo: getSafeAppRoutePath("/monthly-release-notes"),
      },
      to: "/login",
    });
  }, [navigate]);
  const approverQuery = useQuery({
    enabled: !isAuthLoading && canRunUserAction,
    queryFn: listInstanceUsers,
    queryKey: instanceUserQueryKeys.list(),
  });
  const approvers = (approverQuery.data ?? []).filter(
    (item) => item.email.toLowerCase() !== currentUserEmail.toLowerCase(),
  );
  const selectedApprover = approvers.find((item) => item.id === approver);
  const codaSourceQuery = useQuery({
    enabled: !isAuthLoading && canRunUserAction,
    queryFn: listMonthlyReleaseCodaSource,
    queryKey: releaseNoteQueryKeys.codaSource(),
  });
  const filteredCodaRows = useMemo(
    () => filterCodaRowsByMonth(codaSourceQuery.data, month),
    [codaSourceQuery.data, month],
  );
  const filteredCodaRowCount =
    filteredCodaRows.projects.length + filteredCodaRows.tasks.length;
  const releaseNotesQuery = useQuery({
    queryFn: listReleaseNotes,
    queryKey: releaseNoteQueryKeys.list(),
  });
  const pendingReleaseNotesQuery = useQuery({
    enabled: Boolean(currentUserEmail),
    queryFn: () => listReleaseNotesForApproval(currentUserEmail),
    queryKey: releaseNoteQueryKeys.pending(currentUserEmail),
  });
  const createMutation = useMutation({
    mutationFn: createMonthlyReleaseNote,
    onError: (error) => {
      if (isAuthenticationError(error)) {
        redirectToSignIn();
        return;
      }

      const message = getServiceErrorMessage(
        error,
        "Release note creation failed.",
      );

      toast({
        description: message,
        title: getGenerationErrorTitle(message),
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: releaseNoteQueryKeys.all,
      });
      toast({
        description: `${created.report.monthLabel} release notes were created in Zesty.`,
        title: "Release notes created",
        variant: "success",
      });
    },
  });
  const approveMutation = useMutation({
    mutationFn: approveMonthlyReleaseNote,
    onError: (error) => {
      if (isAuthenticationError(error)) {
        redirectToSignIn();
        return;
      }

      toast({
        description: getServiceErrorMessage(
          error,
          "Release note approval failed.",
        ),
        title: "Approval failed",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: releaseNoteQueryKeys.all,
      });
      setSelectedReleaseNote(null);
      toast({
        description: "Release notes were approved and posted to Coda.",
        title: "Release notes approved",
        variant: "success",
      });
    },
  });
  const allReleaseNotes = releaseNotesQuery.data?.data ?? [];
  const pendingReleaseNotes = (pendingReleaseNotesQuery.data?.data ?? []).filter(
    (note) => !isReleaseNoteApproved(note.data.is_approved),
  );
  const visibleReleaseNotes =
    activeFilter === "pending" ? pendingReleaseNotes : allReleaseNotes;
  const visibleReleaseNotesQuery =
    activeFilter === "pending" ? pendingReleaseNotesQuery : releaseNotesQuery;
  const allReleaseNotesCount =
    releaseNotesQuery.data?._meta.totalItems ?? allReleaseNotes.length;
  const pendingCount = pendingReleaseNotes.length;
  const errorMessage = formError
    ? formError
    : approverQuery.isError
      ? getServiceErrorMessage(
          approverQuery.error,
          "Instance users could not be loaded.",
        )
    : releaseNotesQuery.isError
      ? getServiceErrorMessage(
          releaseNotesQuery.error,
          "Release notes could not be loaded.",
        )
    : codaSourceQuery.isError
      ? getServiceErrorMessage(
          codaSourceQuery.error,
          "Completed Coda rows could not be loaded.",
        )
    : pendingReleaseNotesQuery.isError
      ? getServiceErrorMessage(
          pendingReleaseNotesQuery.error,
          "Release notes for approval could not be loaded.",
        )
    : createMutation.isError
      ? getServiceErrorMessage(
          createMutation.error,
          "Release note creation failed.",
        )
      : "";
  const approverPlaceholder = isAuthLoading
    ? "Loading users..."
    : !canRunUserAction
      ? "Sign in to load users"
      : approverQuery.isLoading
        ? "Loading users..."
        : approverQuery.isError
          ? "Users unavailable"
          : approvers.length === 0
            ? "No users found"
            : "Select approver...";

  useEffect(() => {
    if (approverQuery.isError && isAuthenticationError(approverQuery.error)) {
      redirectToSignIn();
    }
  }, [approverQuery.error, approverQuery.isError, redirectToSignIn]);

  useEffect(() => {
    if (codaSourceQuery.isError && isAuthenticationError(codaSourceQuery.error)) {
      redirectToSignIn();
    }
  }, [codaSourceQuery.error, codaSourceQuery.isError, redirectToSignIn]);

  useEffect(() => {
    if (!approver || approvers.some((item) => item.id === approver)) {
      return;
    }

    setApprover("");
  }, [approver, approvers]);

  function openMonthPicker() {
    const input = monthInputRef.current;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  function handleGenerate() {
    if (isAuthLoading) {
      return;
    }

    if (!canRunUserAction) {
      redirectToSignIn();
      return;
    }

    if (!selectedApprover) {
      setFormError("Choose an approver before generating release notes.");
      return;
    }

    if (releaseNotesQuery.isLoading) {
      toast({
        description: "Wait for release notes to finish loading, then try again.",
        title: "Still checking",
      });
      return;
    }

    if (codaSourceQuery.isLoading) {
      toast({
        description: "Wait for completed Coda rows to finish loading.",
        title: "Still loading",
      });
      return;
    }

    if (codaSourceQuery.isError) {
      toast({
        description: getServiceErrorMessage(
          codaSourceQuery.error,
          "Completed Coda rows could not be loaded.",
        ),
        title: "Coda rows unavailable",
      });
      return;
    }

    if (hasReleaseNoteForMonth(allReleaseNotes, month)) {
      toast({
        description:
          "This month has already been generated. Choose another month to avoid duplicates.",
        title: "Already generated",
      });
      return;
    }

    if (filteredCodaRowCount === 0) {
      toast({
        description:
          "No completed Coda projects or tasks match the selected month.",
        title: "Nothing to generate",
      });
      return;
    }

    setFormError("");
    createMutation.mutate({
      approver: {
        email: selectedApprover.email,
        name: selectedApprover.name,
      },
      month,
      sourceRows: filteredCodaRows,
    });
  }

  return (
    <section className="min-h-full w-full bg-[#f8fafc] px-6 py-9 text-slate-950 md:px-14 pb-20">
      <div className="mx-auto w-full max-w-375 pb-6">
        <header className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eceafe] text-[#4f46e5]">
            <IconFileDescription className="size-5" stroke={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none text-slate-950">
              Monthly Release Notes
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Generate release notes from completed Coda projects and tasks.
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-lg bg-linear-to-r from-[#291b82] via-[#5c31d8] to-[#9e43f2] px-6 py-8 text-white shadow-sm md:px-8 md:py-9">
          <h2 className="text-3xl font-bold leading-tight md:text-4xl">
            Generate Release Notes
          </h2>

          <div className="mt-7 grid gap-4 md:grid-cols-[minmax(0,288px)_minmax(0,288px)_minmax(260px,1fr)] md:items-end">
            <div className="space-y-2">
              <Label
                className="text-sm font-semibold text-white"
                htmlFor="release-report-month"
              >
                Month and year
              </Label>
              <div className="relative">
                <Input
                  aria-label="Month and year"
                  className="pointer-events-none absolute inset-0 !h-12 opacity-0"
                  id="release-report-month"
                  onChange={(event) => setMonth(event.target.value)}
                  ref={monthInputRef}
                  tabIndex={-1}
                  type="month"
                  value={month}
                />
                <button
                  aria-label="Choose month and year"
                  className="flex h-12 w-full items-center justify-between rounded-lg border border-white/20 bg-white/14 px-4 text-sm font-semibold text-white shadow-sm transition-colors outline-none focus-visible:border-white/45 focus-visible:ring-3 focus-visible:ring-white/20"
                  onClick={openMonthPicker}
                  type="button"
                >
                  <span>{formatMonthValue(month)}</span>
                  <IconCalendar className="size-4 text-white" stroke={2} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label
                className="text-sm font-semibold text-white"
                htmlFor="release-report-approver"
              >
                Approver
              </Label>
              <Select onValueChange={setApprover} value={approver}>
                <SelectTrigger
                  className="!h-12 w-full rounded-lg border-white/20 bg-white/14 px-4 text-sm font-medium text-white shadow-sm data-placeholder:text-white/45 focus-visible:border-white/45 focus-visible:ring-white/20 [&_svg]:text-white [&_svg]:opacity-100"
                  disabled={
                    isAuthLoading ||
                    !canRunUserAction ||
                    approverQuery.isLoading ||
                    approverQuery.isError ||
                    approvers.length === 0
                  }
                  id="release-report-approver"
                >
                  <SelectValue placeholder={approverPlaceholder}>
                    {selectedApprover?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {approvers.map((option) => (
                    <SelectItem
                      className="items-start py-2"
                      key={option.id}
                      value={option.id}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium">
                          {option.name}
                        </span>
                        <span className="truncate text-xs text-slate-500">
                          {option.email}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              disabled={
                isAuthLoading || codaSourceQuery.isLoading || createMutation.isPending
              }
              className="h-11 w-full max-w-[288px] justify-self-start rounded-lg bg-white px-4 text-sm font-semibold text-[#25166d] shadow-sm hover:bg-white/95"
              onClick={handleGenerate}
              type="button"
            >
              <IconSparkles className="size-4" stroke={2} />
              {createMutation.isPending
                ? "Generating..."
                : "Generate Monthly Release Notes"}
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/80">
            <span>Projects: {filteredCodaRows.projects.length}</span>
            <span>Tasks: {filteredCodaRows.tasks.length}</span>
          </div>
        </section>

        {errorMessage ? (
          <Alert className="mt-5 border-red-200 bg-red-50 px-3 py-3 text-red-900">
            <IconInfoCircle className="size-4" stroke={2} />
            <AlertTitle className="text-sm font-semibold">
              Request failed
            </AlertTitle>
            <AlertDescription className="text-sm text-red-700">
              {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        <div
          aria-label="Release note filters"
          className="mt-8 inline-flex h-9 rounded-lg bg-slate-200/70 p-0.5 text-sm"
          role="tablist"
        >
          <button
            aria-selected={activeFilter === "all"}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-3 font-medium transition-colors",
              activeFilter === "all"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950",
            )}
            onClick={() => setActiveFilter("all")}
            role="tab"
            type="button"
          >
            <span>All Release Notes</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
              {allReleaseNotesCount}
            </span>
          </button>
          <button
            aria-selected={activeFilter === "pending"}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-3 font-medium transition-colors",
              activeFilter === "pending"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950",
            )}
            onClick={() => setActiveFilter("pending")}
            role="tab"
            type="button"
          >
            <span>Pending Approval</span>
            <span className="rounded-full bg-[#fee68a] px-1.5 py-0.5 text-xs font-medium text-[#8d6a00]">
              {pendingCount}
            </span>
          </button>
        </div>

        <div className="mt-7 space-y-3">
          {visibleReleaseNotesQuery.isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white px-5 py-5 text-sm text-slate-500 shadow-sm">
              Loading release notes...
            </div>
          ) : visibleReleaseNotes.length > 0 ? (
            visibleReleaseNotes.map((note) => (
              <ReleaseNoteRow
                key={note.meta.ZUID}
                note={note}
                onSelect={() => setSelectedReleaseNote(note)}
              />
            ))
          ) : (
            <ReleaseNoteListEmpty activeFilter={activeFilter} />
          )}
        </div>
        <ReleaseNotePreviewDialog
          currentUserEmail={currentUserEmail}
          isApproving={approveMutation.isPending}
          note={selectedReleaseNote}
          onApprove={(note) =>
            approveMutation.mutate({ itemZuid: note.meta.ZUID })
          }
          onOpenChange={(open) => {
            if (!open && !approveMutation.isPending) {
              setSelectedReleaseNote(null);
            }
          }}
        />
      </div>
    </section>
  );
}

function ReleaseNoteListEmpty({
  activeFilter,
}: {
  activeFilter: ReleaseNoteFilter;
}) {
  const isPendingFilter = activeFilter === "pending";

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-xl bg-slate-200/70 text-slate-500">
        <IconFileDescription className="size-7" stroke={1.8} />
      </div>
      <h2 className="mt-5 text-base font-semibold text-slate-950">
        {isPendingFilter ? "No pending approvals" : "No release notes"}
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        {isPendingFilter
          ? "Release notes assigned to you for approval will appear here."
          : "Generated monthly release notes will appear here."}
      </p>
    </div>
  );
}

function ReleaseNoteRow({
  note,
  onSelect,
}: {
  note: ReleaseNoteListItem;
  onSelect: () => void;
}) {
  const isApproved = isReleaseNoteApproved(note.data.is_approved);
  const generatedBy = getGeneratedByLabel(note);

  return (
    <article
      className="flex min-h-22 cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:border-[#d8d5fb] hover:shadow-md focus:outline-none focus-visible:border-[#8b83ee] focus-visible:ring-3 focus-visible:ring-[#eceafe]"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eceafe] text-[#4f46e5]">
          <IconFileDescription className="size-5" stroke={2} />
        </div>
        <div>
          <h3 className="text-base font-bold leading-none text-slate-950">
            {formatReleaseMonth(note.data.release_month_date)}
          </h3>
          <div className="mt-3 space-y-1 text-[11px] text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                <IconCalendar className="size-3.5" stroke={2} />
                Generated {formatGeneratedDate(note.data.date_generated)}
              </span>
            </div>
            <p className="flex items-center gap-1">
              <IconUserCheck className="size-3.5" stroke={2} />
              {isApproved ? "Approved by" : "Approver"}:{" "}
              {note.data.approver_name}
            </p>
            <p className="flex items-center gap-1">
              <IconUserEdit className="size-3.5" stroke={2} />
              Generated by: {generatedBy}
            </p>
          </div>
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold shadow-sm",
          isApproved
            ? "border-emerald-300 bg-emerald-100 text-emerald-700"
            : "border-amber-300 bg-amber-100 text-amber-700",
        )}
      >
        {isApproved ? "Approved" : "Pending"}
      </span>
    </article>
  );
}

function ReleaseNotePreviewDialog({
  currentUserEmail,
  isApproving,
  note,
  onApprove,
  onOpenChange,
}: {
  currentUserEmail: string;
  isApproving: boolean;
  note: ReleaseNoteListItem | null;
  onApprove: (note: ReleaseNoteListItem) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const canApprove = Boolean(
    note &&
      !isReleaseNoteApproved(note.data.is_approved) &&
      isAssignedApprover(note, currentUserEmail),
  );

  return (
    <Dialog open={Boolean(note)} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(760px,calc(100svh-3rem))] max-w-[768px] flex-col gap-0 overflow-hidden rounded-lg bg-white p-0 text-slate-950 shadow-2xl sm:max-w-[768px]"
        showCloseButton={false}
      >
        {note ? (
          <>
            <DialogClose asChild>
              <Button
                aria-label="Close release note preview"
                className="absolute right-5 top-4 z-10 size-7 rounded-full border border-[#8b83ee] bg-white p-0 text-[#6d68e8] hover:bg-[#f2f1ff]"
                disabled={isApproving}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <IconX className="size-4" stroke={2} />
              </Button>
            </DialogClose>
            <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-6 py-6 pr-16">
              <DialogTitle className="text-2xl font-bold leading-tight text-slate-950">
                Monthly Release Notes -{" "}
                {formatReleaseMonth(note.data.release_month_date)}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-6 py-6">
              <div
                className="release-note-preview text-sm leading-6 text-slate-700 [&_a]:text-[#2837d4] [&_a]:underline [&_em]:text-slate-500 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-950 [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-2xl [&_h3]:font-bold [&_h3]:text-slate-950 [&_hr]:my-6 [&_hr]:border-slate-200 [&_li]:my-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_p]:my-3 [&_strong]:font-bold [&_ul]:my-3 [&_ul]:ml-6 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{
                  __html: getReleaseNotePreviewHtml(note.data.notes),
                }}
              />
            </div>
            <DialogFooter className="mx-0 mb-0 shrink-0 flex-row justify-end rounded-none border-t border-slate-200 bg-white px-6 py-4">
              <DialogClose asChild>
                <Button
                  className="h-9 border-slate-200 bg-white px-4 text-slate-900 shadow-sm hover:bg-slate-50"
                  disabled={isApproving}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </DialogClose>
              {canApprove ? (
                <Button
                  className="h-9 bg-[#4f46e5] px-4 text-white shadow-sm hover:bg-[#4338ca]"
                  disabled={isApproving}
                  onClick={() => onApprove(note)}
                  type="button"
                >
                  {isApproving ? "Approving..." : "Approve"}
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getCurrentMonthValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${month}`;
}

function formatMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    return "Select month";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

function formatGeneratedDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return value;
  }

  const [, year, month, day] = match.map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatReleaseMonth(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    return value;
  }

  const [, year, month] = match.map(Number);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

function isReleaseNoteApproved(value: string | boolean | number) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function isAssignedApprover(note: ReleaseNoteListItem, currentUserEmail: string) {
  return (
    note.data.approver_email.trim().toLowerCase() ===
    currentUserEmail.trim().toLowerCase()
  );
}

function getReleaseNotePreviewHtml(notes: string) {
  return notes
    .replace(/^\s*<hr\s*\/?>\s*/i, "")
    .replace(/^\s*<h2[^>]*>[\s\S]*?<\/h2>\s*/i, "");
}

function getGeneratedByLabel(note: ReleaseNoteListItem) {
  return (
    note.data.generated_by_name ||
    note.data.generated_by_email ||
    "Not available"
  );
}

function filterCodaRowsByMonth(
  source: MonthlyReleaseCodaSource | undefined,
  month: string,
): MonthlyReleaseCodaSourceRows {
  return {
    generatedAt: source?.generatedAt,
    projects: (source?.projects ?? []).filter((row) =>
      isCodaRowInMonth(row, CODA_PROJECT_DATE_COLUMN_ID, month),
    ),
    tasks: (source?.tasks ?? []).filter((row) =>
      isCodaRowInMonth(row, CODA_TASK_DATE_COLUMN_ID, month),
    ),
  };
}

function isCodaRowInMonth(
  row: MonthlyReleaseCodaSourceRows["projects"][number],
  dateColumnId: string,
  month: string,
) {
  return getMonthKeyFromCodaCell(row.values?.[dateColumnId]) === month;
}

function getMonthKeyFromCodaCell(value: unknown) {
  const text = getCodaCellText(value);

  if (!text) {
    return "";
  }

  const isoMatch = text.match(/(\d{4})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const dateTimeValue = /^\d{4}-\d{2}-\d{2}\s/.test(text)
    ? text.replace(" ", "T")
    : text;
  const date = new Date(dateTimeValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getCodaCellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(getCodaCellText).filter(Boolean).join(", ");
  }

  if (typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  for (const key of [
    "date",
    "start",
    "end",
    "display",
    "name",
    "title",
    "value",
    "text",
    "url",
  ]) {
    const text = getCodaCellText(record[key]);

    if (text) {
      return text;
    }
  }

  return "";
}

function hasReleaseNoteForMonth(notes: ReleaseNoteListItem[], month: string) {
  return notes.some((note) => note.data.release_month_date.slice(0, 7) === month);
}

function getGenerationErrorTitle(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("no documents") ||
    normalizedMessage.includes("no completed coda")
  ) {
    return "Nothing to generate";
  }

  if (normalizedMessage.includes("already")) {
    return "Already generated";
  }

  return "Generation failed";
}
