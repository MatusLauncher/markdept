import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { campaigns } from "../../api/campaigns";
import { StatusBadge } from "../../components/StatusBadge";

export function CampaignList() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: campaigns.list });
  const del = useMutation({
    mutationFn: campaigns.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1>Campaigns</h1>
        <Link to="/campaigns/new" style={{ background: "#1a1a2e", color: "#fff", padding: "8px 20px", borderRadius: 6, textDecoration: "none" }}>
          + New Campaign
        </Link>
      </div>
      {data.length === 0 ? (
        <p style={{ color: "#666" }}>No campaigns yet. <Link to="/campaigns/new">Create one</Link>.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
              {["Name", "Platforms", "Status", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "8px 12px" }}>
                  <Link to={`/campaigns/${c.id}`} style={{ color: "#1a1a2e", fontWeight: 600 }}>{c.name}</Link>
                </td>
                <td style={{ padding: "8px 12px" }}>{c.targetPlatforms.join(", ")}</td>
                <td style={{ padding: "8px 12px" }}><StatusBadge status={c.status} /></td>
                <td style={{ padding: "8px 12px" }}>
                  <button
                    onClick={() => { if (confirm("Delete?")) del.mutate(c.id); }}
                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
