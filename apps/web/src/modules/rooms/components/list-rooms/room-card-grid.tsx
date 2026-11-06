"use client";

import { Star } from "lucide-react";
import { useI18n } from "@/locales/client";
import { Card } from "@/modules/shared/ui/card";
import { toBRFormat } from "@/modules/shared/utils/date-formatter";
import type { RoomListItem } from "../../services/get-rooms";

type RoomCardGridProps = {
  rooms: RoomListItem[];
  onCardClick: (publicId: string) => void;
};

export function RoomCardGrid({ rooms, onCardClick }: RoomCardGridProps) {
  const t = useI18n();

  return (
    <div className="flex w-full h-[calc(100%-30px)] pb-10 pr-2 overflow-y-auto flex-wrap items-start justify-start gap-6">
      {rooms.map((room) => (
        <Card
          key={room.public_id}
          className="h-[250px] w-full max-w-[600px] basis-[calc(33.333%-16px)] overflow-hidden border-muted bg-card/80 cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onCardClick(room.public_id)}
        >
          <div className="h-[150px] w-full">
            <img
              src={`${room.url_image ?? "/banners/auth.gif"}`}
              alt={room.name}
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/banners/auth.gif";
              }}
            />
          </div>
          <div className="flex h-[100px] flex-col justify-between p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">{room.name}</h3>
                <div className="flex items-center gap-1 text-xs">
                  <Star className={room.is_favorite ? "h-4 w-4 fill-amber-500 text-amber-500" : "h-4 w-4 fill-transparent text-muted-foreground"} />
                  <span className="text-muted-foreground">{room.is_favorite ? t("dashboard.roomList.favorite") : t("dashboard.roomList.notFavorite")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.roomList.createdAt")}: {toBRFormat(room.created_at)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {t("dashboard.roomList.players")}: <span className="font-medium text-foreground">{room.participants_count}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
