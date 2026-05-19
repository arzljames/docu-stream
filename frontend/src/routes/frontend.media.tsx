import { createFileRoute } from "@tanstack/react-router";
import { IconPhoto } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/frontend/media")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Frontend screenshots, diagrams, prototype captures, and visual assets."
      icon={IconPhoto}
      query={{ category: "Frontend", sub_category: "Media" }}
      title="Media"
      variant="media"
    />
  );
}
