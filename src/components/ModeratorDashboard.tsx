"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fontOptions, resolveFontFamily } from "@/lib/fonts";
import type { Asset, Layer, LayerKind, LayerPatch, WorkspaceSnapshot } from "@/lib/types";

type DashboardProps = {
  initialWorkspace: WorkspaceSnapshot;
};

type ResizeHandle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

type DragState =
  | {
      mode: "pan";
      startClientX: number;
      startClientY: number;
      startPanX: number;
      startPanY: number;
    }
  | {
      mode: "layer";
      id: string;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      childStarts: Array<{ id: string; x: number; y: number }>;
    }
  | {
      mode: "resize";
      id: string;
      handle: ResizeHandle;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
    };

const addableKinds: Array<{ kind: LayerKind; label: string; icon: string }> = [
  { kind: "text", label: "Texto", icon: "text_fields" },
  { kind: "image", label: "Imagem", icon: "image" },
  { kind: "frame", label: "Frame", icon: "dashboard" },
  { kind: "audio", label: "Audio", icon: "graphic_eq" },
  { kind: "video", label: "Video", icon: "movie" },
  { kind: "gif", label: "GIF", icon: "gif_box" },
  { kind: "group", label: "Grupo", icon: "folder" },
];

const blendModes = ["normal", "multiply", "screen", "overlay", "lighten", "darken"] as const;
const resizeHandles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  );
}

function makeLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultLayer(kind: LayerKind, sceneId: string, orderIndex: number, assetId: string | null = null): Layer {
  const base = {
    id: makeLocalId("local-layer"),
    sceneId,
    parentId: null,
    assetId,
    kind,
    name: `Novo ${kind}`,
    orderIndex,
    visible: true,
    locked: false,
    x: 180 + orderIndex * 18,
    y: 140 + orderIndex * 18,
    width: 360,
    height: 220,
    rotation: 0,
    opacity: 100,
    fill: "#f6dae0",
    content: kind === "text" ? "Texto da live" : "",
    blendMode: "normal",
    metadata: {},
  };

  if (kind === "text") {
    return {
      ...base,
      name: "Novo texto",
      width: 420,
      height: 76,
      metadata: { fontFamily: "JetBrains Mono", fontSize: 34, fontWeight: 700, lineHeight: 1.1 },
    };
  }

  if (kind === "frame") {
    return {
      ...base,
      name: "Novo frame",
      width: 520,
      height: 300,
      fill: "#9a4059",
      metadata: { radius: 10, strokeWidth: 2, background: "rgba(154, 64, 89, 0.12)" },
    };
  }

  if (kind === "audio") {
    return { ...base, name: "Novo audio", width: 330, height: 76, metadata: { volume: 80, loop: false } };
  }

  if (kind === "video") {
    return { ...base, name: "Novo video", width: 480, height: 270, metadata: { objectFit: "contain", loop: true } };
  }

  if (kind === "gif") {
    return { ...base, name: "Novo GIF", width: 320, height: 240, metadata: { objectFit: "contain" } };
  }

  if (kind === "group") {
    return {
      ...base,
      name: "Novo grupo",
      width: 560,
      height: 360,
      fill: "#5d6f8f",
      metadata: { background: "rgba(93, 111, 143, 0.12)" },
    };
  }

  return { ...base, name: "Nova imagem", width: 360, height: 240, metadata: { objectFit: "contain" } };
}

function assetKindFromFile(file: File): LayerKind {
  if (file.type === "image/gif") {
    return "gif";
  }

  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return "image";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isPersistedId(id: string) {
  return !id.startsWith("mock-") && !id.startsWith("local-");
}

export function ModeratorDashboard({ initialWorkspace }: DashboardProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedLayerId, setSelectedLayerId] = useState(initialWorkspace.layers[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"panel" | "assets">("panel");
  const [zoom, setZoom] = useState(0.58);
  const [pan, setPan] = useState({ x: 56, y: 58 });
  const [statusMessage, setStatusMessage] = useState(initialWorkspace.database.message);
  const [overlayUrl, setOverlayUrl] = useState(initialWorkspace.overlayUrl);
  const [streamerPanelOpen, setStreamerPanelOpen] = useState(false);
  const [streamKeyInput, setStreamKeyInput] = useState(initialWorkspace.streamer.streamKey);
  const [recentStreamKeys, setRecentStreamKeys] = useState<string[]>([initialWorkspace.streamer.streamKey]);
  const dragRef = useRef<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedLayers = useMemo(
    () => [...workspace.layers].sort((a, b) => a.orderIndex - b.orderIndex),
    [workspace.layers],
  );

  const selectedLayer = useMemo(
    () => workspace.layers.find((layer) => layer.id === selectedLayerId) ?? workspace.layers[0],
    [selectedLayerId, workspace.layers],
  );

  const assetById = useMemo(() => {
    return new Map(workspace.assets.map((asset) => [asset.id, asset]));
  }, [workspace.assets]);

  const layerById = useMemo(() => {
    return new Map(workspace.layers.map((layer) => [layer.id, layer]));
  }, [workspace.layers]);

  const groupLayers = useMemo(
    () => sortedLayers.filter((layer) => layer.kind === "group" && layer.id !== selectedLayer?.id),
    [selectedLayer?.id, sortedLayers],
  );

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/${workspace.streamer.streamKey}`);
    setStreamKeyInput(workspace.streamer.streamKey);
  }, [workspace.streamer.streamKey]);

  useEffect(() => {
    const stored = window.localStorage.getItem("streammode:recent-streamers");
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setRecentStreamKeys(Array.from(new Set([workspace.streamer.streamKey, ...parsed.filter(Boolean)])));
      }
    } catch {
      return;
    }
  }, [workspace.streamer.streamKey]);

  useEffect(() => {
    if (workspace.layers.length > 0 && !workspace.layers.some((layer) => layer.id === selectedLayerId)) {
      setSelectedLayerId(workspace.layers[0].id);
    }

    if (workspace.layers.length === 0 && selectedLayerId) {
      setSelectedLayerId("");
    }
  }, [selectedLayerId, workspace.layers]);

  function rememberStreamKey(streamKey: string) {
    const nextKeys = Array.from(new Set([streamKey, ...recentStreamKeys])).slice(0, 6);
    setRecentStreamKeys(nextKeys);
    window.localStorage.setItem("streammode:recent-streamers", JSON.stringify(nextKeys));
  }

  async function connectStreamer(streamKey: string) {
    const nextStreamKey = streamKey.trim() || "streamer-1";
    setStatusMessage(`Conectando ao streamer ${nextStreamKey}...`);

    try {
      const response = await fetch(`/api/workspace?streamKey=${encodeURIComponent(nextStreamKey)}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar o streamer.");
      }

      const nextWorkspace = (await response.json()) as WorkspaceSnapshot;
      setWorkspace(nextWorkspace);
      setSelectedLayerId(nextWorkspace.layers[0]?.id ?? "");
      setActiveTab("panel");
      setStreamerPanelOpen(false);
      setStatusMessage(nextWorkspace.database.message);
      rememberStreamKey(nextWorkspace.streamer.streamKey);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao conectar streamer.");
    }
  }

  function updateLayerLocal(id: string, patch: LayerPatch) {
    setWorkspace((current) => {
      const target = current.layers.find((layer) => layer.id === id);
      const deltaX = target && typeof patch.x === "number" ? patch.x - target.x : 0;
      const deltaY = target && typeof patch.y === "number" ? patch.y - target.y : 0;
      const shouldMoveChildren = target?.kind === "group" && (deltaX !== 0 || deltaY !== 0);

      return {
        ...current,
        layers: current.layers.map((layer) => {
          if (layer.id === id) {
            return { ...layer, ...patch };
          }

          if (shouldMoveChildren && layer.parentId === id) {
            return { ...layer, x: layer.x + deltaX, y: layer.y + deltaY };
          }

          return layer;
        }),
      };
    });
  }

  async function persistLayer(id: string, patch: LayerPatch) {
    if (!workspace.database.connected || !isPersistedId(id)) {
      return;
    }

    try {
      const response = await fetch(`/api/layers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar camada.");
      }

      const savedLayer = (await response.json()) as Layer;
      setWorkspace((current) => ({
        ...current,
        layers: current.layers.map((layer) => (layer.id === savedLayer.id ? savedLayer : layer)),
      }));
      setStatusMessage("Alteracao sincronizada com o Neon.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao salvar camada.");
    }
  }

  function commitLayerPatch(id: string, patch: LayerPatch) {
    updateLayerLocal(id, patch);
    void persistLayer(id, patch);
  }

  function commitMetadataPatch(layer: Layer, metadata: Record<string, unknown>) {
    commitLayerPatch(layer.id, { metadata: { ...layer.metadata, ...metadata } });
  }

  async function handleCreateLayer(kind: LayerKind, assetId: string | null = null, parentId: string | null = null) {
    const localLayer = defaultLayer(kind, workspace.activeScene.id, workspace.layers.length + 1, assetId);
    const layerWithParent = { ...localLayer, parentId };
    setWorkspace((current) => ({ ...current, layers: [...current.layers, layerWithParent] }));
    setSelectedLayerId(layerWithParent.id);

    if (!workspace.database.connected) {
      setStatusMessage("Camada adicionada localmente. Configure o Neon para persistir.");
      return;
    }

    try {
      const response = await fetch("/api/layers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: workspace.activeScene.id,
          kind,
          name: localLayer.name,
          parentId,
          assetId,
          x: localLayer.x,
          y: localLayer.y,
          width: localLayer.width,
          height: localLayer.height,
          fill: localLayer.fill,
          content: localLayer.content,
          metadata: localLayer.metadata,
        }),
      });

      if (!response.ok) {
        throw new Error("A API recusou a criacao da camada.");
      }

      const savedLayer = (await response.json()) as Layer;
      setWorkspace((current) => ({
        ...current,
        layers: current.layers.map((layer) => (layer.id === layerWithParent.id ? savedLayer : layer)),
      }));
      setSelectedLayerId(savedLayer.id);
      setStatusMessage("Camada gravada no Neon.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha ao criar camada.");
    }
  }

  async function handleFileSelected(file: File | undefined) {
    if (!file) {
      return;
    }

    const kind = assetKindFromFile(file);
    const dataUrl = await readFileAsDataUrl(file);
    const localAsset: Asset = {
      id: makeLocalId("local-asset"),
      streamerId: workspace.streamer.id,
      name: file.name,
      kind,
      mimeType: file.type,
      storageUrl: dataUrl,
      thumbnailUrl: kind === "image" || kind === "gif" ? dataUrl : null,
      sizeBytes: file.size,
      durationMs: null,
      metadata: { originalName: file.name },
      createdBy: "moderator",
      createdAt: new Date().toISOString(),
    };

    setWorkspace((current) => ({ ...current, assets: [localAsset, ...current.assets] }));

    let assetId = localAsset.id;

    if (workspace.database.connected) {
      try {
        const response = await fetch("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            streamerId: workspace.streamer.id,
            name: file.name,
            kind,
            mimeType: file.type,
            storageUrl: dataUrl,
            thumbnailUrl: kind === "image" || kind === "gif" ? dataUrl : null,
            sizeBytes: file.size,
            metadata: { originalName: file.name },
          }),
        });

        if (response.ok) {
          const savedAsset = (await response.json()) as Asset;
          assetId = savedAsset.id;
          setWorkspace((current) => ({
            ...current,
            assets: current.assets.map((asset) => (asset.id === localAsset.id ? savedAsset : asset)),
          }));
        }
      } catch {
        setStatusMessage("Asset importado localmente; a persistencia no Neon falhou.");
      }
    }

    await handleCreateLayer(kind, assetId, selectedLayer?.kind === "group" ? selectedLayer.id : null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function deleteLayerById(id: string) {
    const nextSelection = sortedLayers.find((layer) => layer.id !== id)?.id ?? "";
    setWorkspace((current) => ({
      ...current,
      layers: current.layers
        .filter((layer) => layer.id !== id)
        .map((layer) => (layer.parentId === id ? { ...layer, parentId: null } : layer)),
    }));
    setSelectedLayerId(nextSelection);

    if (!workspace.database.connected || !isPersistedId(id)) {
      setStatusMessage("Camada removida localmente.");
      return;
    }

    try {
      await fetch(`/api/layers/${id}`, { method: "DELETE" });
      setStatusMessage("Camada removida do Neon.");
    } catch {
      setStatusMessage("Camada removida localmente, mas a API nao confirmou a remocao.");
    }
  }

  async function deleteAssetById(id: string) {
    setWorkspace((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== id),
      layers: current.layers.map((layer) => (layer.assetId === id ? { ...layer, assetId: null } : layer)),
    }));

    if (!workspace.database.connected || !isPersistedId(id)) {
      setStatusMessage("Asset removido localmente.");
      return;
    }

    try {
      await fetch(`/api/assets/${id}`, { method: "DELETE" });
      setStatusMessage("Asset removido do Neon.");
    } catch {
      setStatusMessage("Asset removido localmente, mas a API nao confirmou a remocao.");
    }
  }

  function duplicateSelectedLayer() {
    if (!selectedLayer) {
      return;
    }

    const duplicate: Layer = {
      ...selectedLayer,
      id: makeLocalId("local-layer"),
      name: `${selectedLayer.name} copia`,
      x: selectedLayer.x + 28,
      y: selectedLayer.y + 28,
      orderIndex: Math.max(0, ...workspace.layers.map((layer) => layer.orderIndex)) + 1,
      locked: false,
    };

    setWorkspace((current) => ({ ...current, layers: [...current.layers, duplicate] }));
    setSelectedLayerId(duplicate.id);
    setStatusMessage("Camada duplicada localmente.");
  }

  function handlePointerDownCanvas(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".stage-layer")) {
      return;
    }

    dragRef.current = {
      mode: "pan",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerDownLayer(event: React.PointerEvent<HTMLDivElement>, layer: Layer) {
    event.stopPropagation();
    setSelectedLayerId(layer.id);

    if (layer.locked) {
      return;
    }

    dragRef.current = {
      mode: "layer",
      id: layer.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      childStarts: workspace.layers
        .filter((candidate) => candidate.parentId === layer.id)
        .map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y })),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerDownResize(event: React.PointerEvent<HTMLButtonElement>, layer: Layer, handle: ResizeHandle) {
    event.stopPropagation();
    setSelectedLayerId(layer.id);

    if (layer.locked) {
      return;
    }

    dragRef.current = {
      mode: "resize",
      id: layer.id,
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: layer.x,
      startY: layer.y,
      startWidth: layer.width,
      startHeight: layer.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    if (drag.mode === "pan") {
      setPan({
        x: drag.startPanX + event.clientX - drag.startClientX,
        y: drag.startPanY + event.clientY - drag.startClientY,
      });
      return;
    }

    if (drag.mode === "layer") {
      const deltaX = Math.round((event.clientX - drag.startClientX) / zoom);
      const deltaY = Math.round((event.clientY - drag.startClientY) / zoom);

      setWorkspace((current) => ({
        ...current,
        layers: current.layers.map((layer) => {
          if (layer.id === drag.id) {
            return { ...layer, x: drag.startX + deltaX, y: drag.startY + deltaY };
          }

          const childStart = drag.childStarts.find((child) => child.id === layer.id);
          if (childStart) {
            return { ...layer, x: childStart.x + deltaX, y: childStart.y + deltaY };
          }

          return layer;
        }),
      }));
      return;
    }

    const patch = getResizePatch(drag, event.clientX, event.clientY, zoom);
    updateLayerLocal(drag.id, patch);
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;

    if (!drag || drag.mode === "pan") {
      return;
    }

    const layer = workspace.layers.find((item) => item.id === drag.id);
    if (!layer) {
      return;
    }

    if (drag.mode === "layer") {
      void persistLayer(layer.id, { x: layer.x, y: layer.y });
      for (const child of workspace.layers.filter((item) => item.parentId === drag.id)) {
        void persistLayer(child.id, { x: child.x, y: child.y });
      }
      return;
    }

    void persistLayer(layer.id, { x: layer.x, y: layer.y, width: layer.width, height: layer.height });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((current) => {
      const next = current - event.deltaY * 0.0007;
      return Math.min(1.4, Math.max(0.28, Number(next.toFixed(2))));
    });
  }

  function copyOverlayUrl() {
    void navigator.clipboard?.writeText(overlayUrl);
    setStatusMessage("Link do OBS copiado.");
  }

  const childCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const layer of workspace.layers) {
      if (layer.parentId) {
        counts.set(layer.parentId, (counts.get(layer.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [workspace.layers]);

  return (
    <main className="moderator-app" aria-label="Painel de moderador StreamMode">
      <header className="topbar">
        <button
          className={`home-button ${streamerPanelOpen ? "is-active" : ""}`}
          type="button"
          aria-label="Conectar streamer"
          onClick={() => setStreamerPanelOpen((value) => !value)}
        >
          <Icon name="home" />
        </button>

        <button className="stream-tab is-active" type="button" onClick={() => setStreamerPanelOpen(true)}>
          <Icon name="stylus_note" />
          <span>{workspace.streamer.name}</span>
        </button>

        <button className="tab-add" type="button" aria-label="Conectar outro streamer" onClick={() => setStreamerPanelOpen(true)}>
          <Icon name="add" />
        </button>

        <div className="topbar-status" aria-live="polite">
          <span className={workspace.database.connected ? "status-dot is-online" : "status-dot"} />
          <span>{workspace.database.source === "neon" ? "Neon conectado" : "Modo local"}</span>
          <span className="topbar-divider" />
          <span>{statusMessage}</span>
        </div>
      </header>

      {streamerPanelOpen ? (
        <section className="streamer-switcher" aria-label="Conectar streamer">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void connectStreamer(streamKeyInput);
            }}
          >
            <label>
              <span>Stream key</span>
              <input
                value={streamKeyInput}
                onChange={(event) => setStreamKeyInput(event.target.value)}
                placeholder="streamer-1"
              />
            </label>
            <button type="submit">
              <Icon name="link" />
              <span>Conectar</span>
            </button>
          </form>
          <div className="streamer-recent">
            <span>Recentes</span>
            {recentStreamKeys.map((streamKey) => (
              <button key={streamKey} type="button" onClick={() => void connectStreamer(streamKey)}>
                <Icon name="radio_button_checked" />
                <span>{streamKey}</span>
              </button>
            ))}
          </div>
          <p>
            Use a mesma stream key configurada no link do OBS. O moderador edita aqui, e o overlay le em tempo real.
          </p>
        </section>
      ) : null}

      <section className="workspace">
        <aside className="left-panel" aria-label="Navegacao do projeto">
          <section className="stream-card" aria-label="Canal selecionado">
            <div className="avatar" aria-hidden="true">
              <span />
            </div>
            <div className="stream-meta">
              <p>[titulo da live]</p>
              <small>@[{workspace.streamer.handle}]</small>
            </div>
          </section>

          <nav className="panel-tabs" aria-label="Abas laterais">
            <button className={activeTab === "panel" ? "tab-current" : ""} type="button" onClick={() => setActiveTab("panel")}>
              Painel
            </button>
            <button className={activeTab === "assets" ? "tab-current" : ""} type="button" onClick={() => setActiveTab("assets")}>
              Recursos
            </button>
          </nav>

          {activeTab === "panel" ? (
            <>
              <section className="pages-section">
                <div className="section-heading">
                  <span>Paginas</span>
                  <button type="button" aria-label="Adicionar pagina">
                    <Icon name="add" />
                  </button>
                </div>
                {workspace.scenes.map((scene) => (
                  <button key={scene.id} className="page-item is-selected" type="button">
                    {scene.name}
                  </button>
                ))}
              </section>

              <section className="layers-section">
                <div className="section-heading">
                  <span>Camadas</span>
                </div>

                <div className="layers-stack" role="list" aria-label="Camadas da cena">
                  {sortedLayers.map((layer) => {
                    const depth = getLayerDepth(layer, layerById);
                    return (
                      <div
                        key={layer.id}
                        className={`layer-row ${layer.id === selectedLayer?.id ? "is-selected" : ""}`}
                        role="listitem"
                        style={{ "--layer-depth": depth } as React.CSSProperties}
                      >
                        <button className="layer-main" type="button" onClick={() => setSelectedLayerId(layer.id)}>
                          <Icon name={iconForKind(layer.kind)} />
                          <span>{layer.name}</span>
                        </button>
                        <div className="layer-row-actions">
                          <button
                            type="button"
                            aria-label={layer.visible ? "Ocultar camada" : "Mostrar camada"}
                            onClick={() => commitLayerPatch(layer.id, { visible: !layer.visible })}
                          >
                            <Icon name={layer.visible ? "visibility" : "visibility_off"} />
                          </button>
                          <button
                            type="button"
                            aria-label={layer.locked ? "Desbloquear camada" : "Bloquear camada"}
                            onClick={() => commitLayerPatch(layer.id, { locked: !layer.locked })}
                          >
                            <Icon name={layer.locked ? "lock" : "lock_open"} />
                          </button>
                          <button type="button" aria-label="Remover camada" onClick={() => void deleteLayerById(layer.id)}>
                            <Icon name="delete" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="layer-tools" aria-label="Adicionar elementos">
                  {addableKinds.map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      aria-label={`Adicionar ${item.label}`}
                      title={item.label}
                      onClick={() => void handleCreateLayer(item.kind, null, selectedLayer?.kind === "group" ? selectedLayer.id : null)}
                    >
                      <Icon name={item.icon} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="assets-section">
              <div className="section-heading">
                <span>Biblioteca</span>
                <button type="button" aria-label="Importar asset" onClick={() => fileInputRef.current?.click()}>
                  <Icon name="upload_file" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/*,audio/*,video/*"
                onChange={(event) => void handleFileSelected(event.target.files?.[0])}
              />
              <div className="asset-list">
                {workspace.assets.map((asset) => (
                  <div key={asset.id} className="asset-row">
                    <button className="asset-item" type="button" onClick={() => void handleCreateLayer(asset.kind, asset.id)}>
                      <span className="asset-icon">
                        <Icon name={iconForKind(asset.kind)} />
                      </span>
                      <span>
                        <strong>{asset.name}</strong>
                        <small>{asset.kind}</small>
                      </span>
                    </button>
                    <button className="asset-action" type="button" aria-label="Remover asset" onClick={() => void deleteAssetById(asset.id)}>
                      <Icon name="delete" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section
          className="canvas-area"
          aria-label="Area de pre-visualizacao"
          onPointerDown={handlePointerDownCanvas}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div className="canvas-corner" aria-hidden="true" />
          <button className="preview-pill" type="button">
            Preview
          </button>

          <div className="canvas-toolbar" aria-label="Controles do canvas">
            <button type="button" aria-label="Reduzir zoom" onClick={() => setZoom((value) => Math.max(0.28, Number((value - 0.08).toFixed(2))))}>
              <Icon name="remove" />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.08).toFixed(2))))}>
              <Icon name="add" />
            </button>
            <button type="button" aria-label="Centralizar canvas" onClick={() => setPan({ x: 56, y: 58 })}>
              <Icon name="filter_center_focus" />
            </button>
          </div>

          <div className="stage-viewport" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div
              className="broadcast-stage"
              style={{
                width: workspace.activeScene.width,
                height: workspace.activeScene.height,
                background: workspace.activeScene.background,
              }}
            >
              <div className="safe-guide guide-top" aria-hidden="true" />
              <div className="safe-guide guide-right" aria-hidden="true" />
              <div className="safe-guide guide-bottom" aria-hidden="true" />
              <div className="safe-guide guide-left" aria-hidden="true" />

              {sortedLayers.map((layer) => (
                <div
                  key={layer.id}
                  className={`stage-layer ${layer.id === selectedLayer?.id ? "is-selected" : ""} ${layer.locked ? "is-locked" : ""} ${layer.visible ? "" : "is-hidden"}`}
                  style={layerBoxStyle(layer)}
                  onPointerDown={(event) => handlePointerDownLayer(event, layer)}
                >
                  {renderLayer(layer, assetById.get(layer.assetId ?? ""), childCountByGroup.get(layer.id) ?? 0)}
                  {layer.id === selectedLayer?.id && !layer.locked
                    ? resizeHandles.map((handle) => (
                        <button
                          key={handle}
                          className={`resize-handle resize-${handle}`}
                          type="button"
                          aria-label={`Redimensionar ${handle}`}
                          onPointerDown={(event) => handlePointerDownResize(event, layer, handle)}
                        />
                      ))
                    : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="inspector" aria-label="Propriedades da camada">
          {selectedLayer ? (
            <>
              <section className="inspector-title">
                <Icon name={iconForKind(selectedLayer.kind)} />
                <span>{selectedLayer.name}</span>
                <div className="inspector-title-actions">
                  <button type="button" aria-label="Duplicar camada" onClick={duplicateSelectedLayer}>
                    <Icon name="content_copy" />
                  </button>
                  <button type="button" aria-label="Remover camada" onClick={() => void deleteLayerById(selectedLayer.id)}>
                    <Icon name="delete" />
                  </button>
                </div>
              </section>

              <div className="inspector-scroll">
                <section className="property-block">
                  <p className="property-label">Camada</p>
                  <label className="full-field">
                    <span>Nome</span>
                    <input
                      value={selectedLayer.name}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { name: event.target.value })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { name: event.target.value })}
                    />
                  </label>
                  <div className="toggle-row">
                    <button
                      className={selectedLayer.visible ? "toggle is-on" : "toggle"}
                      type="button"
                      onClick={() => commitLayerPatch(selectedLayer.id, { visible: !selectedLayer.visible })}
                    >
                      <Icon name={selectedLayer.visible ? "visibility" : "visibility_off"} />
                      <span>Visivel</span>
                    </button>
                    <button
                      className={selectedLayer.locked ? "toggle is-on" : "toggle"}
                      type="button"
                      onClick={() => commitLayerPatch(selectedLayer.id, { locked: !selectedLayer.locked })}
                    >
                      <Icon name={selectedLayer.locked ? "lock" : "lock_open"} />
                      <span>Bloqueio</span>
                    </button>
                  </div>
                  <label className="full-field">
                    <span>Grupo</span>
                    <select
                      value={selectedLayer.parentId ?? ""}
                      onChange={(event) => commitLayerPatch(selectedLayer.id, { parentId: event.target.value || null })}
                    >
                      <option value="">Sem grupo</option>
                      {groupLayers.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className="property-block align-block">
                  <p className="property-label">Alinhamento</p>
                  <div className="coordinate-row">
                    <label>
                      <span>X</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.x)}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { x: toFiniteNumber(event.target.value, selectedLayer.x) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { x: toFiniteNumber(event.target.value, selectedLayer.x) })}
                      />
                    </label>
                    <label>
                      <span>Y</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.y)}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { y: toFiniteNumber(event.target.value, selectedLayer.y) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { y: toFiniteNumber(event.target.value, selectedLayer.y) })}
                      />
                    </label>
                  </div>
                  <button className="move-button" type="button">
                    Mover com o mouse
                  </button>
                </section>

                <section className="property-block fill-block">
                  <p className="property-label">Aparencia</p>
                  <div className="fill-row">
                    <label className="color-control">
                      <input
                        className="native-color"
                        type="color"
                        value={normalizeHex(selectedLayer.fill)}
                        onChange={(event) => commitLayerPatch(selectedLayer.id, { fill: event.target.value })}
                      />
                      <input
                        type="text"
                        value={selectedLayer.fill.replace("#", "").toUpperCase()}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { fill: `#${event.target.value.replace("#", "")}` })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { fill: `#${event.target.value.replace("#", "")}` })}
                      />
                    </label>
                    <label className="opacity-control">
                      <span className="sr-only">Opacidade</span>
                      <input
                        type="text"
                        value={`${Math.round(selectedLayer.opacity)}%`}
                        onChange={(event) => {
                          const value = Number(event.target.value.replace("%", ""));
                          if (Number.isFinite(value)) {
                            updateLayerLocal(selectedLayer.id, { opacity: clamp(value, 0, 100) });
                          }
                        }}
                        onBlur={(event) => {
                          const value = Number(event.target.value.replace("%", ""));
                          if (Number.isFinite(value)) {
                            void persistLayer(selectedLayer.id, { opacity: clamp(value, 0, 100) });
                          }
                        }}
                      />
                    </label>
                  </div>
                  <label className="full-field">
                    <span>Blend</span>
                    <select
                      value={selectedLayer.blendMode}
                      onChange={(event) => commitLayerPatch(selectedLayer.id, { blendMode: event.target.value })}
                    >
                      {blendModes.map((blendMode) => (
                        <option key={blendMode} value={blendMode}>
                          {blendMode}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>

                <section className="property-block transform-block">
                  <p className="property-label">Transformacao</p>
                  <div className="mini-grid">
                    <label>
                      <span>W</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.width)}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { width: toFiniteNumber(event.target.value, selectedLayer.width) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { width: toFiniteNumber(event.target.value, selectedLayer.width) })}
                      />
                    </label>
                    <label>
                      <span>H</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.height)}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { height: toFiniteNumber(event.target.value, selectedLayer.height) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { height: toFiniteNumber(event.target.value, selectedLayer.height) })}
                      />
                    </label>
                    <label>
                      <span>R</span>
                      <input
                        type="number"
                        value={Math.round(selectedLayer.rotation)}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { rotation: toFiniteNumber(event.target.value, selectedLayer.rotation) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { rotation: toFiniteNumber(event.target.value, selectedLayer.rotation) })}
                      />
                    </label>
                    <label>
                      <span>Z</span>
                      <input
                        type="number"
                        value={selectedLayer.orderIndex}
                        onChange={(event) => updateLayerLocal(selectedLayer.id, { orderIndex: toFiniteNumber(event.target.value, selectedLayer.orderIndex) })}
                        onBlur={(event) => void persistLayer(selectedLayer.id, { orderIndex: toFiniteNumber(event.target.value, selectedLayer.orderIndex) })}
                      />
                    </label>
                  </div>
                </section>

                {selectedLayer.kind === "text" ? (
                  <section className="property-block type-block">
                    <p className="property-label">Tipografia</p>
                    <label className="full-field">
                      <span>Fonte</span>
                      <select
                        value={String(selectedLayer.metadata.fontFamily ?? "JetBrains Mono")}
                        onChange={(event) => commitMetadataPatch(selectedLayer, { fontFamily: event.target.value })}
                      >
                        {fontOptions.map((font) => (
                          <option key={font.value} value={font.value}>
                            {font.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mini-grid">
                      <label>
                        <span>T</span>
                        <input
                          type="number"
                          value={Number(selectedLayer.metadata.fontSize ?? 34)}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { fontSize: toFiniteNumber(event.target.value, 34) })}
                        />
                      </label>
                      <label>
                        <span>P</span>
                        <input
                          type="number"
                          value={Number(selectedLayer.metadata.fontWeight ?? 700)}
                          step={100}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { fontWeight: toFiniteNumber(event.target.value, 700) })}
                        />
                      </label>
                    </div>
                  </section>
                ) : null}

                {selectedLayer.kind === "frame" || selectedLayer.kind === "group" ? (
                  <section className="property-block">
                    <p className="property-label">{selectedLayer.kind === "group" ? "Pasta" : "Frame"}</p>
                    <div className="mini-grid">
                      <label>
                        <span>B</span>
                        <input
                          type="number"
                          value={Number(selectedLayer.metadata.strokeWidth ?? 2)}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { strokeWidth: toFiniteNumber(event.target.value, 2) })}
                        />
                      </label>
                      <label>
                        <span>R</span>
                        <input
                          type="number"
                          value={Number(selectedLayer.metadata.radius ?? 10)}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { radius: toFiniteNumber(event.target.value, 10) })}
                        />
                      </label>
                    </div>
                    <label className="full-field">
                      <span>Fundo</span>
                      <input
                        value={String(selectedLayer.metadata.background ?? "transparent")}
                        onChange={(event) => commitMetadataPatch(selectedLayer, { background: event.target.value })}
                      />
                    </label>
                    {selectedLayer.kind === "group" ? (
                      <div className="group-count">{childCountByGroup.get(selectedLayer.id) ?? 0} camadas dentro desta pasta</div>
                    ) : null}
                  </section>
                ) : null}

                {selectedLayer.kind === "image" || selectedLayer.kind === "gif" || selectedLayer.kind === "video" ? (
                  <section className="property-block">
                    <p className="property-label">Midia</p>
                    <label className="full-field">
                      <span>Ajuste</span>
                      <select
                        value={String(selectedLayer.metadata.objectFit ?? "contain")}
                        onChange={(event) => commitMetadataPatch(selectedLayer, { objectFit: event.target.value })}
                      >
                        <option value="contain">contain</option>
                        <option value="cover">cover</option>
                        <option value="fill">fill</option>
                      </select>
                    </label>
                    <div className="asset-binding">
                      <Icon name={selectedLayer.assetId ? "link" : "link_off"} />
                      <span>{assetById.get(selectedLayer.assetId ?? "")?.name ?? "Sem asset vinculado"}</span>
                    </div>
                  </section>
                ) : null}

                {selectedLayer.kind === "audio" ? (
                  <section className="property-block">
                    <p className="property-label">Audio</p>
                    <div className="mini-grid">
                      <label>
                        <span>V</span>
                        <input
                          type="number"
                          value={Number(selectedLayer.metadata.volume ?? 80)}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { volume: clamp(toFiniteNumber(event.target.value, 80), 0, 100) })}
                        />
                      </label>
                      <label>
                        <span>L</span>
                        <select
                          value={String(Boolean(selectedLayer.metadata.loop))}
                          onChange={(event) => commitMetadataPatch(selectedLayer, { loop: event.target.value === "true" })}
                        >
                          <option value="false">off</option>
                          <option value="true">on</option>
                        </select>
                      </label>
                    </div>
                  </section>
                ) : null}

                <section className="property-block content-block">
                  <p className="property-label">Conteudo</p>
                  <textarea
                    value={selectedLayer.content}
                    onChange={(event) => updateLayerLocal(selectedLayer.id, { content: event.target.value })}
                    onBlur={(event) => void persistLayer(selectedLayer.id, { content: event.target.value })}
                  />
                </section>

                <section className="property-block obs-block">
                  <p className="property-label">OBS</p>
                  <div className="overlay-link">
                    <input value={overlayUrl} readOnly aria-label="Link do overlay" />
                    <button type="button" aria-label="Copiar link do overlay" onClick={copyOverlayUrl}>
                      <Icon name="content_copy" />
                    </button>
                  </div>
                </section>
              </div>
            </>
          ) : (
            <section className="empty-inspector">
              <Icon name="layers" />
              <span>Nenhuma camada selecionada</span>
            </section>
          )}
        </aside>
      </section>
    </main>
  );
}

function iconForKind(kind: LayerKind) {
  const icons: Record<LayerKind, string> = {
    text: "text_fields",
    image: "image",
    frame: "dashboard",
    audio: "graphic_eq",
    video: "movie",
    gif: "gif_box",
    group: "folder",
  };

  return icons[kind];
}

function getLayerDepth(layer: Layer, layerById: Map<string, Layer>) {
  let depth = 0;
  let parentId = layer.parentId;

  while (parentId && depth < 4) {
    depth += 1;
    parentId = layerById.get(parentId)?.parentId ?? null;
  }

  return depth;
}

function getResizePatch(drag: Extract<DragState, { mode: "resize" }>, clientX: number, clientY: number, zoom: number): LayerPatch {
  const deltaX = Math.round((clientX - drag.startClientX) / zoom);
  const deltaY = Math.round((clientY - drag.startClientY) / zoom);
  const minWidth = 32;
  const minHeight = 32;
  let x = drag.startX;
  let y = drag.startY;
  let width = drag.startWidth;
  let height = drag.startHeight;

  if (drag.handle.includes("e")) {
    width = drag.startWidth + deltaX;
  }

  if (drag.handle.includes("s")) {
    height = drag.startHeight + deltaY;
  }

  if (drag.handle.includes("w")) {
    width = drag.startWidth - deltaX;
    x = drag.startX + deltaX;
  }

  if (drag.handle.includes("n")) {
    height = drag.startHeight - deltaY;
    y = drag.startY + deltaY;
  }

  if (width < minWidth) {
    if (drag.handle.includes("w")) {
      x -= minWidth - width;
    }
    width = minWidth;
  }

  if (height < minHeight) {
    if (drag.handle.includes("n")) {
      y -= minHeight - height;
    }
    height = minHeight;
  }

  return { x, y, width, height };
}

function layerBoxStyle(layer: Layer): React.CSSProperties {
  return {
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    zIndex: layer.orderIndex,
    opacity: layer.opacity / 100,
    mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
    transform: `rotate(${layer.rotation}deg)`,
  };
}

function normalizeHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#f6dae0";
}

function renderLayer(layer: Layer, asset: Asset | undefined, childCount: number) {
  const fontSize = Number(layer.metadata.fontSize ?? 34);
  const lineHeight = Number(layer.metadata.lineHeight ?? 1.1);
  const radius = Number(layer.metadata.radius ?? 10);
  const strokeWidth = Number(layer.metadata.strokeWidth ?? 2);
  const objectFit = String(layer.metadata.objectFit ?? "contain") as React.CSSProperties["objectFit"];

  if (layer.kind === "text") {
    return (
      <div
        className="render-text"
        style={{
          color: layer.fill,
          fontFamily: resolveFontFamily(layer.metadata.fontFamily),
          fontSize,
          fontWeight: Number(layer.metadata.fontWeight ?? 700),
          lineHeight,
        }}
      >
        {layer.content}
      </div>
    );
  }

  if ((layer.kind === "image" || layer.kind === "gif") && asset?.storageUrl) {
    return <img className="render-media" src={asset.storageUrl} alt={asset.name} style={{ objectFit }} />;
  }

  if (layer.kind === "video" && asset?.storageUrl) {
    return <video className="render-media" src={asset.storageUrl} muted loop playsInline autoPlay style={{ objectFit }} />;
  }

  if (layer.kind === "image" || layer.kind === "gif" || layer.kind === "video") {
    return (
      <div className="render-placeholder">
        <Icon name={iconForKind(layer.kind)} />
        <span>Sem asset vinculado</span>
      </div>
    );
  }

  if (layer.kind === "audio") {
    return (
      <div className="render-audio">
        <Icon name="graphic_eq" />
        <span>{asset?.name ?? layer.name}</span>
      </div>
    );
  }

  if (layer.kind === "group") {
    return (
      <div
        className="render-group"
        style={{
          borderColor: layer.fill,
          borderWidth: strokeWidth,
          borderRadius: radius,
          background: String(layer.metadata.background ?? "rgba(93, 111, 143, 0.12)"),
        }}
      >
        <Icon name="folder" />
        <span>{layer.name}</span>
        <small>{childCount} itens</small>
      </div>
    );
  }

  return (
    <div
      className="render-frame"
      style={{
        borderColor: layer.fill,
        borderWidth: strokeWidth,
        borderRadius: radius,
        background: String(layer.metadata.background ?? "rgba(154, 64, 89, 0.12)"),
      }}
    />
  );
}
