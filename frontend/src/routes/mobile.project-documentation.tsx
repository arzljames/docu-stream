import { createFileRoute } from "@tanstack/react-router";
import { IconFolder } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/mobile/project-documentation")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Mobile implementation guides, setup notes, and release references."
      icon={IconFolder}
      query={{
        category: "Mobile",
        sub_category: "Project Documentation",
      }}
      title="Project Documentation"
    />
  );
}
