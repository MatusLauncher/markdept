import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import type { ReactNode } from "react";

const navLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/campaigns", label: "Campaigns" },
  { to: "/posts", label: "Posts" },
  { to: "/platforms", label: "Platforms" },
  { to: "/analytics", label: "Analytics" },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const logout = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.clear();
      navigate("/login");
    },
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      <nav style={{ background: "#1a1a2e", color: "#fff", padding: "0 2rem", display: "flex", alignItems: "center", gap: "2rem", height: 56 }}>
        <span style={{ fontWeight: 700, fontSize: 18, marginRight: "1rem" }}>Markdept</span>
        {navLinks.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            style={{
              color: location.pathname.startsWith(to) ? "#60a5fa" : "#ccc",
              textDecoration: "none",
              fontWeight: location.pathname.startsWith(to) ? 600 : 400,
            }}
          >
            {label}
          </Link>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={() => logout.mutate()}
            style={{ background: "transparent", border: "1px solid #555", color: "#ccc", padding: "4px 12px", borderRadius: 4, cursor: "pointer" }}
          >
            Logout
          </button>
        </div>
      </nav>
      <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
