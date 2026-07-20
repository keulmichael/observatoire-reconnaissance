import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

function gitCommitSha() {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? gitCommitSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString()
  }
};

export default nextConfig;
