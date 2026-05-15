import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import { layerKinds, type LayerKind } from "@/lib/types";
import { createAsset } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function parseKind(value: unknown): LayerKind | null {
  return typeof value === "string" && layerKinds.includes(value as LayerKind) ? (value as LayerKind) : null;
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "DATABASE_URL nao esta configurada. O asset foi mantido apenas no estado local da interface." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const kind = parseKind(body.kind);

  if (!kind || typeof body.streamerId !== "string" || typeof body.name !== "string") {
    return NextResponse.json({ error: "Payload invalido para criacao de asset." }, { status: 400 });
  }

  const asset = await createAsset({
    streamerId: body.streamerId,
    name: body.name,
    kind,
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    storageUrl: typeof body.storageUrl === "string" ? body.storageUrl : null,
    thumbnailUrl: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
    sizeBytes: typeof body.sizeBytes === "number" ? body.sizeBytes : null,
    durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  });

  return NextResponse.json(asset, { status: 201 });
}
