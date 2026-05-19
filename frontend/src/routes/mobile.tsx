import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
