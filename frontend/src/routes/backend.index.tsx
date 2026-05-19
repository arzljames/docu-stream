import { createFileRoute } from "@tanstack/react-router";
import { IconServer2 } from "@tabler/icons-react";
import {
  CategoryLandingPage,
  buildCategoryFolders,
} from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/backend/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Backend development documentation"
      folders={buildCategoryFolders("/backend")}
      icon={IconServer2}
      query={{ category: "Backend" }}
      title="Backend"
    />
  );
}
