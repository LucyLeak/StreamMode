import { getAppBaseUrl } from "@/lib/db";
import type { Asset, Layer, Scene, Streamer, WorkspaceSnapshot } from "@/lib/types";

function makeMockStreamer(streamKey: string): Streamer {
  const normalizedKey = streamKey.trim() || "streamer-1";

  return {
    id: `mock-${normalizedKey}`,
    name: normalizedKey === "streamer-1" ? "Streamer 1" : normalizedKey,
    handle: normalizedKey === "streamer-1" ? "nome do streamer" : normalizedKey,
    streamKey: normalizedKey,
    activeSceneId: `mock-scene-${normalizedKey}`,
  };
}

function makeMockScene(streamer: Streamer): Scene {
  return {
    id: streamer.activeSceneId,
    streamerId: streamer.id,
    name: "Pagina 1",
    width: 1920,
    height: 1080,
    background: "#0b0b0c",
    status: "live",
  };
}

function makeMockAssets(streamer: Streamer): Asset[] {
  return [
    {
      id: "mock-asset-title",
      streamerId: streamer.id,
      name: "Titulo da live",
      kind: "text",
      mimeType: "text/plain",
      storageUrl: null,
      thumbnailUrl: null,
      sizeBytes: null,
      durationMs: null,
      metadata: { fontFamily: "JetBrains Mono" },
      createdBy: "moderator",
      createdAt: new Date(0).toISOString(),
    },
    {
      id: "mock-asset-frame",
      streamerId: streamer.id,
      name: "Frame principal",
      kind: "frame",
      mimeType: null,
      storageUrl: null,
      thumbnailUrl: null,
      sizeBytes: null,
      durationMs: null,
      metadata: { border: "solid" },
      createdBy: "moderator",
      createdAt: new Date(0).toISOString(),
    },
  ];
}

function makeMockLayers(activeScene: Scene): Layer[] {
  return [
    {
      id: "mock-layer-1",
      sceneId: activeScene.id,
      parentId: null,
      assetId: "mock-asset-title",
      kind: "text",
      name: "Texto 1",
      orderIndex: 1,
      visible: true,
      locked: false,
      x: 148,
      y: 116,
      width: 420,
      height: 80,
      rotation: 0,
      opacity: 100,
      fill: "#f6dae0",
      content: "[titulo da live]",
      blendMode: "normal",
      metadata: { fontFamily: "JetBrains Mono", fontSize: 42, fontWeight: 700, lineHeight: 1.1 },
    },
    {
      id: "mock-layer-2",
      sceneId: activeScene.id,
      parentId: null,
      assetId: null,
      kind: "text",
      name: "Texto 2",
      orderIndex: 2,
      visible: true,
      locked: false,
      x: 148,
      y: 206,
      width: 380,
      height: 56,
      rotation: 0,
      opacity: 100,
      fill: "#9a4059",
      content: "@[nome do streamer]",
      blendMode: "normal",
      metadata: { fontFamily: "JetBrains Mono", fontSize: 24, fontWeight: 500, lineHeight: 1.1 },
    },
    {
      id: "mock-layer-3",
      sceneId: activeScene.id,
      parentId: null,
      assetId: "mock-asset-frame",
      kind: "frame",
      name: "Frame 1",
      orderIndex: 3,
      visible: true,
      locked: false,
      x: 704,
      y: 184,
      width: 520,
      height: 300,
      rotation: 0,
      opacity: 100,
      fill: "#9a4059",
      content: "",
      blendMode: "normal",
      metadata: { radius: 12, strokeWidth: 3, background: "rgba(154, 64, 89, 0.12)" },
    },
  ];
}

export function getMockWorkspace(
  streamKey = "streamer-1",
  message = "Neon ainda nao foi configurado; exibindo dados locais de desenvolvimento.",
): WorkspaceSnapshot {
  const streamer = makeMockStreamer(streamKey);
  const activeScene = makeMockScene(streamer);

  return {
    streamer,
    scenes: [activeScene],
    activeScene,
    layers: makeMockLayers(activeScene),
    assets: makeMockAssets(streamer),
    database: {
      connected: false,
      source: "mock",
      message,
    },
    overlayUrl: `${getAppBaseUrl()}/overlay/${streamer.streamKey}`,
  };
}
