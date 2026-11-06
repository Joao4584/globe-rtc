/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth, { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import { integrationAction } from "@/modules/auth/actions/login-integration-action";
import { env } from "@globe-rtc/env";

// The profile email can be null (private email) or unverified, so ask GitHub for the primary verified one.
async function getGithubVerifiedEmail(accessToken?: string) {
  if (!accessToken) return null;
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const emails: { email: string; primary: boolean; verified: boolean }[] = await res.json();
    return emails.find((item) => item.primary && item.verified)?.email ?? null;
  } catch {
    return null;
  }
}

export const authOptions: AuthOptions = {
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  providers: [
    GithubProvider({
      clientId: env.GITHUB_CLIENT_ID ?? "",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
      issuer: "https://github.com/login/oauth",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }: any) {
      if (account && profile) {
        let payload;

        if (account.provider === "github") {
          const verifiedEmail = await getGithubVerifiedEmail(account.access_token);
          payload = {
            type: account.provider,
            id: String(profile.id),
            login: profile.login,
            email: verifiedEmail ?? profile.email,
            email_verified: !!verifiedEmail,
            name: profile.name || profile.login,
            avatar_url: profile.avatar_url || "",
            github_link: profile.html_url || "",
            bio: profile.bio || "",
          };
        } else if (account.provider === "google") {
          payload = {
            type: account.provider,
            id: profile.sub,
            login: profile.email,
            email: profile.email,
            email_verified: profile.email_verified === true,
            name: profile.name,
            avatar_url: profile.picture || "",
            github_link: "",
            bio: "",
          };
        }

        if (payload) {
          const result = await integrationAction(payload);
          // Without the API session cookie the user would land in /app logged out, so fail the sign-in instead.
          if (!result.success) {
            throw new Error(result.message);
          }
        }
      }

      return token;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return url.includes("/auth") ? `${baseUrl}/en-us/app` : url;
      } else if (new URL(url).origin === baseUrl) {
        return `${baseUrl}/en-us/app`;
      }
      return `${baseUrl}/en-us/app`;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
