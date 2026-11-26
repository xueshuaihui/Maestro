/**
 * Workflow canvas viewport: zoom + pan.
 *
 * The canvas used to be a fixed `viewBox` fitted to the content, so a 12-stage
 * flow rendered as unreadable miniatures with no way in. This module owns the
 * geometry of the viewport (pure functions) plus one opt-in gesture installer
 * (wheel to zoom, drag on empty space to pan).
 *
 * Zoom is expressed as a multiplier over the fitted base box, so `1` is always
 * "the whole flow fits" regardless of how many stages it has. Pan is stored in
 * base (pre-zoom) units: the rendering pass is then a pure function of
 * `(base, viewport)` and survives the shell's full repaint.
 *
 * Zero CJK and no business rules: wording belongs to the label tables, node
 * geometry to the projection.
 */

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 1.25;

export function clampZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Normalize whatever the state holds into `{zoom, pan}`. */
export function normalizeViewport(viewport) {
  const pan = viewport?.pan;
  return {
    zoom: clampZoom(viewport?.zoom ?? 1),
    pan: {
      x: Number.isFinite(pan?.x) ? pan.x : 0,
      y: Number.isFinite(pan?.y) ? pan.y : 0,
    },
  };
}

/**
 * The fitted box for a set of placed nodes. 40px of air on every side; the
 * minimum size keeps a single-stage flow from filling the panel edge to edge.
 */
export function baseBox(nodes, { minWidth = 960, minHeight = 360, pad = 40 } = {}) {
  const placed = Array.isArray(nodes) ? nodes.filter((node) => node && Number.isFinite(Number(node.x))) : [];
  if (placed.length === 0) return { x: 0, y: 0, width: minWidth, height: minHeight };
  const minX = Math.min(...placed.map((node) => Number(node.x)));
  const minY = Math.min(...placed.map((node) => Number(node.y)));
  const maxX = Math.max(...placed.map((node) => Number(node.x) + Number(node.width ?? 180)));
  const maxY = Math.max(...placed.map((node) => Number(node.y) + Number(node.height ?? 80)));
  return {
    x: minX - pad,
    y: minY - pad,
    width: Math.max(maxX - minX + pad * 2, minWidth),
    height: Math.max(maxY - minY + pad * 2, minHeight),
  };
}

/** Visible rect in scene coordinates for one viewport. */
export function visibleBox(base, viewport) {
  const { zoom, pan } = normalizeViewport(viewport);
  const width = base.width / zoom;
  const height = base.height / zoom;
  const cx = base.x + base.width / 2 + pan.x;
  const cy = base.y + base.height / 2 + pan.y;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** `viewBox` attribute value for one viewport. */
export function viewBoxAttr(base, viewport) {
  const box = visibleBox(base, viewport);
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

/**
 * Zoom while keeping the scene point under `point` (scene coordinates) at the
 * same place on screen. Without this, wheel zoom drifts away from the cursor.
 */
export function zoomAround(base, viewport, nextZoom, point) {
  const current = normalizeViewport(viewport);
  const before = visibleBox(base, current);
  const anchor = {
    x: Number.isFinite(point?.x) ? point.x : before.x + before.width / 2,
    y: Number.isFinite(point?.y) ? point.y : before.y + before.height / 2,
  };
  const fx = before.width === 0 ? 0.5 : (anchor.x - before.x) / before.width;
  const fy = before.height === 0 ? 0.5 : (anchor.y - before.y) / before.height;
  const zoom = clampZoom(nextZoom);
  const width = base.width / zoom;
  const height = base.height / zoom;
  const originX = anchor.x - fx * width;
  const originY = anchor.y - fy * height;
  return {
    zoom,
    pan: {
      x: originX + width / 2 - (base.x + base.width / 2),
      y: originY + height / 2 - (base.y + base.height / 2),
    },
  };
}

/** Move the view by a delta expressed in scene units. */
export function panBy(base, viewport, dx, dy) {
  const current = normalizeViewport(viewport);
  const { zoom } = current;
  // A pointer moves over the *visible* box, so a client-pixel delta maps to
  // `delta / zoom` scene units. Kept explicit here so both callers agree.
  return {
    zoom,
    pan: { x: current.pan.x - dx / zoom, y: current.pan.y - dy / zoom },
  };
}

/**
 * Install wheel-zoom and background-drag pan on the painted canvas.
 *
 * @param {HTMLElement} host mount root
 * @param {{base: object, viewport: object,
 *          onChange?: (viewport: {zoom:number, pan:{x:number,y:number}}) => void}} options
 * @returns {() => void} detach function (called before the next paint)
 */
export function attachCanvasViewport(host, options = {}) {
  const svg = host?.querySelector?.('.canvas-svg') ?? null;
  if (svg === null || !options.base) return () => {};
  let viewport = normalizeViewport(options.viewport);
  let gesture = null;

  const commit = () => {
    svg.setAttribute('viewBox', viewBoxAttr(options.base, viewport));
    options.onChange?.(viewport);
  };

  const toScene = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const box = visibleBox(options.base, viewport);
    if (rect.width === 0 || rect.height === 0) return { x: box.x, y: box.y };
    return {
      x: box.x + ((clientX - rect.left) / rect.width) * box.width,
      y: box.y + ((clientY - rect.top) / rect.height) * box.height,
    };
  };

  const onWheel = (event) => {
    // Any wheel inside the canvas is a zoom: letting the page scroll instead
    // is the "canvas feels dead" experience this fixes.
    event.preventDefault();
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    viewport = zoomAround(options.base, viewport, viewport.zoom * factor, toScene(event.clientX, event.clientY));
    commit();
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    // Nodes own their own drag (drag.js); only empty canvas pans.
    if (event.target?.closest?.('g.canvas-node')) return;
    if (event.target?.closest?.('[data-action="canvas-edge"]')) return;
    gesture = { x: event.clientX, y: event.clientY };
    svg.classList.add('panning');
  };

  const onPointerMove = (event) => {
    if (gesture === null) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (dx === 0 && dy === 0) return;
    gesture = { x: event.clientX, y: event.clientY };
    // Client pixels -> visible box units -> scene units (panBy handles zoom).
    // Dragging right moves the content right, i.e. the viewport centre moves
    // left in scene coordinates — exactly what `panBy`'s sign does.
    const rect = svg.getBoundingClientRect();
    const box = visibleBox(options.base, viewport);
    const sx = rect.width === 0 ? dx : (dx / rect.width) * box.width;
    const sy = rect.height === 0 ? dy : (dy / rect.height) * box.height;
    viewport = panBy(options.base, viewport, sx, sy);
    commit();
    event.preventDefault();
  };

  const onPointerUp = () => {
    if (gesture === null) return;
    gesture = null;
    svg.classList.remove('panning');
  };

  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('pointerdown', onPointerDown);
  globalThis.addEventListener?.('pointermove', onPointerMove);
  globalThis.addEventListener?.('pointerup', onPointerUp);
  globalThis.addEventListener?.('pointercancel', onPointerUp);

  return () => {
    svg.removeEventListener('wheel', onWheel);
    svg.removeEventListener('pointerdown', onPointerDown);
    globalThis.removeEventListener?.('pointermove', onPointerMove);
    globalThis.removeEventListener?.('pointerup', onPointerUp);
    globalThis.removeEventListener?.('pointercancel', onPointerUp);
  };
}
