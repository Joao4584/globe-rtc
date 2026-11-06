"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useI18n } from "@/locales/client";
import { Button } from "@/modules/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/modules/shared/ui/dialog";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { createMapTemplate } from "../services/map-templates";
import { MAP_TEMPLATES_KEY } from "../hooks/use-map-templates";

export function CreateTemplateDialog() {
  const t = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError(t("dashboard.editor.create.nameMin"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await createMapTemplate(trimmed);
      await queryClient.invalidateQueries({ queryKey: [MAP_TEMPLATES_KEY] });
      setOpen(false);
      setName("");
      router.push(`/app/editor/${response.template.public_id}`);
    } catch {
      setError(t("dashboard.editor.create.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-2">
          <Plus className="h-4 w-4" />
          {t("dashboard.editor.newTemplate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dashboard.editor.create.title")}</DialogTitle>
          <DialogDescription>{t("dashboard.editor.create.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="template-name">{t("dashboard.editor.create.name")}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("dashboard.editor.create.namePlaceholder")}
              maxLength={80}
              required
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("dashboard.editor.create.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("dashboard.editor.create.submitting") : t("dashboard.editor.create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
