const colors: Record<string, string> = {
  draft: "#888",
  scheduled: "#f59e0b",
  published: "#10b981",
  failed: "#ef4444",
  active: "#10b981",
  paused: "#888",
  completed: "#3b82f6",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      background: colors[status] ?? "#888",
      color: "#fff",
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 12,
      fontWeight: 600,
      textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}
