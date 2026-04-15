export default function LandingPage() {
  return (
    <div style={{ padding: "4rem", textAlign: "center", color: "white", backgroundColor: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>LANDING PAGE TEST</h1>
      <p style={{ fontSize: "1.2rem", color: "#999" }}>If you can see this, routing works. The issue is in the full landing page content.</p>
      <a href="/app" style={{ color: "#3b82f6", fontSize: "1.2rem", display: "inline-block", marginTop: "2rem" }}>Go to App →</a>
    </div>
  );
}
