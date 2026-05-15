import { NextResponse } from "next/server";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspace = await getWorkspaceSnapshot();
  return NextResponse.json(workspace);
}
