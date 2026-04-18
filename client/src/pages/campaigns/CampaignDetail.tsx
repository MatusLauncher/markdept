import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { campaigns } from "../../api/campaigns";
import { StatusBadge } from "../../components/StatusBadge";

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaigns", Number(id)],
    queryFn: () => campaigns.get(Number(id)),
  });

  const genCalendar = useMutation({
    mutationFn: () => campaigns.generateCalendar(Number(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", Number(id)] }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (!campaign) return <p>Campaign not found.</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/campaigns" style={{ color: "#666" }}>← Campaigns</Link>
        <h1 style={{ margin: 0 }}>{campaign.name}</h1>
        <StatusBadge status={campaign.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        <div>
          {campaign.description && <p><strong>Description:</strong> {campaign.description}</p>}
          {campaign.targetAudience && <p><strong>Target Audience:</strong> {campaign.targetAudience}</p>}
          {campaign.targetPlatforms.length > 0 && <p><strong>Platforms:</strong> {campaign.targetPlatforms.join(", ")}</p>}
        </div>
        <div>
          {campaign.startDate && <p><strong>Start:</strong> {new Date(campaign.startDate).toLocaleDateString()}</p>}
          {campaign.endDate && <p><strong>End:</strong> {new Date(campaign.endDate).toLocaleDateString()}</p>}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => genCalendar.mutate()}
          disabled={genCalendar.isPending}
          style={{ background: "#d97706", color: "#fff", padding: "10px 20px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          {genCalendar.isPending ? "Generating…" : "Generate Content Calendar"}
        </button>
      </div>

      {campaign.contentCalendar && campaign.contentCalendar.length > 0 && (
        <div>
          <h2>Content Calendar</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                {["Week", "Platform", "Topic", "Post Type", "Notes"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaign.contentCalendar.map((entry, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 12px" }}>{String(entry.week ?? "")}</td>
                  <td style={{ padding: "8px 12px", textTransform: "capitalize" }}>{String(entry.platform ?? "")}</td>
                  <td style={{ padding: "8px 12px" }}>{String(entry.topic ?? "")}</td>
                  <td style={{ padding: "8px 12px" }}>{String(entry.postType ?? "")}</td>
                  <td style={{ padding: "8px 12px" }}>{String(entry.notes ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
