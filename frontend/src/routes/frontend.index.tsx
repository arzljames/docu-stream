import { createFileRoute } from "@tanstack/react-router";
import { IconDeviceDesktop } from "@tabler/icons-react";
import {
  CategoryLandingPage,
  buildCategoryFolders,
} from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/frontend/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Frontend development documentation"
      folders={buildCategoryFolders("/frontend")}
      icon={IconDeviceDesktop}
      query={{ category: "Frontend" }}
      title="Frontend"
    />
  );
}
