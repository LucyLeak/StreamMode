import { NextResponse } from "next/server";
import { hasDatabaseUrl } from "@/lib/db";
import { deleteAsset } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, { params }: Params) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: "DATABASE_URL nao esta configurada. O asset foi removido apenas localmente." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const deleted = await deleteAsset(id);

  if (!deleted) {
    return NextResponse.json({ error: "Asset nao encontrado." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
