import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analytics } from "../../api/analytics";
import { posts } from "../../api/posts";
import { PlatformBadge } from "../../components/PlatformBadge";
import { MarkdownRenderer } from "../../components/MarkdownRenderer";
import { useState } from "react";

export function Analytics() {
  const qc = useQueryClient();
  const [report, setReport] = useState<string | null>(null);

  const { data: allAnalytics = [], isLoading } = useQuery({ queryKey: ["analytics"], queryFn: analytics.list });
  const { data: publishedPosts = [] } = useQuery({
    queryKey: ["posts", "published"],
    queryFn: () => posts.list("published"),
  });

  const fetchMetrics = useMutation({
    mutationFn: (postId: number) => analytics.fetch(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics"] }),
  });

  const genReport = useMutation({
    mutationFn: () => analytics.report(),
    onSuccess: (data) => setReport(data.report),
  });

  const totals = allAnalytics.reduce((acc, a) => ({
    likes: acc.likes + a.likes,
    shares: acc.shares + a.shares,
    comments: acc.comments + a.comments,
    views: acc.views + a.views,
  }), { likes: 0, shares: 0, comments: 0, views: 0 });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Analytics</h1>
        <button onClick={() => genReport.mutate()} disabled={genReport.isPending || allAnalytics.length === 0}
          style={{ background: "#d97706", color: "#fff", padding: "10px 20px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          {genReport.isPending ? "Generating…" : "Generate AI Report"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {Object.entries(totals).map(([k, v]) => (
          <div key={k} style={{ background: "#f3f4f6", borderRadius: 8, padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{v}</div>
            <div style={{ color: "#666", textTransform: "capitalize" }}>{k}</div>
          </div>
        ))}
      </div>

      {report && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 24, marginBottom: 32 }}>
          <h2 style={{ marginBottom: 16 }}>AI Report</h2>
          <MarkdownRenderer content={report} />
        </div>
      )}

      {publishedPosts.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 12 }}>Fetch Metrics for Published Posts</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {publishedPosts.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#f9fafb", borderRadius: 6 }}>
                <PlatformBadge platform={p.platform} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</span>
                <button onClick={() => fetchMetrics.mutate(p.id)} disabled={fetchMetrics.isPending}
                  style={{ background: "#1a1a2e", color: "#fff", padding: "4px 12px", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                  Fetch
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <p>Loading…</p> : allAnalytics.length === 0 ? (
        <p style={{ color: "#666" }}>No analytics data yet. Publish posts and fetch their metrics.</p>
      ) : (
        <div>
          <h2 style={{ marginBottom: 12 }}>Metrics History</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Platform", "Likes", "Shares", "Comments", "Views", "Fetched"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allAnalytics.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px" }}><PlatformBadge platform={a.platform} /></td>
                  <td style={{ padding: "8px 12px" }}>{a.likes}</td>
                  <td style={{ padding: "8px 12px" }}>{a.shares}</td>
                  <td style={{ padding: "8px 12px" }}>{a.comments}</td>
                  <td style={{ padding: "8px 12px" }}>{a.views}</td>
                  <td style={{ padding: "8px 12px" }}>{new Date(a.fetchedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
