#!/usr/bin/env tsx
/**
 * Admin CLI — inspect / delete Peanut Gallery Plus subscription rows.
 *
 * Sibling of `scripts/subscription-issue.ts` for the rare times when
 * an operator needs to surgically remove rows — e.g. the sandbox test
 * emails that got inserted during Stripe integration testing and now
 * 409-block the same person subscribing for real.
 *
 * Usage (run INSIDE the Railway container via `railway shell`, so
 * /data/subscriptions.db is actually on the volume):
 *
 *   npm run subscription:admin -- --list
 *   npm run subscription:admin -- --delete-email alice@example.com
 *   npm run subscription:admin -- --delete-all --confirm
 *
 * Requires `SUBSCRIPTION_DB_PATH` to be set. Opens the DB read-write
 * via better-sqlite3 directly — we bypass the SubscriptionStore
 * abstraction because deletes aren't part of the public API (rows
 * represent payment events; revoking is the normal path). This is
 * an admin escape hatch for pre-launch test data.
 */

import { existsSync } from "fs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3");

interface Args {
  list: boolean;
  deleteEmail: string | null;
  deleteAll: boolean;
  confirm: boolean;
}

function parseArgs(argv: string[]): Args {
  let list = false;
  let deleteEmail: string | null = null;
  let deleteAll = false;
  let confirm = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list" || a === "-l") list = true;
    else if (a === "--delete-email") deleteEmail = argv[++i] || null;
    else if (a?.startsWith("--delete-email="))
      deleteEmail = a.slice("--delete-email=".length);
    else if (a === "--delete-all") deleteAll = true;
    else if (a === "--confirm") confirm = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return { list, deleteEmail, deleteAll, confirm };
}

function printHelp(): void {
  console.log(`Usage:
  npm run subscription:admin -- --list
  npm run subscription:admin -- --delete-email alice@example.com
  npm run subscription:admin -- --delete-all --confirm

Flags:
  --list                   Show every subscription row (license key prefix + email + status).
  --delete-email <addr>    Delete every row matching this email (case-insensitive).
                           Also removes associated subscription_usage counters.
  --delete-all             Delete every row in the subscriptions + subscription_usage tables.
                           Requires --confirm as a seatbelt.
  --confirm                Required alongside --delete-all. No-op otherwise.
  --help, -h               Show this message.

Env:
  SUBSCRIPTION_DB_PATH   path to the SQLite file (e.g. /data/subscriptions.db)

Run inside the Railway container (railway shell) so the path points
at the mounted volume. Running locally will operate on a local DB
file if one exists, which is almost never what you want.
`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = process.env.SUBSCRIPTION_DB_PATH || "";
  if (!dbPath) {
    console.error("error: SUBSCRIPTION_DB_PATH not set.");
    process.exit(1);
  }
  if (!existsSync(dbPath)) {
    console.error(`error: DB file does not exist at ${dbPath}`);
    console.error("(If you meant to start fresh, just let the server recreate it on next subscribe.)");
    process.exit(1);
  }

  const db = new Database(dbPath);

  if (args.list) {
    const rows = db
      .prepare(
        `SELECT license_key, email, status, stripe_sub_id, created_at
         FROM subscriptions
         ORDER BY created_at DESC`,
      )
      .all() as Array<{
        license_key: string;
        email: string;
        status: string;
        stripe_sub_id: string | null;
        created_at: number;
      }>;
    if (rows.length === 0) {
      console.log("(no rows)");
      return;
    }
    console.log(`Found ${rows.length} row(s):`);
    for (const r of rows) {
      const prefix = r.license_key.slice(0, 8);
      const date = new Date(r.created_at).toISOString();
      const stripe = r.stripe_sub_id ?? "(no-stripe)";
      console.log(`  ${prefix}… ${r.email} [${r.status}] ${stripe} ${date}`);
    }
    return;
  }

  if (args.deleteEmail) {
    const email = args.deleteEmail.toLowerCase();
    const matches = db
      .prepare(`SELECT license_key FROM subscriptions WHERE LOWER(email) = ?`)
      .all(email) as Array<{ license_key: string }>;
    if (matches.length === 0) {
      console.log(`(no rows match email ${args.deleteEmail})`);
      return;
    }
    const keys = matches.map((m) => m.license_key);
    const del = db.transaction(() => {
      for (const k of keys) {
        db.prepare(`DELETE FROM subscription_usage WHERE license_key = ?`).run(k);
        db.prepare(`DELETE FROM subscriptions WHERE license_key = ?`).run(k);
      }
    });
    del();
    console.log(`Deleted ${keys.length} row(s) for ${args.deleteEmail}:`);
    for (const k of keys) console.log(`  ${k.slice(0, 8)}…`);
    return;
  }

  if (args.deleteAll) {
    if (!args.confirm) {
      console.error("error: --delete-all requires --confirm. Aborting.");
      process.exit(1);
    }
    const before = db.prepare(`SELECT COUNT(*) as n FROM subscriptions`).get() as { n: number };
    db.exec(`DELETE FROM subscription_usage; DELETE FROM subscriptions;`);
    console.log(`Deleted ${before.n} subscription row(s) and all usage counters.`);
    return;
  }

  printHelp();
  process.exit(1);
}

main();
