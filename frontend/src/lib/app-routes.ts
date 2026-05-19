export type AppRoutePath =
  | "/docs"
  | "/monthly-release-notes"
  | "/mobile"
  | "/mobile/project-documentation"
  | "/mobile/rca-reports"
  | "/mobile/media"
  | "/frontend"
  | "/frontend/project-documentation"
  | "/frontend/rca-reports"
  | "/frontend/media"
  | "/backend"
  | "/backend/project-documentation"
  | "/backend/rca-reports"
  | "/backend/media";

export const APP_ROUTE_PATHS = new Set<AppRoutePath>([
  "/docs",
  "/monthly-release-notes",
  "/mobile",
  "/mobile/project-documentation",
  "/mobile/rca-reports",
  "/mobile/media",
  "/frontend",
  "/frontend/project-documentation",
  "/frontend/rca-reports",
  "/frontend/media",
  "/backend",
  "/backend/project-documentation",
  "/backend/rca-reports",
  "/backend/media",
]);

export function isAppRoutePath(path: string): path is AppRoutePath {
  return APP_ROUTE_PATHS.has(path as AppRoutePath);
}

export function getSafeAppRoutePath(
  path: string,
  fallback: AppRoutePath = "/docs",
): AppRoutePath {
  return isAppRoutePath(path) ? path : fallback;
}
