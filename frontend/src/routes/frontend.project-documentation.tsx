import { createFileRoute } from "@tanstack/react-router";
import { IconFolder } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/frontend/project-documentation")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Frontend implementation guides, UI patterns, and app references."
      icon={IconFolder}
      query={{
        category: "Frontend",
        sub_category: "Project Documentation",
      }}
      title="Project Documentation"
    />
  );
}
