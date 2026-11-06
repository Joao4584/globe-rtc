"use client";

import { cn } from "@/modules/shared/utils";
import { Button } from "@/modules/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/modules/shared/ui/card";

import GitHubSvg from "@/assets/svg/github.svg";
import GoogleSvg from "@/assets/svg/google.svg";
import Image from "next/image";
import { useI18n } from "@/locales/client";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const t = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const hasLoginError = !!searchParams.get("error");

  const handleSocialLogin = async (provider: string) => {
    console.log("handleSocialLogin called with provider:", provider);
    try {
      const result = await signIn(provider, { redirect: false });
      console.log("signIn result:", result);
      if (result && !result.error) {
        router.push(callbackUrl || "/app");
      } else if (result?.error) {
        console.error("signIn error:", result.error);
      }
    } catch (error) {
      console.error("handleSocialLogin error:", error);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Form submitted!");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t("auth.welcome")}</CardTitle>
          <CardDescription>{t("auth.integration.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {hasLoginError && (
              <p role="alert" className="text-center text-sm text-red-500">
                {t("auth.integration.error")}
              </p>
            )}
            <div className="flex flex-col gap-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin("github")}
              >
                <Image
                  src={GitHubSvg}
                  width={18}
                  height={18}
                  alt="Github Icon"
                />
                {t("auth.integration.login.github")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSocialLogin("google")}
              >
                <Image
                  src={GoogleSvg}
                  width={18}
                  height={18}
                  alt="Google Icon"
                />
                {t("auth.integration.login.google")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
