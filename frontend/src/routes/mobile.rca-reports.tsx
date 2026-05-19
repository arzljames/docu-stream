import { createFileRoute } from "@tanstack/react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/mobile/rca-reports")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Mobile incident writeups, RCA notes, and delivery reports."
      icon={IconInfoCircle}
      query={{ category: "Mobile", sub_category: "RCA_Reports" }}
      title="RCA / Reports"
    />
  );
}
