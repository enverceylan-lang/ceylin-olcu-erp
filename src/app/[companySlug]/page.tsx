"use client";

import {
  useState,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import Image from "next/image";
import {
  KeyRound,
  LogIn,
  UserRound,
} from "lucide-react";

import {
  normalizeUser,
  useAuthStore,
} from "@/store/useAuthStore";
import {
  COMPANY_HOME_SEGMENT,
} from "@/lib/companyRouting";

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
        /*
         * Login + scope activation tamamlandıktan sonra tam browser
         * navigation kullanılır. Böylece yeni şirket-scope cookie'si
         * proxy tarafından ilk şirket içi istekte kesin görülür.
         */
        window.location.replace(
          `/${companySlug}/${COMPANY_HOME_SEGMENT}`,
        );
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
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-100 p-4 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <Image src="/brand/enverp-icon.png" alt="ENVerp" width={56} height={56} className="h-14 w-14 rounded-2xl shadow-sm" />

          <div>
            <div className="text-xs tracking-[0.22em] uppercase text-slate-400 font-semibold">
              ENVerp · Entegre Net Veri
            </div>

            <h1 className="text-xl font-bold">
              Şirket Girişi
            </h1>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="text-xs text-slate-500">
            Şirket
          </div>

          <div className="break-all font-semibold text-slate-800 dark:text-slate-200">
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
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Kullanıcı adı
            </span>

            <div className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950">
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
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Şifre
            </span>

            <div className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950">
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
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />

            {isSubmitting
              ? "Doğrulanıyor..."
              : "Giriş Yap"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Bu giriş yalnız bu şirket için tanımlı ENVerp kullanıcılarına açıktır.
        </p>
      </div>
    </div>
  );
}
