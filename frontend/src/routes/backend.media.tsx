import { createFileRoute } from "@tanstack/react-router";
import { IconPhoto } from "@tabler/icons-react";
import { CategoryLandingPage } from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/backend/media")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Backend architecture diagrams, monitoring captures, and media assets."
      icon={IconPhoto}
      query={{ category: "Backend", sub_category: "Media" }}
      title="Media"
      variant="media"
    />
  );
}
