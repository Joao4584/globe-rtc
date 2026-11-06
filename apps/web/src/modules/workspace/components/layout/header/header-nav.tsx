"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/locales/client";
import { cn } from "@/modules/shared/utils";
import { getDashboardRoutes, type RouteProps } from "@/modules/workspace/routes/dashboard.routes";

const BASE_PATH = "/app";

// The pages of the app as links in the header (there are few of them, so no sidebar).
export function HeaderNav() {
  const t = useI18n();
  const pathname = usePathname() ?? "";
  const routes = useMemo(() => {
    const flat: RouteProps[] = [];
    for (const route of getDashboardRoutes(t as never)) {
      if ("routes" in route) flat.push(...route.routes);
      else flat.push(route);
    }
    return flat;
  }, [t]);

  // The part after /app/ decides which link is active ("" is the home).
  const activeSegment = (pathname.split(`${BASE_PATH}/`)[1] ?? "").split("/")[0];

  return (
    <nav className="flex items-center gap-1">
      {routes.map((route) => {
        const active = `/${activeSegment}` === route.path;
        return (
          <Link
            key={route.path}
            href={`${BASE_PATH}${route.path === "/" ? "" : route.path}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <route.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{route.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
