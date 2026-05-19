import * as React from "react";
import {
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { AppSidebar } from "@/components/AppSidebar";
import { UploadDocumentModal } from "@/components/UploadDocumentModal";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { IconLogout, IconSearch, IconUpload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSafeAppRoutePath } from "@/lib/app-routes";
import { UploadDocumentActionProvider } from "@/lib/upload-document-action";
import useAppStore from "@/store/store";
import { useShallow } from "zustand/react/shallow";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const {
    authInit,
    isAuthLoading,
    isUserAuthenticated,
    isUserAuthorized,
    logout,
    user,
  } = useAppStore(
    useShallow((state) => ({
      authInit: state.authInit,
      isAuthLoading: state.isAuthLoading,
      isUserAuthenticated: state.isUserAuthenticated,
      isUserAuthorized: state.isUserAuthorized,
      logout: state.logout,
      user: state.user,
    })),
  );
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
  const isLoginRoute = pathname === "/login";
  const canUpload = isUserAuthenticated && isUserAuthorized;
  const userInitial =
    user?.firstName?.charAt(0) ?? user?.email?.charAt(0) ?? "A";

  React.useEffect(() => {
    void authInit();
  }, [authInit]);

  function handleUploadClick() {
    if (isAuthLoading) {
      return;
    }

    if (canUpload) {
      setUploadModalOpen(true);
      return;
    }

    void navigate({
      search: {
        intent: "upload",
        redirectTo: getSafeAppRoutePath(pathname),
      },
      to: "/login",
    });
  }

  async function handleLogoutClick() {
    await logout();
  }

  if (isLoginRoute) {
    return <Outlet />;
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "15.5rem" } as React.CSSProperties}
    >
      <UploadDocumentActionProvider onUpload={handleUploadClick}>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-svh w-full flex-col overflow-y-auto bg-gray-100">
            <div className="sticky top-0 z-50 flex min-h-14 w-full items-center gap-4 border-b border-gray-200 bg-white px-4 md:px-6">
              <SidebarTrigger className="cursor-pointer md:hidden" />
              <label className="relative flex h-8 w-full max-w-96 items-center">
                <IconSearch
                  className="pointer-events-none absolute left-3 size-4 text-slate-500"
                  stroke={1.8}
                />
                <Input
                  className="h-full border-slate-200 bg-white pl-9 pr-3 text-slate-900 shadow-sm focus-visible:border-[#8b83ee] focus-visible:ring-[#eceafe]"
                  placeholder="Search documents..."
                  type="search"
                />
              </label>
              <div className="ml-auto flex items-center gap-3">
                <Button
                  className="cursor-pointer inline-flex h-8 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4338ca]"
                  disabled={isAuthLoading}
                  onClick={handleUploadClick}
                  type="button"
                >
                  <IconUpload className="size-4" stroke={2} />
                  Upload
                </Button>
                {canUpload ? (
                  <>
                    <div className="h-7 w-px bg-slate-200" />
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#eceafe] text-sm font-semibold text-[#4f46e5]">
                      {userInitial.toUpperCase()}
                    </div>
                    <Button
                      aria-label="Sign out"
                      className="text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                      onClick={() => {
                        void handleLogoutClick();
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <IconLogout className="size-4" stroke={1.8} />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex min-h-0 w-full flex-1">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
        <UploadDocumentModal
          onOpenChange={setUploadModalOpen}
          open={uploadModalOpen}
        />
      </UploadDocumentActionProvider>
    </SidebarProvider>
  );
}
