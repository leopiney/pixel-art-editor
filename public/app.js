// Pixel grid editor. Cells are "#rrggbb" or null (transparent).
const PALETTE = [
  "#000000", "#1d2b53", "#7e2553", "#008751",
  "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
  "#ff004d", "#ffa300", "#ffec27", "#00e436",
  "#29adff", "#83769c", "#ff77a8", "#ffccaa",
];

const canvas = document.getElementById("canvas");
const colorInput = document.getElementById("color");
const colorHex = document.getElementById("color-hex");
const paletteEl = document.getElementById("palette");
const widthInput = document.getElementById("width");
const heightInput = document.getElementById("height");
const gridInput = document.getElementById("grid");
const statusEl = document.getElementById("status");
const exportHint = document.getElementById("export-hint");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");

const state = {
  w: 16,
  h: 16,
  cells: [],
  tool: "pencil",
  color: "#000000",
  cell: 16,
  history: [],
  future: [],
};

let strokeBefore = null;
let lastCell = null;

function blank(w, h) {
  return new Array(w * h).fill(null);
}

function capture() {
  return { w: state.w, h: state.h, cells: state.cells.slice() };
}

function differs(snap) {
  if (!snap || snap.w !== state.w || snap.h !== state.h) return true;
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i] !== snap.cells[i]) return true;
  }
  return false;
}

function updateHistoryButtons() {
  undoBtn.disabled = state.history.length === 0;
  redoBtn.disabled = state.future.length === 0;
}

function commitBefore(before) {
  if (!differs(before)) return;
  state.history.push(before);
  if (state.history.length > 100) state.history.shift();
  state.future = [];
  updateHistoryButtons();
}

function restore(snap) {
  state.w = snap.w;
  state.h = snap.h;
  state.cells = snap.cells.slice();
  widthInput.value = String(snap.w);
  heightInput.value = String(snap.h);
  render();
  setStatus();
}

function undo() {
  if (!state.history.length) return;
  state.future.push(capture());
  restore(state.history.pop());
  updateHistoryButtons();
}

function redo() {
  if (!state.future.length) return;
  state.history.push(capture());
  restore(state.future.pop());
  updateHistoryButtons();
}

function setStatus(extra) {
  statusEl.textContent = `${state.w}×${state.h} · ${state.tool}${extra ? " · " + extra : ""}`;
}

function setHint(message) {
  exportHint.textContent = message || `PNG exports at ${state.w}×${state.h}, one pixel per cell.`;
}

function normalizeHex(value) {
  const hex = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return state.color;
}

function setColor(value) {
  state.color = normalizeHex(value);
  colorInput.value = state.color;
  colorHex.textContent = state.color;
  for (const swatch of paletteEl.children) {
    swatch.classList.toggle("active", swatch.dataset.color === state.color);
  }
}

function setTool(tool) {
  state.tool = tool;
  canvas.className = `tool-${tool}`;
  for (const button of document.querySelectorAll(".tools button")) {
    button.classList.toggle("active", button.dataset.tool === tool);
  }
  setStatus();
}

function buildPalette() {
  paletteEl.replaceChildren();
  for (const color of PALETTE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.dataset.color = color;
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => setColor(color));
    paletteEl.appendChild(button);
  }
}

function render() {
  const stage = document.querySelector(".stage");
  const availW = Math.max(160, (stage.clientWidth || 640) - 40);
  const availH = Math.max(160, (stage.clientHeight || 640) - 48);
  const cell = Math.max(1, Math.floor(Math.min(availW / state.w, availH / state.h, 36)));
  state.cell = cell;

  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${state.w * cell}px`;
  canvas.style.height = `${state.h * cell}px`;
  canvas.width = Math.round(state.w * cell * dpr);
  canvas.height = Math.round(state.h * cell * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      const color = state.cells[y * state.w + x];
      ctx.fillStyle = color || ((x + y) % 2 === 0 ? "#23252c" : "#2c2e36");
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  if (gridInput.checked && cell >= 6) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.w; x++) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, state.h * cell);
    }
    for (let y = 0; y <= state.h; y++) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(state.w * cell, y * cell + 0.5);
    }
    ctx.stroke();
  }
}

function cellAt(event) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.w);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.h);
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return null;
  return [x, y];
}

function line(x0, y0, x1, y1, plot) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function paintCell(x, y) {
  const next = state.tool === "eraser" ? null : state.color;
  state.cells[y * state.w + x] = next;
}

function paintTo(x, y) {
  if (lastCell) line(lastCell[0], lastCell[1], x, y, paintCell);
  else paintCell(x, y);
  lastCell = [x, y];
  render();
}

function floodFill(x, y) {
  const target = state.cells[y * state.w + x];
  const replacement = state.color;
  if (target === replacement) return false;
  const seen = new Uint8Array(state.w * state.h);
  const stack = [[x, y]];
  let changed = false;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= state.w || cy >= state.h) continue;
    const i = cy * state.w + cx;
    if (seen[i] || state.cells[i] !== target) continue;
    seen[i] = 1;
    state.cells[i] = replacement;
    changed = true;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return changed;
}

function endStroke() {
  if (!strokeBefore) return;
  commitBefore(strokeBefore);
  strokeBefore = null;
  lastCell = null;
}

function onPointerDown(event) {
  if (event.button !== 0) return;
  const cell = cellAt(event);
  if (!cell) return;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic events and some browsers have no active pointer to capture.
  }
  const [x, y] = cell;
  if (state.tool === "picker") {
    const color = state.cells[y * state.w + x];
    if (color) setColor(color);
    setStatus(color || "transparent");
    return;
  }
  if (state.tool === "fill") {
    const before = capture();
    if (floodFill(x, y)) {
      commitBefore(before);
      render();
    }
    return;
  }
  strokeBefore = capture();
  lastCell = null;
  paintTo(x, y);
  setStatus(`${x}, ${y}`);
}

function onPointerMove(event) {
  const cell = cellAt(event);
  if (!strokeBefore) {
    setStatus(cell ? `${cell[0]}, ${cell[1]}` : "");
    return;
  }
  if (!cell) return;
  paintTo(cell[0], cell[1]);
  setStatus(`${cell[0]}, ${cell[1]}`);
}

function clampSize(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(128, Math.max(1, n));
}

function resizeTo(w, h) {
  if (w === state.w && h === state.h) return;
  const before = capture();
  const next = blank(w, h);
  const copyW = Math.min(state.w, w);
  const copyH = Math.min(state.h, h);
  for (let y = 0; y < copyH; y++) {
    for (let x = 0; x < copyW; x++) {
      next[y * w + x] = state.cells[y * state.w + x];
    }
  }
  state.w = w;
  state.h = h;
  state.cells = next;
  widthInput.value = String(w);
  heightInput.value = String(h);
  commitBefore(before);
  render();
  setStatus();
  setHint();
}

function applySizeFromInputs() {
  const w = clampSize(widthInput.value);
  const h = clampSize(heightInput.value);
  if (w === null || h === null) return;
  widthInput.value = String(w);
  heightInput.value = String(h);
  resizeTo(w, h);
}

function clearCanvas() {
  if (state.cells.every((cell) => cell === null)) return;
  const before = capture();
  state.cells = blank(state.w, state.h);
  commitBefore(before);
  render();
  setStatus("cleared");
}

function fileName() {
  const raw = document.getElementById("name").value.trim() || "sprite";
  const safe = raw.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${safe || "sprite"}-${state.w}x${state.h}.png`;
}

function exportCanvas() {
  const out = document.createElement("canvas");
  out.width = state.w;
  out.height = state.h;
  const ctx = out.getContext("2d");
  const image = ctx.createImageData(state.w, state.h);
  for (let i = 0; i < state.cells.length; i++) {
    const color = state.cells[i];
    if (!color) continue;
    const n = parseInt(color.slice(1), 16);
    image.data[i * 4] = (n >> 16) & 255;
    image.data[i * 4 + 1] = (n >> 8) & 255;
    image.data[i * 4 + 2] = n & 255;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

function exportPng() {
  const name = fileName();
  exportCanvas().toBlob((blob) => {
    if (!blob) {
      setHint("Export failed.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    // Keep the object URL alive briefly so the browser can start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setHint(`Downloaded ${name}`);
  }, "image/png");
}

function onKeyDown(event) {
  const typing = event.target instanceof Element && event.target.matches("input, textarea");
  const key = event.key.toLowerCase();
  if ((event.metaKey || event.ctrlKey) && key === "z" && !typing) {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y" && !typing) {
    event.preventDefault();
    redo();
    return;
  }
  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
  if (key === "b") setTool("pencil");
  else if (key === "e") setTool("eraser");
  else if (key === "g") setTool("fill");
  else if (key === "i") setTool("picker");
  else if (event.key === "#") {
    gridInput.checked = !gridInput.checked;
    render();
  }
}

function boot() {
  state.cells = blank(state.w, state.h);
  buildPalette();
  setColor(PALETTE[0]);
  setTool("pencil");
  setHint();
  updateHistoryButtons();
  render();

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  for (const button of document.querySelectorAll(".tools button")) {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  }
  colorInput.addEventListener("input", () => setColor(colorInput.value));
  document.getElementById("resize-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applySizeFromInputs();
  });
  for (const button of document.querySelectorAll(".presets button")) {
    button.addEventListener("click", () => {
      const n = button.dataset.size;
      widthInput.value = n;
      heightInput.value = n;
      applySizeFromInputs();
    });
  }
  gridInput.addEventListener("change", render);
  document.getElementById("clear").addEventListener("click", clearCanvas);
  document.getElementById("export").addEventListener("click", exportPng);
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", render);
  requestAnimationFrame(render);
}

boot();
