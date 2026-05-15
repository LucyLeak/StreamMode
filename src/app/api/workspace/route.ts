import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const streamKey = url.searchParams.get("streamKey") ?? "streamer-1";
  const workspace = await getWorkspaceSnapshot(streamKey);

  return NextResponse.json(workspace);
}
