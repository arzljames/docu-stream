import { createFileRoute } from "@tanstack/react-router";
import { IconDeviceMobile } from "@tabler/icons-react";
import {
  CategoryLandingPage,
  buildCategoryFolders,
} from "@/components/CategoryLandingPage";

export const Route = createFileRoute("/mobile/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <CategoryLandingPage
      description="Mobile development documentation"
      folders={buildCategoryFolders("/mobile")}
      icon={IconDeviceMobile}
      query={{ category: "Mobile" }}
      title="Mobile"
    />
  );
}
