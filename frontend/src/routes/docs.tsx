import { createFileRoute } from "@tanstack/react-router";
import { IconFileText } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/docs")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="View every document across Mobile, Frontend, and Backend."
      icon={IconFileText}
      title="All Documents"
    />
  );
}
