import { useCallback, useEffect, useRef, useState } from 'react';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.12;
const MAX_SCALE = 2.5;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/**
 * Pan and zoom for the tree stage: drag or wheel with a mouse, one-finger drag
 * and two-finger pinch on touch. Implemented on pointer events so both input
 * kinds share one code path.
 */
export function useViewport() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);

  // Live pointer state lives in refs so the move handler never re-subscribes.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; midX: number; midY: number } | null>(null);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    setViewport((v) => {
      const scale = clampScale(v.scale * factor);
      const applied = scale / v.scale;
      // Keep the point under the cursor fixed while the scale changes.
      return { scale, x: px - (px - v.x) * applied, y: py - (py - v.y) * applied };
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.card, .chip, .union, .panel')) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      setPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const previousGesture = gesture.current;
      if (previousGesture && previousGesture.distance > 0) {
        const rect = stageRef.current?.getBoundingClientRect();
        if (rect) {
          const dx = midX - previousGesture.midX;
          const dy = midY - previousGesture.midY;
          const factor = distance / previousGesture.distance;
          const px = midX - rect.left;
          const py = midY - rect.top;
          setViewport((v) => {
            const scale = clampScale(v.scale * factor);
            const applied = scale / v.scale;
            return {
              scale,
              x: px - (px - v.x) * applied + dx,
              y: py - (py - v.y) * applied + dy,
            };
          });
        }
      }
      gesture.current = { distance, midX, midY };
      return;
    }

    const dx = e.clientX - previous.x;
    const dy = e.clientY - previous.y;
    setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, []);

  const endPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) setPanning(false);
  }, []);

  // Wheel is bound natively because React's synthetic wheel listener is
  // passive, and zooming has to preventDefault to stop the page scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (e.shiftKey) {
        setViewport((v) => ({ ...v, x: v.x - e.deltaY }));
      } else {
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
      }
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const fit = useCallback((contentWidth: number, contentHeight: number) => {
    const stage = stageRef.current;
    if (!stage || contentWidth <= 0 || contentHeight <= 0) return;
    const { clientWidth: w, clientHeight: h } = stage;
    const scale = clampScale(Math.min(w / contentWidth, h / contentHeight, 1));
    setViewport({
      scale,
      x: (w - contentWidth * scale) / 2,
      y: Math.max(0, (h - contentHeight * scale) / 2),
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }, [zoomAt]);

  /**
   * Pans just enough to bring a canvas-space rectangle inside the visible area.
   * `inset` reserves the space the detail panel occupies, so selecting somebody
   * on the right never hides them behind their own panel.
   */
  const ensureVisible = useCallback(
    (
      box: { x: number; y: number; width: number; height: number },
      inset: { top?: number; right?: number; bottom?: number; left?: number } = {},
    ) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pad = 24;
      const left = pad + (inset.left ?? 0);
      const top = pad + (inset.top ?? 0);
      const right = stage.clientWidth - pad - (inset.right ?? 0);
      const bottom = stage.clientHeight - pad - (inset.bottom ?? 0);

      setViewport((v) => {
        const sx = box.x * v.scale + v.x;
        const sy = box.y * v.scale + v.y;
        const sw = box.width * v.scale;
        const sh = box.height * v.scale;
        let dx = 0;
        let dy = 0;
        if (sx < left) dx = left - sx;
        else if (sx + sw > right) dx = Math.max(right - (sx + sw), left - sx);
        if (sy < top) dy = top - sy;
        else if (sy + sh > bottom) dy = Math.max(bottom - (sy + sh), top - sy);
        return dx === 0 && dy === 0 ? v : { ...v, x: v.x + dx, y: v.y + dy };
      });
    },
    [],
  );

  return {
    stageRef,
    viewport,
    panning,
    fit,
    zoomBy,
    ensureVisible,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer,
    },
  };
}
