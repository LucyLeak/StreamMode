import { OverlayClient } from "@/components/OverlayClient";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    streamKey: string;
  }>;
};

export default async function OverlayPage({ params }: Props) {
  const { streamKey } = await params;
  const workspace = await getWorkspaceSnapshot(streamKey);

  return (
    <OverlayClient
      streamKey={streamKey}
      initialScene={workspace.activeScene}
      initialLayers={workspace.layers.filter((layer) => layer.visible)}
      initialAssets={workspace.assets}
    />
  );
}
