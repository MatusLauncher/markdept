import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { posts } from "../../api/posts";
import { campaigns } from "../../api/campaigns";
import { platforms } from "../../api/platforms";

export function PostCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    platform: "mastodon",
    content: "",
    campaignId: "",
    platformAccountId: "",
    scheduledAt: "",
    topic: "",
  });

  const { data: allCampaigns = [] } = useQuery({ queryKey: ["campaigns"], queryFn: campaigns.list });
  const { data: allPlatforms = [] } = useQuery({ queryKey: ["platforms"], queryFn: platforms.list });
  const filtered = allPlatforms.filter((p) => p.platform === form.platform);

  const create = useMutation({
    mutationFn: posts.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["posts"] }); navigate("/posts"); },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const draft = await posts.create({ platform: form.platform, content: "Draft", campaignId: form.campaignId ? Number(form.campaignId) : undefined });
      const updated = await posts.generate(draft.id, form.topic);
      return updated;
    },
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["posts"] }); navigate(`/posts`); },
  });

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginBottom: 24 }}>New Post</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Platform</div>
          <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value, platformAccountId: "" }))}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}>
            {["mastodon", "linkedin", "lemmy", "youtube"].map((p) => (
              <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>
            ))}
          </select>
        </label>
        {filtered.length > 0 && (
          <label>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Platform Account</div>
            <select value={form.platformAccountId} onChange={(e) => setForm((f) => ({ ...f, platformAccountId: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}>
              <option value="">— none —</option>
              {filtered.map((a) => <option key={a.id} value={a.id}>{a.accountName}</option>)}
            </select>
          </label>
        )}
        {allCampaigns.length > 0 && (
          <label>
            <div style={{ marginBottom: 4, fontWeight: 600 }}>Campaign</div>
            <select value={form.campaignId} onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}>
              <option value="">— none —</option>
              {allCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        <div>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>AI Generate from Topic</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="e.g. Open source AI news"
              style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
            <button onClick={() => generate.mutate()} disabled={!form.topic || generate.isPending}
              style={{ background: "#d97706", color: "#fff", padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
              {generate.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Content</div>
          <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={6}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <label>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Schedule At (optional)</div>
          <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }} />
        </label>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => create.mutate({ platform: form.platform, content: form.content, campaignId: form.campaignId ? Number(form.campaignId) : undefined, platformAccountId: form.platformAccountId ? Number(form.platformAccountId) : undefined, scheduledAt: form.scheduledAt || undefined })}
            disabled={!form.content || create.isPending}
            style={{ background: "#1a1a2e", color: "#fff", padding: "10px 24px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 }}>
            {create.isPending ? "Saving…" : "Save Post"}
          </button>
          <button onClick={() => navigate("/posts")} style={{ background: "none", border: "1px solid #d1d5db", padding: "10px 24px", borderRadius: 6, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
