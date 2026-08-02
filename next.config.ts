import type { NextConfig } from "next";

const localSurface =
  String(
    process.env.ENVERP_LOCAL_SURFACE ||
      "",
  )
    .trim()
    .toUpperCase();

const localDistDir =
  localSurface === "PLATFORM"
    ? ".next/platform"
    : localSurface === "COMPANY"
      ? ".next/company"
      : undefined;

const nextConfig: NextConfig = {
  ...(localDistDir
    ? {
        distDir: localDistDir,
      }
    : {}),
};

export default nextConfig;