import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const server = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : spawn(process.execPath, ["tests/e2e/start-next.mjs"], {
      env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe"]
    });

if (server) {
  server.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  await waitForServer(baseURL);
}

const test = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  env: { ...process.env, PLAYWRIGHT_BASE_URL: baseURL },
  stdio: "inherit"
});

const exitCode = await new Promise((resolve) => {
  test.on("exit", (code) => resolve(code ?? 1));
});

if (server && !server.killed) {
  server.kill("SIGTERM");
}

process.exit(exitCode);

async function waitForServer(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Next test server did not start: ${url}`);
}
