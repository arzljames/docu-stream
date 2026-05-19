import { createFileRoute } from "@tanstack/react-router";
import { IconPhoto } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/mobile/media")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Mobile screenshots, diagrams, recordings, and supporting assets."
      icon={IconPhoto}
      query={{ category: "Mobile", sub_category: "Media" }}
      title="Media"
      variant="media"
    />
  );
}
