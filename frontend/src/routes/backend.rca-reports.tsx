import { createFileRoute } from "@tanstack/react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/backend/rca-reports")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Backend incident analysis, system reports, and corrective actions."
      icon={IconInfoCircle}
      query={{ category: "Backend", sub_category: "RCA_Reports" }}
      title="RCA / Reports"
    />
  );
}
