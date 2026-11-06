"use client";

import { useRef } from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/locales/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/modules/shared/ui/dialog";
import { DataTableEmptyState } from "@/modules/shared/components/data-table";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import { useUserRooms } from "@/modules/rooms/hooks/use-user-rooms";
import { RoomCardGrid } from "@/modules/rooms/components/list-rooms/room-card-grid";
import { DetailsRoom, type DetailsRoomHandle } from "@/modules/rooms/components/details-room/details-room";
import type { FriendRelationshipItem } from "../../services/get-list-friends";

type FriendRoomsDialogProps = {
  friend: FriendRelationshipItem["user"] | null;
  onOpenChange: (open: boolean) => void;
};

export function FriendRoomsDialog({ friend, onOpenChange }: FriendRoomsDialogProps) {
  const t = useI18n();
  const detailsRoomRef = useRef<DetailsRoomHandle>(null);
  const { data, isLoading } = useUserRooms(friend?.public_id);
  const rooms = data ?? [];

  return (
    <Dialog open={Boolean(friend)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("dashboard.friends.roomsDialog.title", { name: friend?.name ?? "" })}</DialogTitle>
          <DialogDescription>
            {isLoading ? t("dashboard.friends.roomsDialog.loading") : null}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex w-full flex-wrap gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`friend-room-skeleton-${index}`} className="h-[250px] w-full max-w-[600px] basis-[calc(33.333%-16px)]" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <DataTableEmptyState
            title={t("dashboard.friends.roomsDialog.emptyTitle")}
            description={t("dashboard.friends.roomsDialog.emptyDescription", { name: friend?.name ?? "" })}
            icon={Users}
            disabledBackground
          />
        ) : (
          <div className="max-h-[480px]">
            <RoomCardGrid rooms={rooms} onCardClick={(publicId) => detailsRoomRef.current?.open(publicId)} />
          </div>
        )}
        <DetailsRoom ref={detailsRoomRef} previewQueryKeyPrefix={["rooms:friend", friend?.public_id ?? ""]} />
      </DialogContent>
    </Dialog>
  );
}
