import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import { layerKinds, type LayerKind } from "@/lib/types";
import { createLayer } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function parseKind(value: unknown): LayerKind | null {
  return typeof value === "string" && layerKinds.includes(value as LayerKind) ? (value as LayerKind) : null;
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "DATABASE_URL nao esta configurada. A camada foi criada apenas localmente." },
      { status: 503 },
    );
  }

  const body = await request.json();
  const kind = parseKind(body.kind);

  if (!kind || typeof body.sceneId !== "string") {
    return NextResponse.json({ error: "Payload invalido para criacao de camada." }, { status: 400 });
  }

  const layer = await createLayer({
    sceneId: body.sceneId,
    kind,
    name: typeof body.name === "string" ? body.name : undefined,
    parentId: typeof body.parentId === "string" ? body.parentId : null,
    assetId: typeof body.assetId === "string" ? body.assetId : null,
    x: typeof body.x === "number" ? body.x : undefined,
    y: typeof body.y === "number" ? body.y : undefined,
    width: typeof body.width === "number" ? body.width : undefined,
    height: typeof body.height === "number" ? body.height : undefined,
    fill: typeof body.fill === "string" ? body.fill : undefined,
    content: typeof body.content === "string" ? body.content : undefined,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
  });

  return NextResponse.json(layer, { status: 201 });
}
