import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/frontend")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
