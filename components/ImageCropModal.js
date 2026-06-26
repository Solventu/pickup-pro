"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import Modal from "./Modal";

// Output edge of the square crop (px). Keeps uploads small but crisp.
const OUTPUT_SIZE = 1080;

// Draw the selected square region onto a canvas and return a JPEG blob.
async function getCroppedBlob(src, area) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );
}

export default function ImageCropModal({ open, src, onCancel, onCropped }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_, pixels) => setAreaPixels(pixels), []);

  const apply = async () => {
    if (!areaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, areaPixels);
      onCropped(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onCancel} title="Crop photo (1:1)">
      <div className="relative h-72 w-full overflow-hidden rounded-xl border border-line bg-black">
        {src && (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
            showGrid={false}
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="mono text-xs text-muted">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-accent"
          aria-label="Zoom"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-muted" disabled={busy}>
          Cancel
        </button>
        <button onClick={apply} className="btn btn-primary" disabled={busy || !areaPixels}>
          {busy ? "Cropping…" : "Apply crop"}
        </button>
      </div>
    </Modal>
  );
}
