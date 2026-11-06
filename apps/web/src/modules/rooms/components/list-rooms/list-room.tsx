"use client";

import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useI18n } from "@/locales/client";
import { DataTableEmptyState } from "@/modules/shared/components/data-table";
import { Card } from "@/modules/shared/ui/card";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import { useGetRooms } from "../../hooks/use-rooms";
import { FilterRoom } from "./filters-room";
import { RoomCardGrid } from "./room-card-grid";
import { DetailsRoom, type DetailsRoomHandle } from "../details-room/details-room";
import type { RoomSort } from "../../services/get-rooms";

export function RoomList() {
  const t = useI18n();
  const [sortBy, setSortBy] = useState<RoomSort>("recent");
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetRooms({ sort: sortBy });
  const rooms = data ?? [];
  const detailsRoomRef = useRef<DetailsRoomHandle>(null);
  const handleReload = async () => {
    await queryClient.resetQueries({ queryKey: ["rooms:list"] });
    await queryClient.refetchQueries({ queryKey: ["rooms:list"] });
  };

  if (isLoading) {
    return (
      <div className="h-full">
        <FilterRoom roomLength={rooms.length} sortBy={sortBy} onSortChange={setSortBy} onReload={handleReload} />
        <LoadingCardSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full">
      <FilterRoom roomLength={rooms.length} sortBy={sortBy} onSortChange={setSortBy} onReload={handleReload} />

      {rooms.length === 0 ? (
        <DataTableEmptyState title={t("dashboard.roomList.emptyTitle")} description={t("dashboard.roomList.emptyDescription")} icon={Users} disabledBackground />
      ) : (
        <>
          <RoomCardGrid rooms={rooms} onCardClick={(publicId) => detailsRoomRef.current?.open(publicId)} />
          <DetailsRoom ref={detailsRoomRef} />
        </>
      )}
    </div>
  );
}

const LoadingCardSkeleton = () => (
  <div className="h-[calc(100%-30px)] overflow-y-auto">
    <div className="flex w-full  flex-wrap items-start justify-start gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`room-skeleton-${index}`} className="h-[250px] w-full max-w-[600px] min-w-[300px] basis-[calc(33.333%-16px)] overflow-hidden border-muted">
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
