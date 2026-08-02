"use client";

import {
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import {
  Building2,
  KeyRound,
  LogIn,
  UserRound,
} from "lucide-react";

import {
  normalizeUser,
  useAuthStore,
} from "@/store/useAuthStore";

type CompanyLoginResponse = {
  success?: boolean;

  company?: {
    tenantId?: string;
    companyId?: string;
    companySlug?: string;
    companyName?: string;
    userScopeId?: string;
  };

  user?: Record<
    string,
    unknown
  >;

  session?: {
    token?: string;
    type?: string;
    expiresAt?: string;
    rememberMe?: boolean;
    companySlug?: string;
    companyScopeId?: string;
  };

  error?: string;
};

export default function CompanyGatewayPage() {
  const params =
    useParams<{
      companySlug: string;
    }>();

  const router =
    useRouter();

  const companySlug =
    String(
      params.companySlug || "",
    )
      .trim()
      .toLowerCase();

  const [
    username,
    setUsername,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const handleSubmit =
    async (
      event:
        React.FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !username.trim() ||
        !password.trim()
      ) {
        setError(
          "Kullanıcı adı ve şifre gereklidir.",
        );
        return;
      }

      setIsSubmitting(true);
      setError("");

      try {
        const loginResponse =
          await fetch(
            "/api/auth/company-login",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body:
                JSON.stringify({
                  companySlug,
                  username:
                    username.trim(),
                  password,
                }),
            },
          );

        const loginResult =
          (await loginResponse
            .json()
            .catch(() => null)) as
            | CompanyLoginResponse
            | null;

        if (
          !loginResponse.ok ||
          !loginResult?.success ||
          !loginResult.user ||
          !loginResult.session?.token ||
          !loginResult.session
            .expiresAt ||
          !loginResult.company
            ?.userScopeId ||
          loginResult.company
            .companySlug !==
            companySlug
        ) {
          setError(
            "Kullanıcı adı veya şifre hatalı.",
          );
          return;
        }

        const scopeResponse =
          await fetch(
            "/api/auth/company-scope-activate",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${loginResult.session.token}`,
              },
              body:
                JSON.stringify({
                  companySlug,
                  scopeId:
                    loginResult.company
                      .userScopeId,
                }),
            },
          );

        if (
          !scopeResponse.ok
        ) {
          setError(
            "Şirket yetki kapsamı doğrulanamadı.",
          );
          return;
        }

        const remoteUser =
          normalizeUser(
            loginResult.user,
          );

        useAuthStore.setState(
          state => {
            const cleanedUsers =
              state.users.map(
                existing => ({
                  ...existing,
                  password:
                    undefined,
                }),
              );

            const exists =
              cleanedUsers.some(
                existing =>
                  existing.id ===
                  remoteUser.id,
              );

            return {
              currentUser:
                remoteUser,

              users:
                exists
                  ? cleanedUsers.map(
                      existing =>
                        existing.id ===
                        remoteUser.id
                          ? remoteUser
                          : existing,
                    )
                  : [
                      ...cleanedUsers,
                      remoteUser,
                    ],

              sessionToken:
                loginResult.session
                  ?.token || null,

              sessionExpiresAt:
                loginResult.session
                  ?.expiresAt || null,

              rememberMe:
                false,
            };
          },
        );

        router.replace("/");
        router.refresh();
      }
      catch {
        setError(
          "Giriş işlemi tamamlanamadı.",
        );
      }
      finally {
        setIsSubmitting(false);
      }
    };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>

          <div>
            <div className="text-xs tracking-[0.22em] uppercase text-slate-400 font-semibold">
              ENVERP
            </div>

            <h1 className="text-xl font-bold">
              Şirket Girişi
            </h1>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <div className="text-xs text-slate-500">
            Şirket
          </div>

          <div className="font-semibold text-slate-200 break-all">
            {companySlug}
          </div>
        </div>

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Kullanıcı adı
            </span>

            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3">
              <UserRound className="w-4 h-4 text-slate-500" />

              <input
                value={
                  username
                }
                onChange={
                  event =>
                    setUsername(
                      event.target
                        .value,
                    )
                }
                autoComplete="username"
                className="w-full bg-transparent py-3 outline-none text-sm"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-300">
              Şifre
            </span>

            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3">
              <KeyRound className="w-4 h-4 text-slate-500" />

              <input
                type="password"
                value={
                  password
                }
                onChange={
                  event =>
                    setPassword(
                      event.target
                        .value,
                    )
                }
                autoComplete="current-password"
                className="w-full bg-transparent py-3 outline-none text-sm"
              />
            </div>
          </label>

          {error ? (
            <div className="rounded-xl border border-red-900/60 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={
              isSubmitting
            }
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-wait py-3 font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4" />

            {isSubmitting
              ? "Doğrulanıyor..."
              : "Giriş Yap"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Bu giriş yalnız bu şirket için tanımlı ENVERP kullanıcılarına açıktır.
        </p>
      </div>
    </div>
  );
}