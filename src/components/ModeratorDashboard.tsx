"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, Layer, LayerKind, LayerPatch, WorkspaceSnapshot } from "@/lib/types";

type DashboardProps = {
  initialWorkspace: WorkspaceSnapshot;
};

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
      metadata: { fontFamily: "JetBrains Mono NFP", fontSize: 34, fontWeight: 700 },
    };
  }

  if (kind === "frame") {
    return {
      ...base,
      name: "Novo frame",
      width: 520,
      height: 300,
      fill: "#9a4059",
      metadata: { radius: 10, strokeWidth: 2 },
    };
  }

  if (kind === "audio") {
    return { ...base, name: "Novo audio", width: 330, height: 76 };
  }

  if (kind === "video") {
    return { ...base, name: "Novo video", width: 480, height: 270 };
  }

  if (kind === "gif") {
    return { ...base, name: "Novo GIF", width: 320, height: 240 };
  }

  if (kind === "group") {
    return { ...base, name: "Novo grupo", width: 560, height: 360, fill: "#5d6f8f" };
  }

  return { ...base, name: "Nova imagem", width: 360, height: 240 };
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

export function ModeratorDashboard({ initialWorkspace }: DashboardProps) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [selectedLayerId, setSelectedLayerId] = useState(initialWorkspace.layers[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<"panel" | "assets">("panel");
  const [zoom, setZoom] = useState(0.58);
  const [pan, setPan] = useState({ x: 56, y: 58 });
  const [statusMessage, setStatusMessage] = useState(initialWorkspace.database.message);
  const [overlayUrl, setOverlayUrl] = useState(initialWorkspace.overlayUrl);
  const dragRef = useRef<DragState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLayer = useMemo(
    () => workspace.layers.find((layer) => layer.id === selectedLayerId) ?? workspace.layers[0],
    [selectedLayerId, workspace.layers],
  );

  const assetById = useMemo(() => {
    return new Map(workspace.assets.map((asset) => [asset.id, asset]));
  }, [workspace.assets]);

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/${workspace.streamer.streamKey}`);
  }, [workspace.streamer.streamKey]);

  function updateLayerLocal(id: string, patch: LayerPatch) {
    setWorkspace((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }));
  }

  async function persistLayer(id: string, patch: LayerPatch) {
    if (!workspace.database.connected || id.startsWith("mock-") || id.startsWith("local-")) {
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

  async function handleCreateLayer(kind: LayerKind, assetId: string | null = null) {
    const localLayer = defaultLayer(kind, workspace.activeScene.id, workspace.layers.length + 1, assetId);
    setWorkspace((current) => ({ ...current, layers: [...current.layers, localLayer] }));
    setSelectedLayerId(localLayer.id);

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
        layers: current.layers.map((layer) => (layer.id === localLayer.id ? savedLayer : layer)),
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

    await handleCreateLayer(kind, assetId);
  }

  function handlePointerDownCanvas(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
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

    updateLayerLocal(drag.id, {
      x: Math.round(drag.startX + (event.clientX - drag.startClientX) / zoom),
      y: Math.round(drag.startY + (event.clientY - drag.startClientY) / zoom),
    });
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;

    if (drag?.mode === "layer") {
      const layer = workspace.layers.find((item) => item.id === drag.id);
      if (layer) {
        void persistLayer(layer.id, { x: layer.x, y: layer.y });
      }
    }
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

  const sortedLayers = [...workspace.layers].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <main className="moderator-app" aria-label="Painel de moderador StreamMode">
      <header className="topbar">
        <button className="home-button" type="button" aria-label="Inicio">
          <Icon name="home" />
        </button>

        <button className="stream-tab is-active" type="button">
          <Icon name="stylus_note" />
          <span>{workspace.streamer.name}</span>
        </button>

        <button className="tab-add" type="button" aria-label="Adicionar streamer">
          <Icon name="add" />
        </button>

        <div className="topbar-status" aria-live="polite">
          <span className={workspace.database.connected ? "status-dot is-online" : "status-dot"} />
          <span>{workspace.database.source === "neon" ? "Neon conectado" : "Modo local"}</span>
          <span className="topbar-divider" />
          <span>{statusMessage}</span>
        </div>
      </header>

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
                  {sortedLayers.map((layer) => (
                    <button
                      key={layer.id}
                      className={`layer-item ${layer.id === selectedLayer?.id ? "is-selected" : ""}`}
                      type="button"
                      role="listitem"
                      onClick={() => setSelectedLayerId(layer.id)}
                    >
                      <Icon name={iconForKind(layer.kind)} />
                      <span>{layer.name}</span>
                    </button>
                  ))}
                </div>

                <div className="layer-tools" aria-label="Adicionar elementos">
                  {addableKinds.map((item) => (
                    <button key={item.kind} type="button" aria-label={`Adicionar ${item.label}`} title={item.label} onClick={() => void handleCreateLayer(item.kind)}>
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
                  <button key={asset.id} className="asset-item" type="button" onClick={() => void handleCreateLayer(asset.kind, asset.id)}>
                    <span className="asset-icon">
                      <Icon name={iconForKind(asset.kind)} />
                    </span>
                    <span>
                      <strong>{asset.name}</strong>
                      <small>{asset.kind}</small>
                    </span>
                  </button>
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

          <div
            className="stage-viewport"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
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
                  className={`stage-layer ${layer.id === selectedLayer?.id ? "is-selected" : ""} ${layer.locked ? "is-locked" : ""}`}
                  style={layerBoxStyle(layer)}
                  onPointerDown={(event) => handlePointerDownLayer(event, layer)}
                >
                  {renderLayer(layer, assetById.get(layer.assetId ?? ""))}
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
              </section>

              <section className="property-block align-block">
                <p className="property-label">Alinhamento</p>
                <div className="coordinate-row">
                  <label>
                    <span>X</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.x)}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { x: Number(event.target.value) })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { x: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>Y</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.y)}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { y: Number(event.target.value) })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { y: Number(event.target.value) })}
                    />
                  </label>
                </div>
                <button className="move-button" type="button">
                  Mover com o mouse
                </button>
              </section>

              <section className="property-block type-block">
                <p className="property-label">Tipografia</p>
                <label className="select-shell">
                  <span className="sr-only">Fonte</span>
                  <select
                    value={String(selectedLayer.metadata.fontFamily ?? "JetBrains Mono NFP")}
                    onChange={(event) =>
                      commitLayerPatch(selectedLayer.id, {
                        metadata: { ...selectedLayer.metadata, fontFamily: event.target.value },
                      })
                    }
                  >
                    <option>JetBrains Mono NFP</option>
                    <option>JetBrains Mono</option>
                    <option>Roboto Mono</option>
                    <option>Material Symbols Outlined</option>
                  </select>
                </label>
              </section>

              <section className="property-block fill-block">
                <p className="property-label">Preenchimento</p>
                <div className="fill-row">
                  <label className="color-control">
                    <span className="color-swatch" style={{ background: selectedLayer.fill }} aria-hidden="true" />
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
                          updateLayerLocal(selectedLayer.id, { opacity: value });
                        }
                      }}
                      onBlur={(event) => {
                        const value = Number(event.target.value.replace("%", ""));
                        if (Number.isFinite(value)) {
                          void persistLayer(selectedLayer.id, { opacity: value });
                        }
                      }}
                    />
                  </label>
                </div>
              </section>

              <section className="property-block transform-block">
                <p className="property-label">Transformacao</p>
                <div className="mini-grid">
                  <label>
                    <span>W</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.width)}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { width: Number(event.target.value) })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { width: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>H</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.height)}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { height: Number(event.target.value) })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { height: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>R</span>
                    <input
                      type="number"
                      value={Math.round(selectedLayer.rotation)}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { rotation: Number(event.target.value) })}
                      onBlur={(event) => void persistLayer(selectedLayer.id, { rotation: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    <span>Z</span>
                    <input
                      type="number"
                      value={selectedLayer.orderIndex}
                      onChange={(event) => updateLayerLocal(selectedLayer.id, { metadata: { ...selectedLayer.metadata, nextOrder: Number(event.target.value) } })}
                    />
                  </label>
                </div>
              </section>

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

function layerBoxStyle(layer: Layer): React.CSSProperties {
  return {
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    zIndex: layer.orderIndex,
    opacity: layer.opacity / 100,
    transform: `rotate(${layer.rotation}deg)`,
  };
}

function renderLayer(layer: Layer, asset?: Asset) {
  const fontSize = Number(layer.metadata.fontSize ?? 34);
  const radius = Number(layer.metadata.radius ?? 10);
  const strokeWidth = Number(layer.metadata.strokeWidth ?? 2);

  if (layer.kind === "text") {
    return (
      <div
        className="render-text"
        style={{
          color: layer.fill,
          fontFamily: String(layer.metadata.fontFamily ?? "JetBrains Mono NFP"),
          fontSize,
          fontWeight: Number(layer.metadata.fontWeight ?? 700),
        }}
      >
        {layer.content}
      </div>
    );
  }

  if ((layer.kind === "image" || layer.kind === "gif") && asset?.storageUrl) {
    return <img className="render-media" src={asset.storageUrl} alt={asset.name} />;
  }

  if (layer.kind === "video" && asset?.storageUrl) {
    return <video className="render-media" src={asset.storageUrl} muted loop playsInline autoPlay />;
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
      <div className="render-group" style={{ borderColor: layer.fill }}>
        <span>{layer.name}</span>
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
      }}
    />
  );
}
