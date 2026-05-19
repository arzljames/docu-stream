import { createFileRoute } from "@tanstack/react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/frontend/rca-reports")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Frontend RCA notes, quality reports, and regression summaries."
      icon={IconInfoCircle}
      query={{ category: "Frontend", sub_category: "RCA_Reports" }}
      title="RCA / Reports"
    />
  );
}
