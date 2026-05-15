export const layerKinds = ["text", "image", "frame", "audio", "video", "gif", "group"] as const;

export type LayerKind = (typeof layerKinds)[number];

export type DatabaseState = {
  connected: boolean;
  source: "neon" | "mock";
  message: string;
};

export type Streamer = {
  id: string;
  name: string;
  handle: string;
  streamKey: string;
  activeSceneId: string;
};

export type Scene = {
  id: string;
  streamerId: string;
  name: string;
  width: number;
  height: number;
  background: string;
  status: string;
};

export type Asset = {
  id: string;
  streamerId: string;
  name: string;
  kind: LayerKind;
  mimeType: string | null;
  storageUrl: string | null;
  thumbnailUrl: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type Layer = {
  id: string;
  sceneId: string;
  parentId: string | null;
  assetId: string | null;
  kind: LayerKind;
  name: string;
  orderIndex: number;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  content: string;
  blendMode: string;
  metadata: Record<string, unknown>;
};

export type WorkspaceSnapshot = {
  streamer: Streamer;
  scenes: Scene[];
  activeScene: Scene;
  layers: Layer[];
  assets: Asset[];
  database: DatabaseState;
  overlayUrl: string;
};

export type LayerPatch = Partial<
  Pick<
    Layer,
    | "name"
    | "parentId"
    | "assetId"
    | "visible"
    | "locked"
    | "x"
    | "y"
    | "width"
    | "height"
    | "rotation"
    | "opacity"
    | "fill"
    | "content"
    | "blendMode"
    | "metadata"
  >
>;
