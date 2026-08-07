/**
 * Fails if a server-only secret has found its way into the browser bundle.
 *
 * Checks the literal values, not the variable names: a leak happens when Next
 * inlines a value, and the name may never appear. Run after any change that
 * moves code across the server/client boundary.
 *
 *   npm run build && npm run check:secrets
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SERVER_ONLY = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const CLIENT_DIR = ".next/static";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const env = new Map();
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && m[2]) env.set(m[1], m[2]);
}

let files;
try {
  files = walk(CLIENT_DIR);
} catch {
  console.error(`  ${CLIENT_DIR} not found — run npm run build first.`);
  process.exit(1);
}

let leaked = 0;
for (const name of SERVER_ONLY) {
  const value = env.get(name);
  if (!value) {
    console.log(`  ${name}: not set locally, skipped`);
    continue;
  }
  const hits = files.filter((f) => readFileSync(f, "utf8").includes(value));
  if (hits.length) {
    leaked++;
    console.log(`  ✗ ${name}: LEAKED into ${hits.length} client file(s)`);
    for (const h of hits.slice(0, 3)) console.log(`      ${h}`);
  } else {
    console.log(`  ✓ ${name}: not in the client bundle`);
  }
}

console.log(leaked === 0 ? "\n  No server secrets in client assets." : `\n  ${leaked} leaked.`);
process.exit(leaked === 0 ? 0 : 1);
