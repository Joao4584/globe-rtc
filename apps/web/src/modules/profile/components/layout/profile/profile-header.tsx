"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useI18n } from "@/locales/client";
import { DropdownMenu, DropdownMenuTrigger } from "@/modules/shared/ui/dropdown-menu";
import { Skeleton } from "@/modules/shared/ui/skeleton";
import { ListContentDropDown } from "./profile-content-dropdown";
import { useUser } from "../../../hooks/use-user";

interface UserProfileProps {
  className?: string;
}

function getGreetingKeyByHour(hour: number) {
  if (hour >= 6 && hour < 12) return "dashboard.profile.header.greeting.morning" as const;
  if (hour >= 12 && hour < 18) return "dashboard.profile.header.greeting.afternoon" as const;
  return "dashboard.profile.header.greeting.evening" as const;
}

export default function UserProfileHeader(_props: UserProfileProps) {
  const t = useI18n();
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const { data } = useUser();
  const greeting = t(getGreetingKeyByHour(new Date().getHours()));

  const fullName = data?.name?.trim();
  const displayName = fullName ? fullName.split(/\s+/).slice(0, 2).join(" ") : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative flex h-9 justify-start gap-2 pl-5 transition-all">
          <div className="flex items-center">
            <div className="relative h-11 w-11">
              <div className="card h-11 w-11 overflow-hidden rounded-full border p-1">
                {!avatarLoaded && <Skeleton className="absolute inset-1 rounded-full" aria-hidden="true" />}
                <Image
                  src={data?.avatar_url ?? "/dashboard/default-user-logo.png"}
                  className={`rounded-full transition-opacity duration-300 ${avatarLoaded ? "opacity-100" : "opacity-0"}`}
                  alt={t("dashboard.profile.header.avatarAlt")}
                  width={40}
                  height={40}
                  onLoad={() => setAvatarLoaded(true)}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1.5">
            {displayName ? (
              <React.Fragment>
                <span className="text-xs text-slate-300">{greeting}</span>
                <h4 className="no-break text-sm font-semibold" style={{ lineHeight: "10px" }}>
                  {displayName}
                </h4>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Skeleton className="mt-1 h-3 w-full" />
                <Skeleton className="mt-1 h-4 w-full" />
              </React.Fragment>
            )}
          </div>
        </div>
      </DropdownMenuTrigger>
      <ListContentDropDown />
    </DropdownMenu>
  );
}
