import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CampaignList } from "./pages/campaigns/CampaignList";
import { CampaignCreate } from "./pages/campaigns/CampaignCreate";
import { CampaignDetail } from "./pages/campaigns/CampaignDetail";
import { PostList } from "./pages/posts/PostList";
import { PostCreate } from "./pages/posts/PostCreate";
import { PlatformList } from "./pages/platforms/PlatformList";
import { Analytics } from "./pages/analytics/Analytics";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div style={{ padding: 40, textAlign: "center" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, isLoading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isLoading ? null : user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/campaigns" element={<RequireAuth><CampaignList /></RequireAuth>} />
      <Route path="/campaigns/new" element={<RequireAuth><CampaignCreate /></RequireAuth>} />
      <Route path="/campaigns/:id" element={<RequireAuth><CampaignDetail /></RequireAuth>} />
      <Route path="/posts" element={<RequireAuth><PostList /></RequireAuth>} />
      <Route path="/posts/new" element={<RequireAuth><PostCreate /></RequireAuth>} />
      <Route path="/platforms" element={<RequireAuth><PlatformList /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
    </Routes>
  );
}
