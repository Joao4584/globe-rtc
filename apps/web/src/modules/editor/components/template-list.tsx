"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, RotateCw, Search } from "lucide-react";
import { useI18n } from "@/locales/client";
import { DataTableEmptyState } from "@/modules/shared/components/data-table";
import { Button } from "@/modules/shared/ui/button";
import { Card } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/shared/ui/select";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import { MAP_TEMPLATES_KEY, useMapTemplate, useMapTemplates } from "../hooks/use-map-templates";
import type { MapTemplateItem, TemplateSort } from "../services/map-templates";
import { MapThumbnail } from "./map-thumbnail";
import { CreateTemplateDialog } from "./create-template-dialog";

export function TemplateList() {
  const t = useI18n();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<TemplateSort>("recent");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useMapTemplates(sort);

  const templates = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = data ?? [];
    return term ? all.filter((item) => item.name.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const handleReload = async () => {
    await queryClient.resetQueries({ queryKey: [MAP_TEMPLATES_KEY] });
    await queryClient.refetchQueries({ queryKey: [MAP_TEMPLATES_KEY] });
  };

  return (
    <div className="h-full">
      <div className="mb-3 flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold">{t("dashboard.editor.title")}</h2>
          <span className="text-sm text-muted-foreground">{t("dashboard.editor.count", { count: data?.length ?? 0 })}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("dashboard.editor.searchPlaceholder")}
              className="h-8 w-[200px] bg-secondary pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("dashboard.roomFilters.sort")}</Label>
            <Select value={sort} onValueChange={(value) => setSort(value as TemplateSort)}>
              <SelectTrigger className="h-8 w-[150px] bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t("dashboard.editor.sortRecent")}</SelectItem>
                <SelectItem value="alphabetical">{t("dashboard.editor.sortAlphabetical")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-2" onClick={handleReload}>
            <RotateCw className="h-4 w-4" />
            {t("dashboard.editor.reload")}
          </Button>
          <CreateTemplateDialog />
        </div>
      </div>

      {isLoading ? (
        <LoadingCardSkeleton />
      ) : templates.length === 0 ? (
        <DataTableEmptyState
          title={search ? t("dashboard.editor.noResults") : t("dashboard.editor.emptyTitle")}
          description={search ? "" : t("dashboard.editor.emptyDescription")}
          icon={LayoutGrid}
          disabledBackground
        />
      ) : (
        <div className="flex h-[calc(100%-30px)] w-full flex-wrap items-start justify-start gap-6 overflow-y-auto pb-10 pr-2">
          {templates.map((template) => (
            <TemplateCard key={template.public_id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}

// The thumbnail is the saved map itself, drawn with the same pieces as the editor.
function TemplateCard({ template }: { template: MapTemplateItem }) {
  const t = useI18n();
  const { data, isLoading } = useMapTemplate(template.public_id);

  return (
    <Link href={`/app/editor/${template.public_id}`}className="w-full max-w-[600px] basis-[calc(33.333%-16px)] min-w-[300px]">
      <Card className="h-[250px] overflow-hidden border-muted bg-card/80 transition-shadow hover:border-sky-600 hover:shadow-md">
        {isLoading ? <Skeleton className="h-[150px] w-full rounded-none dark:opacity-30" /> : <MapThumbnail data={data?.data} />}
        <div className="flex h-[100px] flex-col justify-between p-4">
          <div className="space-y-1">
            <h3 className="truncate text-base font-semibold">{template.name}</h3>
            <p className="text-xs text-muted-foreground">{t("dashboard.editor.updatedAt", { date: new Date(template.updated_at).toLocaleDateString() })}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

const LoadingCardSkeleton = () => (
  <div className="h-[calc(100%-30px)] overflow-y-auto">
    <div className="flex w-full flex-wrap items-start justify-start gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`template-skeleton-${index}`}className="h-[250px] w-full max-w-[600px] min-w-[300px] basis-[calc(33.333%-16px)] overflow-hidden border-muted">
          <Skeleton className="h-[150px] w-full rounded-none dark:opacity-30" />
          <div className="flex h-[100px] flex-col justify-between p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3 dark:opacity-30" />
              <Skeleton className="h-3 w-1/2 dark:opacity-30" />
            </div>
            <Skeleton className="h-3 w-1/3 dark:opacity-30" />
          </div>
        </Card>
      ))}
    </div>
  </div>
);
