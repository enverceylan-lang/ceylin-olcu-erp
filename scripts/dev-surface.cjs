const { spawn } = require("node:child_process");

const requested =
  String(process.argv[2] || "")
    .trim()
    .toLowerCase();

const config =
  requested === "platform"
    ? {
        surface: "PLATFORM",
        port: "3002",
      }
    : requested === "company"
      ? {
          surface: "COMPANY",
          port: "3001",
        }
      : null;

if (!config) {
  console.error(
    "Usage: node scripts/dev-surface.cjs company|platform",
  );
  process.exit(2);
}

const nextBin =
  require.resolve("next/dist/bin/next");

const env = {
  ...process.env,
  ENVERP_LOCAL_SURFACE:
    config.surface,
};

if (
  config.surface === "COMPANY" &&
  !String(
    env.ENVERP_LOCAL_COMPANY_SLUG ||
      "",
  ).trim()
) {
  env.ENVERP_LOCAL_COMPANY_SLUG =
    "ceylinperde";
}

console.log(
  `[ENVERP] Local surface=${config.surface} port=${config.port}`,
);

const child =
  spawn(
    process.execPath,
    [
      nextBin,
      "dev",
      "-p",
      config.port,
    ],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env,
    },
  );

child.on("exit", code => {
  process.exit(
    typeof code === "number"
      ? code
      : 1,
  );
});