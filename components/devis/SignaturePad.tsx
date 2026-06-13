"use client";

// ============================================================
// SOCLE — PV de réception — <SignaturePad>
// Signature manuscrite tactile, capturée au doigt sur mobile. Ne gère QUE le
// tracé : produit un data-URL PNG via onChange. Le parent (phase D) l'emballe
// dans `PVSignature { dataUrl, nom, date }` — le nom et la date ne sont PAS du
// ressort de ce composant.
//
// - Souris ET tactile via un seul jeu de Pointer Events.
// - devicePixelRatio géré : canvas en pixels réels, mis à l'échelle en CSS →
//   trait net sur écran haute densité.
// - touch-action: none sur le canvas → signer au doigt ne fait pas scroller.
// - Aucune dépendance externe.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import "./signature-pad.css";

export interface SignaturePadProps {
  /** Data-URL PNG initial (ré-affiche une signature existante). */
  value?: string;
  /** Appelé à chaque fin de tracé. `null` si le pad est vide/effacé. */
  onChange?: (dataUrl: string | null) => void;
  /** Libellé optionnel, ex. « Signature du client ». */
  label?: string;
  /** Hauteur CSS du canvas (px). Défaut 180 — confortable au doigt. */
  height?: number;
}

const STROKE = "#0a0a0a"; // noir SOCLE — document client en noir uniquement
const LINE_WIDTH = 2.2;

export default function SignaturePad({
  value,
  onChange,
  label,
  height = 180,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasContentRef = useRef(false);
  const lastEmittedRef = useRef<string | null>(null);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    []
  );

  /** Dessine un data-URL pour remplir le canvas (ré-affichage / restauration). */
  const drawDataUrl = useCallback((url: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = url;
  }, []);

  /** (Re)dimensionne le backing store selon le dpr, restaure le tracé courant. */
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    // Snapshot avant resize (changer canvas.width vide le canvas).
    const prev = hasContentRef.current ? canvas.toDataURL("image/png") : null;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    // Dessiner en coordonnées CSS (px logiques) : net en haute densité.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeStyle = STROKE;
    ctx.fillStyle = STROKE;
    const restore = prev ?? value ?? null;
    if (restore) drawDataUrl(restore);
  }, [drawDataUrl, value]);

  // Montage : configure le canvas + observe les changements de largeur.
  useEffect(() => {
    setupCanvas();
    if (value) {
      hasContentRef.current = true;
      setHasContent(true);
      lastEmittedRef.current = value;
    }
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(canvas);
    return () => ro.disconnect();
    // Montage uniquement : la resync de `value` est gérée par l'effet dédié.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resync `value` piloté par le parent (ré-affichage / effacement externe).
  // Garde-fou anti-boucle : on ignore la valeur qu'on vient nous-mêmes d'émettre.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (value) {
      drawDataUrl(value);
      hasContentRef.current = true;
      setHasContent(true);
    } else {
      hasContentRef.current = false;
      setHasContent(false);
    }
    lastEmittedRef.current = value ?? null;
  }, [value, drawDataUrl, getCtx]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    canvas.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const p = pointFromEvent(e);
    lastRef.current = p;
    // Point isolé : un simple tap laisse une marque.
    ctx.beginPath();
    ctx.arc(p.x, p.y, LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const p = pointFromEvent(e);
    const last = lastRef.current ?? p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* capture déjà relâchée */
    }
    hasContentRef.current = true;
    setHasContent(true);
    const url = canvas.toDataURL("image/png");
    lastEmittedRef.current = url;
    onChange?.(url);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasContentRef.current = false;
    setHasContent(false);
    lastEmittedRef.current = null;
    onChange?.(null);
  };

  return (
    <div className="sigpad">
      {label ? <div className="sigpad-label">{label}</div> : null}
      <div className="sigpad-frame">
        <div className="sigpad-baseline" aria-hidden="true" />
        {!hasContent ? (
          <div className="sigpad-hint" aria-hidden="true">
            Signez dans le cadre
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className="sigpad-canvas"
          style={{ height }}
          role="img"
          aria-label={label ?? "Zone de signature"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
        />
      </div>
      <div className="sigpad-actions">
        <button
          type="button"
          className="sigpad-clear"
          onClick={clear}
          disabled={!hasContent}
        >
          Effacer
        </button>
      </div>
    </div>
  );
}
