import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { posts } from "../../api/posts";
import { PlatformBadge } from "../../components/PlatformBadge";
import { StatusBadge } from "../../components/StatusBadge";

const STATUSES = ["", "draft", "scheduled", "published", "failed"];

export function PostList() {
  const [search] = useSearchParams();
  const status = search.get("status") ?? "";
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["posts", status],
    queryFn: () => posts.list(status || undefined),
  });
  const del = useMutation({
    mutationFn: posts.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Posts</h1>
        <Link to="/posts/new" style={{ background: "#1a1a2e", color: "#fff", padding: "8px 20px", borderRadius: 6, textDecoration: "none" }}>
          + New Post
        </Link>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {STATUSES.map((s) => (
          <Link key={s} to={s ? `/posts?status=${s}` : "/posts"}
            style={{ padding: "4px 12px", borderRadius: 20, textDecoration: "none", background: status === s ? "#1a1a2e" : "#f3f4f6", color: status === s ? "#fff" : "#374151", fontSize: 13 }}>
            {s || "All"}
          </Link>
        ))}
      </div>
      {isLoading ? <p>Loading…</p> : data.length === 0 ? (
        <p style={{ color: "#666" }}>No posts yet. <Link to="/posts/new">Create one</Link>.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Platform", "Content", "Status", "Scheduled At", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px" }}><PlatformBadge platform={p.platform} /></td>
                <td style={{ padding: "8px 12px", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</td>
                <td style={{ padding: "8px 12px" }}><StatusBadge status={p.status} /></td>
                <td style={{ padding: "8px 12px" }}>{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : "—"}</td>
                <td style={{ padding: "8px 12px" }}>
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(p.id); }}
                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
