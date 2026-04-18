export function Login() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Markdept</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Automated marketing powered by Claude AI</p>
      <a
        href="/auth/login"
        style={{
          display: "inline-block",
          background: "#d97706",
          color: "#fff",
          padding: "12px 32px",
          borderRadius: 8,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 16,
        }}
      >
        Sign in with Claude
      </a>
    </div>
  );
}
