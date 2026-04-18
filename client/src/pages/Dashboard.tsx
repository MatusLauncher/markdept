import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { campaigns } from "../api/campaigns";
import { posts } from "../api/posts";
import { platforms } from "../api/platforms";
import { useAuth } from "../hooks/useAuth";

export function Dashboard() {
  const { user } = useAuth();
  const { data: allCampaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: campaigns.list });
  const { data: allPosts = [] } = useQuery({ queryKey: ["posts"], queryFn: () => posts.list() });
  const { data: allPlatforms = [] } = useQuery({ queryKey: ["platforms"], queryFn: platforms.list });

  const scheduled = allPosts.filter((p) => p.status === "scheduled");
  const published = allPosts.filter((p) => p.status === "published");
  const upcoming = scheduled
    .filter((p) => p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Campaigns", value: allCampaigns.length, to: "/campaigns" },
    { label: "Scheduled", value: scheduled.length, to: "/posts?status=scheduled" },
    { label: "Published", value: published.length, to: "/posts?status=published" },
    { label: "Platforms", value: allPlatforms.length, to: "/platforms" },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Welcome, {user?.name}</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>Here's your marketing overview.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
        {stats.map(({ label, value, to }) => (
          <Link key={label} to={to} style={{ textDecoration: "none" }}>
            <div style={{ background: "#f3f4f6", borderRadius: 8, padding: "24px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#1a1a2e" }}>{value}</div>
              <div style={{ color: "#666", marginTop: 4 }}>{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 12 }}>Upcoming Posts</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Platform", "Content", "Scheduled At"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upcoming.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>{p.platform}</td>
                  <td style={{ padding: "8px 12px", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</td>
                  <td style={{ padding: "8px 12px" }}>{new Date(p.scheduledAt!).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
