import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";

type Crop = { x: number; y: number; size: number };
type Dimensions = { width: number; height: number };
type Drag = { pointerId: number; mode: "move" | "resize"; x: number; y: number; crop: Crop };

const OUTPUT_SIZE = 640;
const MIN_CROP_SIZE = 200;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function AvatarCropDialog({ file, onCancel, onConfirm }: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [src, setSrc] = useState("");
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    closeRef.current?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { URL.revokeObjectURL(url); document.body.style.overflow = oldOverflow; };
  }, [file]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const imageLoaded = () => {
    const image = imageRef.current;
    if (!image) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) {
      setError("照片長寬都需要至少 200 像素，請換一張照片。");
      return;
    }
    if (width * height > 25_000_000) {
      setError("照片解析度過高，請先縮小至 2500 萬像素以下。");
      return;
    }
    const size = Math.min(width, height);
    setDimensions({ width, height });
    setCrop({ x: (width - size) / 2, y: (height - size) / 2, size });
  };

  const startDrag = (event: PointerEvent<HTMLElement>, mode: Drag["mode"]) => {
    if (!crop) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, crop };
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const image = imageRef.current;
    if (!drag || !dimensions || !image || event.pointerId !== drag.pointerId) return;
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (event.clientX - drag.x) * dimensions.width / rect.width;
    const dy = (event.clientY - drag.y) * dimensions.height / rect.height;
    if (drag.mode === "move") {
      setCrop({ ...drag.crop,
        x: clamp(drag.crop.x + dx, 0, dimensions.width - drag.crop.size),
        y: clamp(drag.crop.y + dy, 0, dimensions.height - drag.crop.size),
      });
    } else {
      const size = clamp(drag.crop.size + Math.max(dx, dy), MIN_CROP_SIZE,
        Math.min(dimensions.width - drag.crop.x, dimensions.height - drag.crop.y));
      setCrop({ ...drag.crop, size });
    }
  };

  const changeSize = (size: number) => {
    if (!crop || !dimensions) return;
    const centerX = crop.x + crop.size / 2;
    const centerY = crop.y + crop.size / 2;
    setCrop({ size, x: clamp(centerX - size / 2, 0, dimensions.width - size),
      y: clamp(centerY - size / 2, 0, dimensions.height - size) });
  };

  const confirm = async () => {
    const image = imageRef.current;
    if (!image || !crop || !dimensions || busy) return;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("此瀏覽器無法裁切照片。");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.x, crop.y, crop.size, crop.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(result => result ? resolve(result) : reject(new Error("裁切失敗，請再試一次。")), "image/webp", 0.86));
      const isWebp = blob.type === "image/webp";
      onConfirm(new File([blob], isWebp ? "avatar.webp" : "avatar.png", { type: blob.type }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "裁切失敗，請再試一次。");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="member-crop-backdrop">
      <div ref={dialogRef} className="member-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="member-crop-title">
        <div className="member-crop-header">
          <div><h2 id="member-crop-title">調整頭像照片</h2><p>拖動方框選取位置，拖動右下角或使用滑桿調整大小。</p></div>
          <button ref={closeRef} type="button" className="member-crop-close" onClick={onCancel} disabled={busy} aria-label="取消裁切">✕</button>
        </div>
        <div className="member-crop-stage">
          <div className="member-crop-image-wrap">
            <img ref={imageRef} src={src} alt="待裁切的照片" onLoad={imageLoaded} onError={() => setError("無法讀取這張照片，請選擇其他檔案。")} />
            {crop && dimensions && <div className="member-crop-frame"
              style={{ left: `${crop.x / dimensions.width * 100}%`, top: `${crop.y / dimensions.height * 100}%`,
                width: `${crop.size / dimensions.width * 100}%`, height: `${crop.size / dimensions.height * 100}%` }}
              onPointerDown={event => startDrag(event, "move")}
              onPointerMove={moveDrag}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}>
              <span className="member-crop-grid" aria-hidden="true" />
              <span className="member-crop-handle" aria-hidden="true"
                onPointerDown={event => startDrag(event, "resize")} />
            </div>}
          </div>
        </div>
        {crop && dimensions && <div className="member-crop-sliders">
          <label>裁切框大小 <input type="range" min={MIN_CROP_SIZE} max={Math.min(dimensions.width, dimensions.height)} step="1"
            value={Math.round(crop.size)} onChange={event => changeSize(Number(event.target.value))} /></label>
          <label>左右位置 <input type="range" min="0" max={Math.max(0, dimensions.width - crop.size)} step="1"
            value={Math.round(crop.x)} onChange={event => setCrop(current => current ? { ...current, x: Number(event.target.value) } : current)} /></label>
          <label>上下位置 <input type="range" min="0" max={Math.max(0, dimensions.height - crop.size)} step="1"
            value={Math.round(crop.y)} onChange={event => setCrop(current => current ? { ...current, y: Number(event.target.value) } : current)} /></label>
        </div>}
        {error && <p className="member-error" role="alert">{error}</p>}
        <div className="member-crop-actions">
          <button type="button" className="member-crop-cancel" onClick={onCancel} disabled={busy}>取消</button>
          <button type="button" className="member-primary" onClick={confirm} disabled={!crop || busy}>{busy ? "裁切中…" : "確認裁切"}</button>
        </div>
      </div>
    </div>, document.body,
  );
}
