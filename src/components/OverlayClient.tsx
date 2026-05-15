"use client";

import { useEffect, useMemo, useState } from "react";
import type { Asset, Layer, Scene } from "@/lib/types";

type OverlayPayload = {
  scene: Scene;
  layers: Layer[];
  assets: Asset[];
};

type OverlayClientProps = {
  streamKey: string;
  initialScene: Scene;
  initialLayers: Layer[];
  initialAssets: Asset[];
};

export function OverlayClient({ streamKey, initialScene, initialLayers, initialAssets }: OverlayClientProps) {
  const [payload, setPayload] = useState<OverlayPayload>({
    scene: initialScene,
    layers: initialLayers,
    assets: initialAssets,
  });

  const assetById = useMemo(() => {
    return new Map(payload.assets.map((asset) => [asset.id, asset]));
  }, [payload.assets]);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(`/api/overlay/${streamKey}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const nextPayload = (await response.json()) as OverlayPayload;
        if (active) {
          setPayload(nextPayload);
        }
      } catch {
        return;
      }
    }

    const interval = window.setInterval(refresh, 1200);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [streamKey]);

  return (
    <main className="overlay-shell" style={{ background: payload.scene.background }}>
      {payload.layers
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((layer) => (
          <div key={layer.id} className="overlay-layer" style={overlayLayerStyle(layer, payload.scene)}>
            {renderOverlayLayer(layer, assetById.get(layer.assetId ?? ""))}
          </div>
        ))}
    </main>
  );
}

function overlayLayerStyle(layer: Layer, scene: Scene): React.CSSProperties {
  return {
    left: `${(layer.x / scene.width) * 100}%`,
    top: `${(layer.y / scene.height) * 100}%`,
    width: `${(layer.width / scene.width) * 100}%`,
    height: `${(layer.height / scene.height) * 100}%`,
    zIndex: layer.orderIndex,
    opacity: layer.opacity / 100,
    transform: `rotate(${layer.rotation}deg)`,
  };
}

function renderOverlayLayer(layer: Layer, asset?: Asset) {
  const fontSize = Number(layer.metadata.fontSize ?? 34);

  if (layer.kind === "text") {
    return (
      <div
        className="overlay-text"
        style={{
          color: layer.fill,
          fontFamily: String(layer.metadata.fontFamily ?? "JetBrains Mono NFP"),
          fontSize: `${fontSize / 19.2}vw`,
          fontWeight: Number(layer.metadata.fontWeight ?? 700),
        }}
      >
        {layer.content}
      </div>
    );
  }

  if ((layer.kind === "image" || layer.kind === "gif") && asset?.storageUrl) {
    return <img className="overlay-media" src={asset.storageUrl} alt="" />;
  }

  if (layer.kind === "video" && asset?.storageUrl) {
    return <video className="overlay-media" src={asset.storageUrl} muted loop playsInline autoPlay />;
  }

  if (layer.kind === "frame") {
    return (
      <div
        className="overlay-frame"
        style={{
          borderColor: layer.fill,
          borderWidth: Number(layer.metadata.strokeWidth ?? 2),
          borderRadius: Number(layer.metadata.radius ?? 10),
        }}
      />
    );
  }

  return null;
}
