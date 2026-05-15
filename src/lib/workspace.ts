import { getAppBaseUrl, getSql, hasDatabaseUrl } from "@/lib/db";
import { getMockWorkspace } from "@/lib/mock-data";
import { layerKinds, type Asset, type Layer, type LayerKind, type LayerPatch, type Scene, type Streamer, type WorkspaceSnapshot } from "@/lib/types";

type RecordLike = Record<string, unknown>;

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

function isLayerKind(value: unknown): value is LayerKind {
  return typeof value === "string" && layerKinds.includes(value as LayerKind);
}

function normalizeKind(value: unknown): LayerKind {
  return isLayerKind(value) ? value : "text";
}

function rowToStreamer(row: RecordLike): Streamer {
  return {
    id: String(row.id),
    name: String(row.name),
    handle: String(row.handle),
    streamKey: String(row.stream_key),
    activeSceneId: String(row.active_scene_id ?? ""),
  };
}

function rowToScene(row: RecordLike): Scene {
  return {
    id: String(row.id),
    streamerId: String(row.streamer_id),
    name: String(row.name),
    width: toNumber(row.width, 1920),
    height: toNumber(row.height, 1080),
    background: String(row.background ?? "#0b0b0c"),
    status: String(row.status ?? "draft"),
  };
}

function rowToAsset(row: RecordLike): Asset {
  return {
    id: String(row.id),
    streamerId: String(row.streamer_id),
    name: String(row.name),
    kind: normalizeKind(row.kind),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    storageUrl: row.storage_url ? String(row.storage_url) : null,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    sizeBytes: row.size_bytes == null ? null : toNumber(row.size_bytes),
    durationMs: row.duration_ms == null ? null : toNumber(row.duration_ms),
    metadata: toMetadata(row.metadata),
    createdBy: String(row.created_by ?? "moderator"),
    createdAt: new Date(String(row.created_at ?? Date.now())).toISOString(),
  };
}

function rowToLayer(row: RecordLike): Layer {
  return {
    id: String(row.id),
    sceneId: String(row.scene_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    assetId: row.asset_id ? String(row.asset_id) : null,
    kind: normalizeKind(row.kind),
    name: String(row.name),
    orderIndex: toNumber(row.order_index),
    visible: Boolean(row.visible),
    locked: Boolean(row.locked),
    x: toNumber(row.x),
    y: toNumber(row.y),
    width: toNumber(row.width, 320),
    height: toNumber(row.height, 180),
    rotation: toNumber(row.rotation),
    opacity: toNumber(row.opacity, 100),
    fill: String(row.fill ?? "#f6dae0"),
    content: String(row.content ?? ""),
    blendMode: String(row.blend_mode ?? "normal"),
    metadata: toMetadata(row.metadata),
  };
}

export async function getWorkspaceSnapshot(streamKey = "streamer-1"): Promise<WorkspaceSnapshot> {
  if (!hasDatabaseUrl()) {
    return getMockWorkspace();
  }

  try {
    const sql = getSql();
    const streamerRows = await (sql`select * from streamers where stream_key = ${streamKey} limit 1` as unknown as Promise<RecordLike[]>);

    if (streamerRows.length === 0) {
      return getMockWorkspace(`Nenhum streamer com stream_key "${streamKey}" foi encontrado no Neon.`);
    }

    const streamer = rowToStreamer(streamerRows[0]);
    const sceneRows = await (sql`
      select *
      from scenes
      where streamer_id = ${streamer.id}
      order by created_at asc
    ` as unknown as Promise<RecordLike[]>);
    const scenes = sceneRows.map(rowToScene);
    const activeScene = scenes.find((scene) => scene.id === streamer.activeSceneId) ?? scenes[0];

    if (!activeScene) {
      return getMockWorkspace(`O streamer "${streamKey}" existe no Neon, mas ainda nao possui cenas.`);
    }

    const [layerRows, assetRows] = await Promise.all([
      sql`
        select *
        from layers
        where scene_id = ${activeScene.id}
        order by order_index asc, created_at asc
      ` as unknown as Promise<RecordLike[]>,
      sql`
        select *
        from assets
        where streamer_id = ${streamer.id}
        order by created_at desc
      ` as unknown as Promise<RecordLike[]>,
    ]);

    return {
      streamer,
      scenes,
      activeScene,
      layers: layerRows.map(rowToLayer),
      assets: assetRows.map(rowToAsset),
      database: {
        connected: true,
        source: "neon",
        message: "Conectado ao Neon.",
      },
      overlayUrl: `${getAppBaseUrl()}/overlay/${streamer.streamKey}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao ler o Neon.";
    return getMockWorkspace(`Falha ao consultar o Neon: ${message}`);
  }
}

export async function createAsset(input: {
  streamerId: string;
  name: string;
  kind: LayerKind;
  mimeType?: string | null;
  storageUrl?: string | null;
  thumbnailUrl?: string | null;
  sizeBytes?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await (sql`
    insert into assets (
      streamer_id,
      name,
      kind,
      mime_type,
      storage_url,
      thumbnail_url,
      size_bytes,
      duration_ms,
      metadata
    )
    values (
      ${input.streamerId},
      ${input.name},
      ${input.kind},
      ${input.mimeType ?? null},
      ${input.storageUrl ?? null},
      ${input.thumbnailUrl ?? null},
      ${input.sizeBytes ?? null},
      ${input.durationMs ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    returning *
  ` as unknown as Promise<RecordLike[]>);

  return rowToAsset(rows[0]);
}

export async function createLayer(input: {
  sceneId: string;
  kind: LayerKind;
  name?: string;
  assetId?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await (sql`
    insert into layers (
      scene_id,
      asset_id,
      kind,
      name,
      order_index,
      x,
      y,
      width,
      height,
      fill,
      content,
      metadata
    )
    values (
      ${input.sceneId},
      ${input.assetId ?? null},
      ${input.kind},
      ${input.name ?? defaultLayerName(input.kind)},
      (select coalesce(max(order_index), 0) + 1 from layers where scene_id = ${input.sceneId}),
      ${input.x ?? 160},
      ${input.y ?? 140},
      ${input.width ?? defaultLayerSize(input.kind).width},
      ${input.height ?? defaultLayerSize(input.kind).height},
      ${input.fill ?? "#f6dae0"},
      ${input.content ?? defaultLayerContent(input.kind)},
      ${JSON.stringify(input.metadata ?? defaultLayerMetadata(input.kind))}::jsonb
    )
    returning *
  ` as unknown as Promise<RecordLike[]>);

  return rowToLayer(rows[0]);
}

export async function updateLayer(id: string, patch: LayerPatch) {
  const sql = getSql();
  const currentRows = await (sql`select * from layers where id = ${id} limit 1` as unknown as Promise<RecordLike[]>);

  if (currentRows.length === 0) {
    return null;
  }

  const current = rowToLayer(currentRows[0]);
  const merged: Layer = {
    ...current,
    ...patch,
    parentId: patch.parentId === undefined ? current.parentId : patch.parentId,
    assetId: patch.assetId === undefined ? current.assetId : patch.assetId,
    metadata: patch.metadata ?? current.metadata,
  };

  const rows = await (sql`
    update layers
    set
      name = ${merged.name},
      parent_id = ${merged.parentId},
      asset_id = ${merged.assetId},
      visible = ${merged.visible},
      locked = ${merged.locked},
      x = ${merged.x},
      y = ${merged.y},
      width = ${merged.width},
      height = ${merged.height},
      rotation = ${merged.rotation},
      opacity = ${merged.opacity},
      fill = ${merged.fill},
      content = ${merged.content},
      blend_mode = ${merged.blendMode},
      metadata = ${JSON.stringify(merged.metadata)}::jsonb,
      updated_at = now()
    where id = ${id}
    returning *
  ` as unknown as Promise<RecordLike[]>);

  return rowToLayer(rows[0]);
}

function defaultLayerName(kind: LayerKind) {
  const names: Record<LayerKind, string> = {
    text: "Novo texto",
    image: "Nova imagem",
    frame: "Novo frame",
    audio: "Novo audio",
    video: "Novo video",
    gif: "Novo GIF",
    group: "Novo grupo",
  };

  return names[kind];
}

function defaultLayerContent(kind: LayerKind) {
  return kind === "text" ? "Texto da live" : "";
}

function defaultLayerSize(kind: LayerKind) {
  const sizes: Record<LayerKind, { width: number; height: number }> = {
    text: { width: 420, height: 72 },
    image: { width: 360, height: 240 },
    frame: { width: 520, height: 300 },
    audio: { width: 320, height: 70 },
    video: { width: 480, height: 270 },
    gif: { width: 320, height: 240 },
    group: { width: 560, height: 360 },
  };

  return sizes[kind];
}

function defaultLayerMetadata(kind: LayerKind): Record<string, unknown> {
  if (kind === "text") {
    return { fontFamily: "JetBrains Mono NFP", fontSize: 34, fontWeight: 700 };
  }

  if (kind === "frame") {
    return { radius: 10, strokeWidth: 2 };
  }

  return {};
}
