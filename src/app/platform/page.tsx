"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";
import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  normalizeRole,
  useAuthStore,
} from "@/store/useAuthStore";

export default function PlatformLoginPage() {
  const router =
    useRouter();

  const currentUser =
    useAuthStore(
      state => state.currentUser,
    );

  const login =
    useAuthStore(
      state => state.login,
    );

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
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    if (
      currentUser &&
      normalizeRole(
        currentUser.role,
      ) ===
        "PLATFORM_SUPER_ADMIN"
    ) {
      router.replace(
        "/super-admin",
      );
    }
  }, [
    currentUser,
    router,
  ]);

  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
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

    setSubmitting(true);
    setError("");

    try {
      const success =
        await login(
          username,
          password,
          false,
        );

      const authenticatedUser =
        useAuthStore
          .getState()
          .currentUser;

      if (
        !success ||
        !authenticatedUser ||
        normalizeRole(
          authenticatedUser.role,
        ) !==
          "PLATFORM_SUPER_ADMIN"
      ) {
        useAuthStore
          .getState()
          .logout();

        setError(
          "Platform yönetici girişi doğrulanamadı.",
        );
        return;
      }

      router.replace(
        "/super-admin",
      );
    }
    finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-300">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold text-white">
            ENVERP Platform Yönetimi
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Bu giriş yalnız PLATFORM_SUPER_ADMIN içindir.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Kullanıcı adı
            </span>

            <span className="relative block">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={event =>
                  setUsername(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-300">
              Şifre
            </span>

            <span className="relative block">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event =>
                  setPassword(
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-indigo-500"
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole className="h-4 w-4" />
            {submitting
              ? "Doğrulanıyor..."
              : "Platforma Giriş"}
          </button>
        </form>
      </section>
    </main>
  );
}