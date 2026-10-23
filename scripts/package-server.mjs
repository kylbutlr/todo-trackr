import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
const output = resolve("dist/releases");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), "todo-trackr-server-"));
try {
  for (const file of ["package.json", "package-lock.json", "release.json", "LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CONTEXT.md", "CHANGELOG.md", ".env.self-hosted.example", "database", "docs", "design/GEIST-LICENSE.txt", "scripts/migrate-database.mjs", "scripts/hash-password.mjs", "dist/server.mjs", "apps/web/package.json"]) {
    await mkdir(resolve(staging, file, ".."), { recursive: true });
    await cp(file, join(staging, file), { recursive: true });
  }
  await cp("apps/web/dist", join(staging, "apps/web/dist"), { recursive: true, filter: (file) => !file.split(/[\\/]/u).includes("updates") });
  const runtime = JSON.parse(await readFile(join(staging, "package.json"), "utf8"));
  runtime.scripts = Object.fromEntries(Object.entries(runtime.scripts).filter(([name]) => ["start:server", "db:migrate", "auth:hash", "push:keys"].includes(name)));
  await writeFile(join(staging, "package.json"), `${JSON.stringify(runtime, null, 2)}\n`);
  await writeFile(join(staging, "README.md"), `# Todo Trackr server ${version}\n\nThis package contains the compiled web workspace, standalone API, and database migrations. It requires Node.js 24 and a PostgreSQL database you control. It does not require App Switchr or the maintainer's hosting.\n\n1. Run \`npm ci --omit=dev\`.\n2. Copy \`.env.self-hosted.example\` to \`.env.self-hosted\` and configure your database and explicit authentication mode.\n3. Run \`npm run db:migrate\`, then \`npm run start:server\`.\n4. Open http://127.0.0.1:8888. Stop with Ctrl+C in the same terminal. The server does not select a different port when 8888 is occupied.\n\nRead [self-hosting](docs/self-hosting.md) before startup or upgrades, and preserve a database backup. Passwordless access gives every caller who can reach the instance access to its tasks. Public release acceptance remains recorded in the [release plan](docs/self-hosted-release-plan.md).\n\nFor Docker, development, and contribution workflows, use the [source repository](https://github.com/kylbutlr/todo-trackr). This runtime package does not include build tooling or the native/extension clients. See [security](SECURITY.md), [privacy](docs/privacy.md), and [licensing](LICENSE).\n`);
  const archive = join(output, `todo-trackr-server-${version}.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", staging, "."]);
  console.log(`${createHash("sha256").update(await readFile(archive)).digest("hex")}  ${archive}`);
} finally { await rm(staging, { recursive: true, force: true }); }
