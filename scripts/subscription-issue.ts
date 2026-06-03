#!/usr/bin/env tsx
/**
 * Admin CLI — issue a new Peanut Gallery Plus license key.
 *
 * Usage:
 *   npm run subscription:issue -- --email alice@example.com
 *   npm run subscription:issue -- --email alice@example.com --dry-run
 *
 * Requires `ENABLE_SUBSCRIPTION=true` and `SUBSCRIPTION_DB_PATH=...`.
 *
 * Prints the issued key to stdout. Email delivery is NOT triggered —
 * this is the hand-delivery path for the operator workflow: issue a
 * key here, then send it to the subscriber out-of-band.
 *
 * Why a manual CLI?
 * ────────────────
 *   - Plus subscribers get a hand-delivered key, sent out-of-band.
 *   - Operators self-hosting Plus issue keys out-of-band.
 *   - QA + integration tests need a deterministic key-creation path.
 *
 * The CLI talks directly to the subscription store — no HTTP, no
 * email. Re-running with the same `--email` issues a FRESH key (the
 * store's unique-key constraint is on the license key, not the email).
 */

import { createSubscription, reserveUniqueLicenseKey } from "../lib/subscription-store";
import { generateLicenseKey, isValidLicenseKey } from "../lib/subscription-keys";

interface Args {
  email: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let email = "";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" || a === "-e") {
      email = argv[++i] || "";
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("--email=")) {
      email = a.slice("--email=".length);
    }
  }
  return { email: email.trim(), dryRun };
}

function printHelp(): void {
  console.log(`Usage:
  npm run subscription:issue -- --email alice@example.com
  npm run subscription:issue -- --email alice@example.com --dry-run

Flags:
  --email, -e       Email on file for the subscription (required).
  --dry-run         Generate and print a candidate key WITHOUT writing
                    to the store. Useful for testing the generator.
  --help, -h        Show this message.

Env:
  ENABLE_SUBSCRIPTION       must be \"true\"
  SUBSCRIPTION_DB_PATH      path to the SQLite file (e.g. /data/subs.db)
  SUBSCRIPTION_DB_KEY       optional — SQLCipher key if the binary supports it
`);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function main(): void {
  const { email, dryRun } = parseArgs(process.argv.slice(2));

  if (!email) {
    console.error("error: --email is required");
    printHelp();
    process.exit(1);
  }
  if (!isValidEmail(email)) {
    console.error(`error: invalid email: ${email}`);
    process.exit(1);
  }
  if (process.env.ENABLE_SUBSCRIPTION !== "true") {
    console.warn(
      "warning: ENABLE_SUBSCRIPTION is not 'true' — the key will be created in the store but no HTTP endpoint will accept it until the flag is set.",
    );
  }

  if (dryRun) {
    const candidate = generateLicenseKey();
    if (!isValidLicenseKey(candidate)) {
      console.error(`error: generator produced an invalid key: ${candidate}`);
      process.exit(2);
    }
    console.log(candidate);
    console.log("(dry-run — not written to store)");
    return;
  }

  if (!process.env.SUBSCRIPTION_DB_PATH) {
    console.error(
      "error: SUBSCRIPTION_DB_PATH not set. Set it to the SQLite file path (e.g. /data/subs.db) before issuing keys.",
    );
    process.exit(1);
  }

  const licenseKey = reserveUniqueLicenseKey(generateLicenseKey);
  if (!isValidLicenseKey(licenseKey)) {
    console.error(`error: generated an invalid key (${licenseKey}); aborting`);
    process.exit(2);
  }

  const record = createSubscription({ licenseKey, email });
  console.log(`Issued license key for ${record.email}:`);
  console.log(licenseKey);
  console.log(
    `createdAt=${record.createdAt} status=${record.status}`,
  );
}

main();
