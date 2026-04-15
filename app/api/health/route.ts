/**
 * Health check: /api/health
 *
 * Quick validation that the server is running and API keys are configured.
 * Also checks for yt-dlp and ffmpeg availability.
 */

import { execSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkBinary(name: string): { found: boolean; path?: string } {
  const searchPaths = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
  ];

  for (const p of searchPaths) {
    try {
      execSync(`test -x ${p}`, { stdio: "ignore" });
      return { found: true, path: p };
    } catch {
      // keep looking
    }
  }

  try {
    const resolved = execSync(`which ${name}`).toString().trim();
    return { found: true, path: resolved };
  } catch {
    return { found: false };
  }
}

export async function GET() {
  const checks = {
    server: true,
    keys: {
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      brave_search: !!process.env.BRAVE_SEARCH_API_KEY,
    },
    binaries: {
      "yt-dlp": checkBinary("yt-dlp"),
      ffmpeg: checkBinary("ffmpeg"),
    },
  };

  const allKeysPresent = Object.values(checks.keys).every(Boolean);
  const allBinariesPresent = Object.values(checks.binaries).every(
    (b) => b.found
  );
  const healthy = allKeysPresent && allBinariesPresent;

  return new Response(
    JSON.stringify(
      {
        status: healthy ? "healthy" : "degraded",
        ...checks,
      },
      null,
      2
    ),
    {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    }
  );
}
