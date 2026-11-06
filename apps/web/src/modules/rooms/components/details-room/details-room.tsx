"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Star } from "lucide-react";
import { ManageRoomDialog } from "@/modules/rooms/components/manage-room/manage-room-dialog";
import { useRoomOnline } from "@/modules/rooms/hooks/use-room-members";
import { useI18n } from "@/locales/client";
import { Button } from "@/modules/shared/ui/button";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/modules/shared/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/modules/shared/ui/dialog";
import { toBRFormat } from "@/modules/shared/utils/date-formatter";
import type { RoomListItem } from "@/modules/rooms/services/get-rooms";
import { useDetailRoom } from "@/modules/rooms/hooks/use-detail-room";
import { deleteRoom } from "@/modules/rooms/services/delete-room";
import { toggleRoomFavorite } from "@/modules/rooms/services/toggle-room-favorite";

export type DetailsRoomHandle = {
  open: (publicId: string) => void;
  close: () => void;
};

export type DetailsRoomProps = {
  previewQueryKeyPrefix?: string[];
};

// Stays mounted but empty until a room is opened, so closed dialogs do not register
// (disabled) detail/online/members queries nor poll anything.
export const DetailsRoom = forwardRef<DetailsRoomHandle, DetailsRoomProps>(function DetailsRoom(props, ref) {
  const [publicId, setPublicId] = useState<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: (nextPublicId: string) => setPublicId(nextPublicId),
      close: () => setPublicId(null),
    }),
    [],
  );

  if (!publicId) return null;
  return <DetailsRoomContent key={publicId} publicId={publicId} previewQueryKeyPrefix={props.previewQueryKeyPrefix} onClose={() => setPublicId(null)} />;
});

type DetailsRoomContentProps = DetailsRoomProps & {
  publicId: string;
  onClose: () => void;
};

function DetailsRoomContent({ publicId, onClose, ...props }: DetailsRoomContentProps) {
  const t = useI18n();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ? `/${params.locale}` : "";
  const previewQueryKey = props.previewQueryKeyPrefix ?? ["rooms:list"];
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const roomsQueries = queryClient.getQueriesData<RoomListItem[]>({
    queryKey: previewQueryKey,
  });
  const rooms = useMemo(() => roomsQueries.flatMap(([, data]) => data ?? []), [roomsQueries]);
  const previewRoom = useMemo(() => rooms.find((item) => item.public_id === publicId), [rooms, publicId]);
  const { data: detailRoom, isLoading } = useDetailRoom(publicId);

  const roomName = detailRoom?.name ?? previewRoom?.name ?? t("dashboard.roomDetails.fallbackName");
  const createdAt = detailRoom?.created_at ?? previewRoom?.created_at;
  const isPublic = detailRoom?.is_public ?? previewRoom?.is_public ?? true;
  const description = detailRoom?.description ?? previewRoom?.description;
  const imageUrl = detailRoom?.url_image ?? previewRoom?.url_image ?? "/banners/auth.gif";
  const participantsCount = previewRoom?.participants_count ?? 0;
  const isOwner = detailRoom?.is_owner ?? true;
  const canManage = Boolean(detailRoom && detailRoom.my_role !== "visitor");
  const [manageOpen, setManageOpen] = useState(false);
  const { data: online } = useRoomOnline(publicId);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    setIsFavorite(Boolean(previewRoom?.is_favorite));
  }, [previewRoom?.is_favorite, publicId]);

  const handleDelete = async () => {
    const deletingId = publicId;
    const roomQueries = queryClient.getQueriesData<RoomListItem[]>({
      queryKey: previewQueryKey,
    });
    const previousRooms = roomQueries.map(([key, data]) => [key, data] as const);
    setIsDeleting(true);
    setDeleteError(null);
    roomQueries.forEach(([key]) => {
      queryClient.setQueryData<RoomListItem[]>(key, (current) => current?.filter((room) => room.public_id !== deletingId));
    });
    onClose();

    try {
      await deleteRoom(deletingId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms:list"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms:friend"] }),
        queryClient.invalidateQueries({ queryKey: ["rooms:detail", deletingId] }),
      ]);
    } catch {
      previousRooms.forEach(([key, data]) => {
        queryClient.setQueryData<RoomListItem[]>(key, data);
      });
      setDeleteError(t("dashboard.roomDetails.errors.deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEnterRoom = () => {
    onClose();
    router.push(`${locale}/app/room/${publicId}`);
  };

  const handleToggleFavorite = async () => {
    const togglingId = publicId;
    const roomQueries = queryClient.getQueriesData<RoomListItem[]>({
      queryKey: previewQueryKey,
    });
    const previousRooms = roomQueries.map(([key, data]) => [key, data] as const);
    const optimisticValue = !isFavorite;

    setIsTogglingFavorite(true);
    setFavoriteError(null);
    setIsFavorite(optimisticValue);
    roomQueries.forEach(([key]) => {
      queryClient.setQueryData<RoomListItem[]>(key, (current) =>
        current?.map((room) => (room.public_id === togglingId ? { ...room, is_favorite: optimisticValue } : room)),
      );
    });

    try {
      const result = await toggleRoomFavorite(togglingId);
      setIsFavorite(result.liked);
      roomQueries.forEach(([key]) => {
        queryClient.setQueryData<RoomListItem[]>(key, (current) =>
          current?.map((room) => (room.public_id === togglingId ? { ...room, is_favorite: result.liked } : room)),
        );
      });
      await queryClient.invalidateQueries({ queryKey: ["rooms:list"] });
    } catch {
      previousRooms.forEach(([key, data]) => {
        queryClient.setQueryData<RoomListItem[]>(key, data);
      });
      setIsFavorite(Boolean(previewRoom?.is_favorite));
      setFavoriteError(t("dashboard.roomDetails.errors.favoriteFailed"));
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isLoading ? <Skeleton className="h-6 w-48" /> : roomName}</DialogTitle>
          <DialogDescription>{isLoading ? t("dashboard.roomDetails.loadingDescription") : t("dashboard.roomDetails.readyDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-md" />
          ) : (
            <div className="h-48 w-full overflow-hidden rounded-md border border-border">
              <img
                src={imageUrl}
                alt={t("dashboard.roomDetails.imageAlt", { roomName })}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = "/banners/auth.gif";
                }}
              />
            </div>
          )}
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`detail-room-skeleton-${index}`} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">{t("dashboard.roomDetails.fields.createdAt")}</p>
                  <p className="text-sm font-medium">{createdAt ? toBRFormat(createdAt) : "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">{t("dashboard.roomDetails.fields.visibility")}</p>
                  <p className="text-sm font-medium">{isPublic ? t("dashboard.roomDetails.values.public") : t("dashboard.roomDetails.values.private")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">{t("dashboard.roomDetails.fields.participants")}</p>
                  <p className="text-sm font-medium">{participantsCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase text-muted-foreground">{t("dashboard.roomManage.online")}</p>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <span className={`inline-block h-2 w-2 rounded-full ${online && online.count > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    {t("dashboard.roomManage.onlineNow", { count: online?.count ?? 0 })}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase text-muted-foreground">{t("dashboard.roomDetails.fields.description")}</p>
                <p className="text-sm text-foreground">{description ? description : t("dashboard.roomDetails.values.noDescription")}</p>
              </div>
            </>
          )}
        </div>
        {favoriteError ? <p className="text-sm text-destructive">{favoriteError}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isLoading || !publicId || isTogglingFavorite} onClick={handleToggleFavorite} className="gap-2">
            <Star className={isFavorite ? "h-4 w-4 fill-amber-500 text-amber-500" : "h-4 w-4 fill-transparent text-muted-foreground"} />
            {isTogglingFavorite ? t("dashboard.roomDetails.favorite.updating") : isFavorite ? t("dashboard.roomDetails.favorite.remove") : t("dashboard.roomDetails.favorite.add")}
          </Button>
          {canManage ? (
            <Button type="button" variant="outline" disabled={isLoading || !publicId} onClick={() => setManageOpen(true)} className="gap-2">
              <Settings2 className="h-4 w-4" />
              {t("dashboard.roomManage.open")}
            </Button>
          ) : null}
          {isOwner ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isLoading || !publicId}>
                  {t("dashboard.roomDetails.delete.action")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("dashboard.roomDetails.delete.title")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("dashboard.roomDetails.delete.description")}</AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
                <AlertDialogFooter>
                  <AlertDialogCancel asChild>
                    <Button type="button" variant="outline">
                      {t("dashboard.roomDetails.actions.cancel")}
                    </Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? t("dashboard.roomDetails.delete.deleting") : t("dashboard.roomDetails.delete.confirm")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Button type="button" onClick={handleEnterRoom} disabled={!publicId}>
            {t("dashboard.roomDetails.actions.enterRoom")}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ManageRoomDialog roomPublicId={publicId} open={manageOpen} onOpenChange={setManageOpen} />
    </Dialog>
  );
}
