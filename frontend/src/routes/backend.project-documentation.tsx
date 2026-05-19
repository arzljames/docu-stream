import { createFileRoute } from "@tanstack/react-router";
import { IconFolder } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/backend/project-documentation")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Backend implementation guides, service notes, and API references."
      icon={IconFolder}
      query={{
        category: "Backend",
        sub_category: "Project Documentation",
      }}
      title="Project Documentation"
    />
  );
}
