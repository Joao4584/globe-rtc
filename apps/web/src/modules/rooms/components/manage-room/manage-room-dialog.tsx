"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Shield, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/locales/client";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/modules/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/modules/shared/ui/select";
import { useListFriends } from "@/modules/friends/hooks/use-friends";
import { useDetailRoom } from "../../hooks/use-detail-room";
import { useRoomMembers, useRoomOnline } from "../../hooks/use-room-members";
import { addRoomMember, removeRoomMember, setRoomMemberRole, updateRoom } from "../../services/room-members";

type Tab = "members" | "settings";

export type ManageRoomDialogProps = {
  roomPublicId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function OnlineDot({ online }: { online: boolean }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />;
}

export function ManageRoomDialog({ roomPublicId, open, onOpenChange }: ManageRoomDialogProps) {
  const t = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("members");

  const { data: room } = useDetailRoom(roomPublicId, open);
  const { data: membersData } = useRoomMembers(roomPublicId, open);
  const { data: online } = useRoomOnline(roomPublicId, open);
  const { data: friendsData } = useListFriends();

  const canEdit = Boolean(room?.can_edit);
  const isOwner = Boolean(room?.is_owner);
  const members = membersData?.members ?? [];
  const onlineIds = useMemo(() => new Set((online?.players ?? []).map((player) => player.id)), [online]);

  const refreshMembers = () => queryClient.invalidateQueries({ queryKey: ["rooms:members", roomPublicId] });

  // --- members ---
  const [friendToAdd, setFriendToAdd] = useState("");
  const [roleToAdd, setRoleToAdd] = useState<"member" | "admin">("member");
  const invitable = useMemo(() => {
    const already = new Set(members.map((member) => member.public_id));
    return (friendsData?.friends ?? []).filter((item) => !already.has(item.user.public_id));
  }, [friendsData, members]);

  const addMutation = useMutation({
    mutationFn: () => addRoomMember(roomPublicId as string, friendToAdd, roleToAdd),
    onSuccess: async () => {
      setFriendToAdd("");
      await refreshMembers();
      toast(t("dashboard.roomManage.members.added"));
    },
    onError: () => toast.error(t("dashboard.roomManage.errors.generic")),
  });
  const roleMutation = useMutation({
    mutationFn: (input: { id: string; role: "member" | "admin" }) => setRoomMemberRole(roomPublicId as string, input.id, input.role),
    onSuccess: refreshMembers,
    onError: () => toast.error(t("dashboard.roomManage.errors.generic")),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeRoomMember(roomPublicId as string, id),
    onSuccess: refreshMembers,
    onError: () => toast.error(t("dashboard.roomManage.errors.generic")),
  });

  // --- settings ---
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!room) return;
    setName(room.name);
    setDescription(room.description ?? "");
    setIsPublic(room.is_public);
    setPassword("");
  }, [room]);

  const needsPassword = !isPublic && (room?.is_public ?? true);
  const settingsMutation = useMutation({
    mutationFn: () =>
      updateRoom(roomPublicId as string, {
        name: name.trim(),
        description: description.trim() || null,
        public: isPublic,
        ...(!isPublic && password ? { password } : {}),
      }),
    onSuccess: async () => {
      setPassword("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms:detail", roomPublicId] }),
        queryClient.invalidateQueries({ queryKey: ["rooms:list"] }),
      ]);
      toast(t("dashboard.roomManage.settings.saved"));
    },
    onError: () => toast.error(t("dashboard.roomManage.errors.generic")),
  });
  const settingsInvalid = name.trim().length < 3 || (needsPassword && password.length < 6) || (password.length > 0 && password.length < 6);

  const roleLabel = (role: string) => t(`dashboard.roomManage.roles.${role}` as "dashboard.roomManage.roles.owner");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dashboard.roomManage.title")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.roomManage.onlineNow", { count: online?.count ?? 0 })}
            {online && online.players.length > 0 ? ` · ${online.players.map((player) => player.name).join(", ")}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button type="button" size="sm" variant={tab === "members" ? "default" : "outline"} onClick={() => setTab("members")}>
            {t("dashboard.roomManage.tabs.members")}
          </Button>
          {canEdit ? (
            <Button type="button" size="sm" variant={tab === "settings" ? "default" : "outline"} onClick={() => setTab("settings")}>
              {t("dashboard.roomManage.tabs.settings")}
            </Button>
          ) : null}
        </div>

        {tab === "members" || !canEdit ? (
          <div className="space-y-4">
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {members.map((member) => (
                <li key={member.public_id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <OnlineDot online={onlineIds.has(member.public_id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{member.username}</p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <Crown className="h-3.5 w-3.5" />
                      {roleLabel("owner")}
                    </span>
                  ) : isOwner ? (
                    <Select value={member.role} onValueChange={(value) => roleMutation.mutate({ id: member.public_id, role: value as "member" | "admin" })}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{roleLabel("member")}</SelectItem>
                        <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {member.role === "admin" ? <Shield className="h-3.5 w-3.5" /> : null}
                      {roleLabel(member.role)}
                    </span>
                  )}
                  {member.role !== "owner" && canEdit && (isOwner || member.role !== "admin") ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t("dashboard.roomManage.members.remove")}
                      disabled={removeMutation.isPending}
                      onClick={() => removeMutation.mutate(member.public_id)}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {canEdit ? (
              <div className="space-y-2 border-t border-border pt-4">
                <Label>{t("dashboard.roomManage.members.addLabel")}</Label>
                {invitable.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("dashboard.roomManage.members.noFriends")}</p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={friendToAdd} onValueChange={setFriendToAdd}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={t("dashboard.roomManage.members.pickFriend")} />
                      </SelectTrigger>
                      <SelectContent>
                        {invitable.map((item) => (
                          <SelectItem key={item.user.public_id} value={item.user.public_id}>
                            {item.user.name} (@{item.user.username})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isOwner ? (
                      <Select value={roleToAdd} onValueChange={(value) => setRoleToAdd(value as "member" | "admin")}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{roleLabel("member")}</SelectItem>
                          <SelectItem value="admin">{roleLabel("admin")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}
                    <Button type="button" size="icon" disabled={!friendToAdd || addMutation.isPending} onClick={() => addMutation.mutate()} aria-label={t("dashboard.roomManage.members.add")}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!settingsInvalid) settingsMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="manage-room-name">{t("dashboard.createRoom.fields.name")}</Label>
              <Input id="manage-room-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manage-room-description">{t("dashboard.createRoom.fields.description")}</Label>
              <Input id="manage-room-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label>{t("dashboard.createRoom.fields.visibility")}</Label>
              <Select value={isPublic ? "public" : "private"} onValueChange={(value) => setIsPublic(value === "public")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">{t("dashboard.createRoom.visibility.public")}</SelectItem>
                  <SelectItem value="private">{t("dashboard.createRoom.visibility.private")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isPublic ? (
              <div className="space-y-2">
                <Label htmlFor="manage-room-password">{t("dashboard.roomManage.settings.password")}</Label>
                <Input
                  id="manage-room-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={needsPassword ? t("dashboard.createRoom.placeholders.minPassword") : t("dashboard.roomManage.settings.keepPassword")}
                />
              </div>
            ) : null}
            <Button type="submit" disabled={settingsInvalid || settingsMutation.isPending} className="w-full">
              {t("dashboard.roomManage.settings.save")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
