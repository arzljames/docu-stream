import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  IconChevronRight,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconFileDescription,
  IconFileText,
  IconFolder,
  IconInfoCircle,
  IconPhoto,
  IconServer2,
} from "@tabler/icons-react";

type RoutePath =
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

type SidebarIcon = typeof IconFileDescription;

type SidebarSubcategory = {
  label: string;
  to: RoutePath;
  icon: SidebarIcon;
};

type SidebarCategory = {
  label: string;
  to: RoutePath;
  icon: SidebarIcon;
  items?: SidebarSubcategory[];
};

const CATEGORIES: SidebarCategory[] = [
  { label: "All Documents", to: "/docs", icon: IconFileDescription },
  {
    label: "Monthly Release Notes",
    to: "/monthly-release-notes",
    icon: IconFileText,
  },
  {
    label: "Mobile",
    to: "/mobile",
    icon: IconDeviceMobile,
    items: [
      {
        label: "Project Documentation",
        to: "/mobile/project-documentation",
        icon: IconFolder,
      },
      { label: "RCA / Reports", to: "/mobile/rca-reports", icon: IconInfoCircle },
      { label: "Media", to: "/mobile/media", icon: IconPhoto },
    ],
  },
  {
    label: "Frontend",
    to: "/frontend",
    icon: IconDeviceDesktop,
    items: [
      {
        label: "Project Documentation",
        to: "/frontend/project-documentation",
        icon: IconFolder,
      },
      {
        label: "RCA / Reports",
        to: "/frontend/rca-reports",
        icon: IconInfoCircle,
      },
      { label: "Media", to: "/frontend/media", icon: IconPhoto },
    ],
  },
  {
    label: "Backend",
    to: "/backend",
    icon: IconServer2,
    items: [
      {
        label: "Project Documentation",
        to: "/backend/project-documentation",
        icon: IconFolder,
      },
      {
        label: "RCA / Reports",
        to: "/backend/rca-reports",
        icon: IconInfoCircle,
      },
      { label: "Media", to: "/backend/media", icon: IconPhoto },
    ],
  },
];

function isRouteInCategory(category: SidebarCategory, pathname: string) {
  return (
    pathname === category.to ||
    Boolean(category.items?.some((item) => item.to === pathname))
  );
}

function getInitialOpenCategories(pathname: string) {
  const activeCategory = CATEGORIES.find(
    (category) => category.items && isRouteInCategory(category, pathname),
  );

  return new Set([activeCategory?.label ?? "Mobile"]);
}

export function AppSidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [openCategories, setOpenCategories] = useState(() =>
    getInitialOpenCategories(pathname),
  );

  function toggleCategory(label: string) {
    setOpenCategories((current) => {
      const next = new Set(current);

      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }

      return next;
    });
  }

  return (
    <Sidebar className="border-r border-slate-200 [--sidebar:#f8fafc] [--sidebar-accent:#eceafe] [--sidebar-accent-foreground:#1d1a9d] [--sidebar-border:#e2e8f0] [--sidebar-foreground:#0f172a]">
      <SidebarHeader className="h-14 justify-center border-b border-slate-200 bg-[#f8fafc] px-4 py-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#4f46e5] text-white shadow-sm">
            <IconFileDescription className="size-4" stroke={2} />
          </div>
          <div className="min-w-0 leading-none">
            <h2 className="truncate text-sm font-semibold text-slate-950">
              DocuStream
            </h2>
            <p className="mt-1 truncate text-[11px] leading-none text-slate-500">
              Documentation Portal
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#f8fafc] px-2.5 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-auto px-2 pb-2 pt-0 text-[10px] font-semibold uppercase tracking-normal text-slate-500">
            Categories
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {CATEGORIES.map((category) => {
                const isActive = pathname === category.to;
                const isOpen = Boolean(
                  category.items && openCategories.has(category.label),
                );

                return (
                  <SidebarMenuItem
                    className={
                      category.label === "Mobile"
                        ? "mt-2 border-t border-slate-200 pt-2"
                        : undefined
                    }
                    key={category.label}
                  >
                    <SidebarMenuButton
                      aria-current={isActive ? "page" : undefined}
                      aria-expanded={category.items ? isOpen : undefined}
                      asChild
                      className={cn(
                        "h-9 rounded-md border border-transparent px-2 text-[15px] font-medium",
                        isActive
                          ? "bg-[#eceafe] text-[#1d1a9d] hover:bg-[#eceafe] hover:text-[#1d1a9d] data-[active=true]:bg-[#eceafe] data-[active=true]:text-[#1d1a9d] [&>svg]:text-[#4f46e5]"
                          : "text-slate-800 hover:bg-slate-100 hover:text-slate-950 [&>svg]:text-slate-500",
                        isActive &&
                          isOpen &&
                          "border-[#8b83ee] bg-[#f0efff] text-[#1d1a9d] hover:bg-[#f0efff] hover:text-[#1d1a9d] [&>svg]:text-[#4f46e5]",
                      )}
                      isActive={isActive}
                    >
                      <Link
                        onClick={
                          category.items
                            ? () => toggleCategory(category.label)
                            : undefined
                        }
                        to={category.to}
                      >
                        <category.icon
                          className="size-4"
                          stroke={isActive ? 2 : 1.8}
                        />
                        <span>{category.label}</span>
                        {category.items ? (
                          <IconChevronRight
                            className={cn(
                              "ml-auto size-4 text-slate-500 transition-transform",
                              isOpen && "rotate-90",
                              isActive && "text-[#1d1a9d]",
                            )}
                            stroke={1.8}
                          />
                        ) : null}
                      </Link>
                    </SidebarMenuButton>

                    {category.items && isOpen ? (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-8">
                        {category.items.map((item) => {
                          const isSubitemActive = pathname === item.to;

                          return (
                            <li key={item.label}>
                              <Link
                                className={cn(
                                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 [&>svg]:text-slate-500",
                                  isSubitemActive &&
                                    "bg-slate-100 text-[#1d1a9d] [&>svg]:text-[#4f46e5]",
                                )}
                                to={item.to}
                              >
                                <item.icon className="size-4" stroke={1.7} />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-200 bg-[#f8fafc] px-4 py-3">
        <p className="text-center text-[11px] text-slate-500">
          &copy; 2026 DocHub
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
