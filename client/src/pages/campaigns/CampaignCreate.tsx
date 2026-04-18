import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { campaigns } from "../../api/campaigns";

const PLATFORMS = ["mastodon", "linkedin", "lemmy", "youtube"];

export function CampaignCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", targetAudience: "", targetPlatforms: [] as string[], startDate: "", endDate: "" });

  const create = useMutation({
    mutationFn: campaigns.create,
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      navigate(`/campaigns/${c.id}`);
    },
  });

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, targetPlatforms: f.targetPlatforms.includes(p) ? f.targetPlatforms.filter((x) => x !== p) : [...f.targetPlatforms, p] }));

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginBottom: 24 }}>New Campaign</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Name *</div>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Description</div>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Target Audience</div>
          <input value={form.targetAudience} onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Platforms</div>
          <div style={{ display: "flex", gap: 12 }}>
            {PLATFORMS.map((p) => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={form.targetPlatforms.includes(p)} onChange={() => togglePlatform(p)} />
                <span style={{ textTransform: "capitalize" }}>{p}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Start Date</div>
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </label>
          <label>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>End Date</div>
            <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => create.mutate(form)}
            disabled={!form.name || create.isPending}
            style={{ background: "#1a1a2e", color: "#fff", padding: "10px 24px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {create.isPending ? "Creating…" : "Create Campaign"}
          </button>
          <button onClick={() => navigate("/campaigns")} style={{ background: "none", border: "1px solid #d1d5db", padding: "10px 24px", borderRadius: 6, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
        {create.error && <p style={{ color: "#ef4444" }}>Error: {String(create.error)}</p>}
      </div>
    </div>
  );
}
