import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { platforms } from "../../api/platforms";
import { PlatformBadge } from "../../components/PlatformBadge";

export function PlatformList() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["platforms"], queryFn: platforms.list });
  const del = useMutation({ mutationFn: platforms.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ["platforms"] }) });

  const [lemmy, setLemmy] = useState({ username: "", password: "", communityId: "" });
  const connectLemmy = useMutation({
    mutationFn: () => platforms.connectLemmy({ username: lemmy.username, password: lemmy.password, communityId: Number(lemmy.communityId) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platforms"] }); setLemmy({ username: "", password: "", communityId: "" }); },
  });

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Connected Platforms</h1>

      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <a href="/api/platforms/mastodon/connect" style={{ background: "#6364ff", color: "#fff", padding: "10px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>Connect Mastodon</a>
        <a href="/api/platforms/linkedin/connect" style={{ background: "#0077b5", color: "#fff", padding: "10px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>Connect LinkedIn</a>
        <a href="/api/platforms/youtube/connect" style={{ background: "#ff0000", color: "#fff", padding: "10px 20px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>Connect YouTube</a>
      </div>

      <div style={{ marginBottom: 32, maxWidth: 400 }}>
        <h3 style={{ marginBottom: 12 }}>Connect Lemmy</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input value={lemmy.username} onChange={(e) => setLemmy((l) => ({ ...l, username: e.target.value }))} placeholder="Username"
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          <input type="password" value={lemmy.password} onChange={(e) => setLemmy((l) => ({ ...l, password: e.target.value }))} placeholder="Password"
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          <input value={lemmy.communityId} onChange={(e) => setLemmy((l) => ({ ...l, communityId: e.target.value }))} placeholder="Community ID (number)"
            style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          <button onClick={() => connectLemmy.mutate()} disabled={!lemmy.username || !lemmy.password || !lemmy.communityId || connectLemmy.isPending}
            style={{ background: "#ff6314", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            {connectLemmy.isPending ? "Connecting…" : "Connect Lemmy"}
          </button>
        </div>
      </div>

      {isLoading ? <p>Loading…</p> : data.length === 0 ? (
        <p style={{ color: "#666" }}>No platforms connected yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Platform", "Account", "Connected", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px" }}><PlatformBadge platform={p.platform} /></td>
                <td style={{ padding: "8px 12px" }}>{p.accountName}</td>
                <td style={{ padding: "8px 12px" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: "8px 12px" }}>
                  <button onClick={() => { if (confirm("Disconnect?")) del.mutate(p.id); }}
                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Disconnect</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
