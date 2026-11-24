/**
 * Workflow canvas editing seam (v2).
 *
 * The shell repaints the whole SVG on every frame, so drag state is kept only
 * for the duration of one pointer gesture. Committed positions are stored in
 * localStorage under one key, keyed by workflow id and node id; the assembly
 * applies them after layout and hands them back here on drag end. No CJK and
 * no business rules live in this file — it only translates pointer motion
 * into SVG coordinates and calls the caller's callback.
 */

const STORAGE_KEY = 'maestro.canvas.layout';

function tableOf(storage) {
  try {
    const raw = JSON.parse(storage?.getItem?.(STORAGE_KEY) ?? '{}');
    return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** @returns {Record<string, {x:number,y:number}>} offsets for one workflow */
export function readCanvasOffsets(storage, workflowId) {
  const table = tableOf(storage);
  const entry = table[workflowId];
  return entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
}

/** Persist one node position. Returns false when storage is unavailable. */
export function saveCanvasOffset(storage, workflowId, nodeId, x, y) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    const table = tableOf(storage);
    const existing = table[workflowId];
    const scope = existing !== null && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    scope[nodeId] = { x: Number(x), y: Number(y) };
    table[workflowId] = scope;
    storage.setItem(STORAGE_KEY, JSON.stringify(table));
    return true;
  } catch {
    return false;
  }
}

/** Remove every stored position of one workflow ("reset layout"). */
export function clearCanvasOffsets(storage, workflowId) {
  try {
    const table = tableOf(storage);
    delete table[workflowId];
    storage?.setItem?.(STORAGE_KEY, JSON.stringify(table));
    return true;
  } catch {
    return false;
  }
}

function svgPoint(svg, clientX, clientY) {
  try {
    if (typeof svg.createSVGPoint === 'function') {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const matrix = svg.getScreenCTM?.();
      if (matrix) {
        const transformed = point.matrixTransform(matrix.inverse());
        return { x: transformed.x, y: transformed.y };
      }
    }
  } catch {
    // fall through to the viewport ratio
  }
  const rect = svg.getBoundingClientRect();
  const box = svg.viewBox?.baseVal;
  if (!box || rect.width === 0 || rect.height === 0) return { x: clientX, y: clientY };
  return {
    x: box.x + ((clientX - rect.left) / rect.width) * box.width,
    y: box.y + ((clientY - rect.top) / rect.height) * box.height,
  };
}

/**
 * Install drag handling on the currently painted canvas.
 *
 * @param {HTMLElement} host mount root
 * @param {{onMove?: (id:string,x:number,y:number)=>void}} hooks
 * @returns {() => void} detach function (called before the next paint)
 */
export function attachCanvasDrag(host, hooks = {}) {
  const svg = host?.querySelector?.('.canvas-svg') ?? null;
  if (svg === null) return () => {};

  let gesture = null;
  let suppressClick = false;

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const group = event.target?.closest?.('g.canvas-node[data-arg]') ?? null;
    if (group === null || !svg.contains(group)) return;
    let arg = null;
    try {
      arg = JSON.parse(group.getAttribute('data-arg') ?? '{}');
    } catch {
      return;
    }
    const id = typeof arg.id === 'string' ? arg.id : null;
    if (id === null) return;
    const rect = group.querySelector('rect');
    if (rect === null) return;
    gesture = {
      id,
      group,
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      start: svgPoint(svg, event.clientX, event.clientY),
      dx: 0,
      dy: 0,
    };
    try {
      group.setPointerCapture?.(event.pointerId);
    } catch {
      // Some SVG implementations refuse capture; window-level move still works.
    }
  };

  const onPointerMove = (event) => {
    if (gesture === null) return;
    const current = svgPoint(svg, event.clientX, event.clientY);
    gesture.dx = current.x - gesture.start.x;
    gesture.dy = current.y - gesture.start.y;
    if (Math.abs(gesture.dx) + Math.abs(gesture.dy) < 2) return;
    gesture.group.setAttribute('transform', `translate(${gesture.dx} ${gesture.dy})`);
    event.preventDefault();
  };

  const onPointerUp = () => {
    if (gesture === null) return;
    const done = gesture;
    gesture = null;
    done.group.removeAttribute('transform');
    if (Math.abs(done.dx) + Math.abs(done.dy) < 3) return;
    suppressClick = true;
    const x = Math.round(done.x + done.dx);
    const y = Math.round(done.y + done.dy);
    hooks.onMove?.(done.id, x, y);
  };

  const onClickCapture = (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.stopPropagation();
    event.preventDefault();
  };

  svg.addEventListener('pointerdown', onPointerDown);
  // Move/up live on window so a refused setPointerCapture cannot kill a drag.
  globalThis.addEventListener?.('pointermove', onPointerMove);
  globalThis.addEventListener?.('pointerup', onPointerUp);
  globalThis.addEventListener?.('pointercancel', onPointerUp);
  svg.addEventListener('click', onClickCapture, true);

  return () => {
    svg.removeEventListener('pointerdown', onPointerDown);
    globalThis.removeEventListener?.('pointermove', onPointerMove);
    globalThis.removeEventListener?.('pointerup', onPointerUp);
    globalThis.removeEventListener?.('pointercancel', onPointerUp);
    svg.removeEventListener('click', onClickCapture, true);
  };
}
