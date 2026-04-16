/**
 * Health check: /api/health
 *
 * Quick validation that the server is running.
 * API keys are provided by users at runtime via the UI,
 * so we just check that the server itself is up.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify({ status: "healthy", server: true }, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
