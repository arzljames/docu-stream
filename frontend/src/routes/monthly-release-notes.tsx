import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  IconCalendar,
  IconFileDescription,
  IconInfoCircle,
  IconSend,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { getSafeAppRoutePath } from "@/lib/app-routes";
import {
  generateMonthlyReleaseReport,
  getServiceErrorMessage,
  isAuthenticationError,
  postMonthlyReleaseReportToCoda,
  type MonthlyReleaseReport,
  type ReleaseReportDocument,
} from "@/lib/services";
import useAppStore from "@/store/store";
import { useShallow } from "zustand/react/shallow";

export const Route = createFileRoute("/monthly-release-notes")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(getCurrentMonthValue());
  const [report, setReport] = useState<MonthlyReleaseReport | null>(null);
  const { toast } = useToast();
  const { isAuthLoading, isUserAuthenticated, isUserAuthorized } = useAppStore(
    useShallow((state) => ({
      isAuthLoading: state.isAuthLoading,
      isUserAuthenticated: state.isUserAuthenticated,
      isUserAuthorized: state.isUserAuthorized,
    })),
  );
  const canRunUserAction = isUserAuthenticated && isUserAuthorized;
  const generateMutation = useMutation({
    mutationFn: generateMonthlyReleaseReport,
    onError: (error) => {
      if (isAuthenticationError(error)) {
        redirectToSignIn();
      }
    },
    onSuccess: (nextReport) => {
      setReport(nextReport);
    },
  });
  const codaMutation = useMutation({
    mutationFn: postMonthlyReleaseReportToCoda,
    onError: (error) => {
      if (isAuthenticationError(error)) {
        redirectToSignIn();
      }
    },
    onSuccess: ({ report: postedReport }) => {
      setReport(postedReport);
      toast({
        description: `${postedReport.monthLabel} release notes were queued in Coda.`,
        title: "Posted to Coda",
        variant: "success",
      });
    },
  });

  function handleGenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAuthLoading) {
      return;
    }

    if (!canRunUserAction) {
      redirectToSignIn();
      return;
    }

    generateMutation.mutate(month);
  }

  function handlePostToCoda() {
    if (isAuthLoading) {
      return;
    }

    if (!canRunUserAction) {
      redirectToSignIn();
      return;
    }

    codaMutation.mutate(month);
  }

  function redirectToSignIn() {
    void navigate({
      search: {
        intent: "action",
        redirectTo: getSafeAppRoutePath("/monthly-release-notes"),
      },
      to: "/login",
    });
  }

  const errorMessage = generateMutation.isError
    ? getServiceErrorMessage(
        generateMutation.error,
        "Release report generation failed.",
      )
    : codaMutation.isError
      ? getServiceErrorMessage(codaMutation.error, "Coda post failed.")
      : "";

  return (
    <section className="min-h-full w-full bg-[#f8fafc] px-6 py-9 text-slate-950 md:px-14">
      <div className="mx-auto w-full max-w-375">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#eceafe] text-[#4f46e5]">
            <IconFileDescription className="size-5" stroke={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-none text-slate-950">
              Monthly Release Notes
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Generate release notes from uploaded Zesty documents and post them
              to the Coda Release Notes page.
            </p>
          </div>
        </div>

        <form
          className="mt-8 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-end"
          onSubmit={handleGenerate}
        >
          <div className="w-full max-w-64 space-y-2">
            <Label htmlFor="release-report-month">Month and year</Label>
            <Input
              className="h-9 border-slate-200 bg-white px-3 text-slate-950 shadow-sm focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe]"
              id="release-report-month"
              onChange={(event) => setMonth(event.target.value)}
              required
              type="month"
              value={month}
            />
          </div>
          <Button
            className="h-9 bg-[#4f46e5] px-4 text-white shadow-sm hover:bg-[#4338ca]"
            disabled={isAuthLoading || generateMutation.isPending}
            type="submit"
          >
            <IconCalendar className="size-4" stroke={2} />
            {generateMutation.isPending
              ? "Generating..."
              : "Generate Monthly Release Notes"}
          </Button>
        </form>

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

        {report ? (
          <ReportPreview
            isPosting={codaMutation.isPending}
            onPostToCoda={handlePostToCoda}
            report={report}
          />
        ) : (
          <div className="mt-8 flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <IconFileDescription className="size-7" stroke={1.8} />
            </div>
            <h2 className="mt-5 text-base font-semibold text-slate-950">
              No report generated
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Choose a month and generate release notes to preview the documents
              grouped by Mobile, Frontend, and Backend.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReportPreview({
  isPosting,
  onPostToCoda,
  report,
}: {
  isPosting: boolean;
  onPostToCoda: () => void;
  report: MonthlyReleaseReport;
}) {
  const hasDocuments = report.totalDocuments > 0;

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Generated Report
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            {report.monthLabel}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {report.totalDocuments}{" "}
            {report.totalDocuments === 1 ? "document" : "documents"} included.
          </p>
        </div>
        <Button
          className="h-9 bg-[#4f46e5] px-4 text-white shadow-sm hover:bg-[#4338ca]"
          disabled={isPosting || !hasDocuments}
          onClick={onPostToCoda}
          type="button"
        >
          <IconSend className="size-4" stroke={2} />
          {isPosting
            ? "Posting..."
            : hasDocuments
              ? "Post to Coda"
              : "No documents to post"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {report.categories.map((category) => (
          <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
            key={category.category}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-950">
                {category.categoryLabel}
              </h3>
              <span className="rounded-full bg-[#eceafe] px-2 py-0.5 text-xs font-semibold text-[#4f46e5]">
                {category.total}
              </span>
            </div>

            {category.subcategories.length > 0 ? (
              <div className="mt-4 space-y-4">
                {category.subcategories.map((subcategory) => (
                  <div key={subcategory.subCategory}>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {subcategory.label}
                    </p>
                    <div className="mt-2 space-y-2">
                      {subcategory.documents.map((document) => (
                        <ReportDocumentItem
                          document={document}
                          key={document.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                No documents uploaded for this category.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportDocumentItem({
  document,
}: {
  document: ReleaseReportDocument;
}) {
  return (
    <a
      className="block rounded-md border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-[#8b83ee] hover:bg-[#f3f2ff]"
      href={document.fileUrl}
      rel="noreferrer"
      target="_blank"
    >
      <span className="block truncate text-sm font-semibold text-slate-950">
        {document.title}
      </span>
      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">
        {document.description || "No description provided."}
      </span>
      <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span>{document.fileExtension}</span>
        <span>{document.displayDate}</span>
      </span>
    </a>
  );
}

function getCurrentMonthValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${date.getFullYear()}-${month}`;
}
