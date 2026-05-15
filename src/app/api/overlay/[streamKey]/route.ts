import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    streamKey: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { streamKey } = await params;
  const workspace = await getWorkspaceSnapshot(streamKey);

  return NextResponse.json({
    scene: workspace.activeScene,
    streamer: workspace.streamer,
    layers: workspace.layers.filter((layer) => layer.visible),
    assets: workspace.assets,
    database: workspace.database,
    updatedAt: new Date().toISOString(),
  });
}
