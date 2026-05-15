import { ModeratorDashboard } from "@/components/ModeratorDashboard";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const workspace = await getWorkspaceSnapshot();

  return <ModeratorDashboard initialWorkspace={workspace} />;
}
