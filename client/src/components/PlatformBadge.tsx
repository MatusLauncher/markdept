const colors: Record<string, string> = {
  mastodon: "#6364ff",
  linkedin: "#0077b5",
  lemmy: "#ff6314",
  youtube: "#ff0000",
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span style={{
      background: colors[platform] ?? "#888",
      color: "#fff",
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 12,
      fontWeight: 600,
      textTransform: "capitalize",
    }}>
      {platform}
    </span>
  );
}
