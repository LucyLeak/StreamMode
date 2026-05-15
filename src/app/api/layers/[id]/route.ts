import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import { updateLayer } from "@/lib/workspace";
import type { LayerPatch } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

function cleanPatch(body: Record<string, unknown>): LayerPatch {
  const patch: LayerPatch = {};

  for (const key of ["name", "fill", "content", "blendMode"] as const) {
    if (typeof body[key] === "string") {
      patch[key] = body[key];
    }
  }

  for (const key of ["parentId", "assetId"] as const) {
    if (typeof body[key] === "string" || body[key] === null) {
      patch[key] = body[key];
    }
  }

  for (const key of ["visible", "locked"] as const) {
    if (typeof body[key] === "boolean") {
      patch[key] = body[key];
    }
  }

  for (const key of ["x", "y", "width", "height", "rotation", "opacity"] as const) {
    if (typeof body[key] === "number" && Number.isFinite(body[key])) {
      patch[key] = body[key];
    }
  }

  if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    patch.metadata = body.metadata as Record<string, unknown>;
  }

  return patch;
}

export async function PATCH(request: Request, { params }: Params) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "DATABASE_URL nao esta configurada. A edicao foi mantida apenas no estado local da interface." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const layer = await updateLayer(id, cleanPatch(body));

  if (!layer) {
    return NextResponse.json({ error: "Camada nao encontrada." }, { status: 404 });
  }

  return NextResponse.json(layer);
}
