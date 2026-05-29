const supportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
]);

const folderInput = document.querySelector("#folderInput");
const columnsInput = document.querySelector("#columnsInput");
const paddingInput = document.querySelector("#paddingInput");
const cellModeInput = document.querySelector("#cellModeInput");
const manualWidthInput = document.querySelector("#manualWidthInput");
const manualHeightInput = document.querySelector("#manualHeightInput");
const outlierModeInput = document.querySelector("#outlierModeInput");
const trimInput = document.querySelector("#trimInput");
const gridInput = document.querySelector("#gridInput");
const gridColorInput = document.querySelector("#gridColorInput");
const previewBgModeInput = document.querySelector("#previewBgModeInput");
const previewBgColorInput = document.querySelector("#previewBgColorInput");
const exportBgModeInput = document.querySelector("#exportBgModeInput");
const exportBgColorInput = document.querySelector("#exportBgColorInput");
const buildButton = document.querySelector("#buildButton");
const downloadLink = document.querySelector("#downloadLink");
const themeToggle = document.querySelector("#themeToggle");
const fileCount = document.querySelector("#fileCount");
const cellSize = document.querySelector("#cellSize");
const atlasSize = document.querySelector("#atlasSize");
const outlierCount = document.querySelector("#outlierCount");
const emptyState = document.querySelector("#emptyState");
const atlasFrame = document.querySelector("#atlasFrame");
const canvas = document.querySelector("#atlasCanvas");
const ctx = canvas.getContext("2d");
const highlightCanvas = document.querySelector("#highlightCanvas");
const highlightCtx = highlightCanvas.getContext("2d");
const zoomInput = document.querySelector("#zoomInput");
const zoomValue = document.querySelector("#zoomValue");
const zoomOutButton = document.querySelector("#zoomOutButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomResetButton = document.querySelector("#zoomResetButton");
const manualSizeControls = document.querySelectorAll(".manual-size");
const inspectorName = document.querySelector("#inspectorName");
const inspectorMode = document.querySelector("#inspectorMode");
const inspectorBgInput = document.querySelector("#inspectorBgInput");
const inspectorStage = document.querySelector("#inspectorStage");
const inspectorCanvas = document.querySelector("#inspectorCanvas");
const inspectorCtx = inspectorCanvas.getContext("2d");
const inspectorTile = document.querySelector("#inspectorTile");
const inspectorSize = document.querySelector("#inspectorSize");
const orderCount = document.querySelector("#orderCount");
const orderList = document.querySelector("#orderList");
const removedCount = document.querySelector("#removedCount");
const removedList = document.querySelector("#removedList");

let selectedFiles = [];
let currentObjectUrls = [];
let atlasState = null;
let removedSprites = [];
let hoveredTileIndex = -1;
let swapStartIndex = -1;
let pinnedTileIndex = -1;
let dragStartIndex = -1;
let didDragTile = false;
const naturalPathSorter = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const settingsStorageKey = "sprite-packer-settings-v1";
let currentTheme = "dark";
const persistedControls = [
  columnsInput,
  paddingInput,
  cellModeInput,
  manualWidthInput,
  manualHeightInput,
  outlierModeInput,
  trimInput,
  gridInput,
  gridColorInput,
  previewBgModeInput,
  previewBgColorInput,
  exportBgModeInput,
  exportBgColorInput,
  zoomInput,
  inspectorBgInput,
];

function readControlValue(control) {
  return control.type === "checkbox" ? control.checked : control.value;
}

function writeControlValue(control, value) {
  if (value === undefined) {
    return;
  }

  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = String(value);
  }
}

function collectSettings() {
  return {
    theme: currentTheme,
    ...Object.fromEntries(persistedControls.map((control) => [control.id, readControlValue(control)])),
  };
}

function saveSettings() {
  try {
    localStorage.setItem(settingsStorageKey, JSON.stringify(collectSettings()));
  } catch (error) {
    console.warn("Sprite Packer settings could not be saved.", error);
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsStorageKey) || "{}");
    applyTheme(saved.theme === "light" ? "light" : "dark", false);
    for (const control of persistedControls) {
      writeControlValue(control, saved[control.id]);
    }
  } catch (error) {
    console.warn("Sprite Packer settings could not be loaded.", error);
  }
}

function handleSettingsChange() {
  saveSettings();
}

function applyTheme(theme, shouldSave = true) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.body.classList.toggle("light-theme", currentTheme === "light");

  if (themeToggle) {
    themeToggle.textContent = currentTheme === "light" ? "☀" : "☾";
    themeToggle.setAttribute(
      "aria-label",
      currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode",
    );
  }

  if (shouldSave) {
    saveSettings();
  }
}

function toggleTheme() {
  applyTheme(currentTheme === "light" ? "dark" : "light");
}

function getZoomScale() {
  return 2 ** Number.parseFloat(zoomInput.value);
}

function updateZoom() {
  const scale = getZoomScale();
  zoomValue.textContent = `${Math.round(scale * 100)}%`;

  if (canvas.width > 0 && canvas.height > 0) {
    atlasFrame.style.width = `${Math.max(1, Math.round(canvas.width * scale))}px`;
    atlasFrame.style.height = `${Math.max(1, Math.round(canvas.height * scale))}px`;
  }
}

function setZoomSliderValue(value) {
  const min = Number.parseFloat(zoomInput.min);
  const max = Number.parseFloat(zoomInput.max);
  const nextValue = Math.min(max, Math.max(min, value));
  zoomInput.value = String(nextValue);
  handleSettingsChange();
  updateZoom();
  renderHighlights();
}

function updatePreviewBackground() {
  atlasFrame.classList.remove("preview-bg-checker", "preview-bg-dark", "preview-bg-light");
  atlasFrame.style.backgroundColor = "";

  if (previewBgModeInput.value === "checker") {
    atlasFrame.classList.add("preview-bg-checker");
  } else if (previewBgModeInput.value === "dark") {
    atlasFrame.classList.add("preview-bg-dark");
  } else if (previewBgModeInput.value === "light") {
    atlasFrame.classList.add("preview-bg-light");
  } else {
    atlasFrame.style.backgroundColor = previewBgColorInput.value;
  }
}

function updateDownloadLink() {
  if (!atlasState) {
    setDownloadEnabled(false);
    return;
  }

  if (exportBgModeInput.value === "transparent") {
    downloadLink.href = canvas.toDataURL("image/png");
    setDownloadEnabled(true);
    return;
  }

  const exportCanvas = makeCanvas(canvas.width, canvas.height);
  const exportContext = exportCanvas.getContext("2d");
  exportContext.fillStyle = exportBgColorInput.value;
  exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportContext.drawImage(canvas, 0, 0);
  downloadLink.href = exportCanvas.toDataURL("image/png");
  setDownloadEnabled(true);
}

function isSupportedImage(file) {
  if (supportedTypes.has(file.type)) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
}

function setDownloadEnabled(enabled) {
  downloadLink.classList.toggle("disabled", !enabled);
  if (!enabled) {
    downloadLink.removeAttribute("href");
  }
}

function resetAtlas() {
  atlasFrame.hidden = true;
  emptyState.hidden = false;
  cellSize.textContent = "-";
  atlasSize.textContent = "-";
  outlierCount.textContent = "-";
  atlasState = null;
  removedSprites = [];
  hoveredTileIndex = -1;
  swapStartIndex = -1;
  pinnedTileIndex = -1;
  dragStartIndex = -1;
  didDragTile = false;
  clearHighlight();
  clearInspector();
  renderOrderList();
  renderRemovedList();
  setDownloadEnabled(false);
}

function updateFileCount() {
  const count = selectedFiles.length;
  fileCount.textContent = `${count} image${count === 1 ? "" : "s"}`;
  buildButton.disabled = count === 0;
}

function revokeObjectUrls() {
  for (const url of currentObjectUrls) {
    URL.revokeObjectURL(url);
  }
  currentObjectUrls = [];
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    currentObjectUrls.push(url);

    image.onload = () => {
      resolve({
        file,
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(new Error(`Could not load ${file.name}`));
    };

    image.src = url;
  });
}

async function loadImages(files) {
  revokeObjectUrls();
  const loaded = await Promise.all(files.map(loadImage));
  return loaded.filter((item) => item.width > 0 && item.height > 0);
}

function normalizeNumberInput(input, fallback, minimum = 0) {
  const value = Number.parseInt(input.value, 10);
  const normalized = Math.max(minimum, Number.isFinite(value) ? value : fallback);
  input.value = String(normalized);
  return normalized;
}

function getTrimBounds(canvasToTrim) {
  const trimContext = canvasToTrim.getContext("2d");
  const { width, height } = canvasToTrim;
  const pixels = trimContext.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha !== 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX === -1) {
    return { x: 0, y: 0, width, height, trimmed: false };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    trimmed: minX !== 0 || minY !== 0 || maxX !== width - 1 || maxY !== height - 1,
  };
}

function makeCanvas(width, height) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

function drawSpriteInCell(targetContext, item, x, y, cell, padding) {
  const contentX = x + padding;
  const contentY = y + padding;
  const drawX = contentX + Math.floor((cell.width - item.width) / 2);
  const drawY = contentY + Math.floor((cell.height - item.height) / 2);

  targetContext.save();
  targetContext.beginPath();
  targetContext.rect(contentX, contentY, cell.width, cell.height);
  targetContext.clip();
  targetContext.drawImage(item.source, drawX, drawY);
  targetContext.restore();
}

function drawAtlasContent() {
  if (!atlasState) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  for (const [index, item] of atlasState.images.entries()) {
    const column = index % atlasState.columns;
    const row = Math.floor(index / atlasState.columns);
    drawSpriteInCell(
      ctx,
      item,
      column * atlasState.cellWidth,
      row * atlasState.cellHeight,
      atlasState.cell,
      atlasState.padding,
    );
  }

  updateDownloadLink();
}

function resizeAtlasToImageCount() {
  if (!atlasState) {
    return;
  }

  const rows = Math.max(1, Math.ceil(atlasState.images.length / atlasState.columns));
  canvas.width = atlasState.columns * atlasState.cellWidth;
  canvas.height = rows * atlasState.cellHeight;
  highlightCanvas.width = canvas.width;
  highlightCanvas.height = canvas.height;
  atlasSize.textContent = `${canvas.width} x ${canvas.height}px`;
  updateZoom();
}

function getTrackedItems() {
  if (!atlasState) {
    return {
      hoveredItem: null,
      pinnedItem: null,
      swapItem: null,
      dragItem: null,
    };
  }

  return {
    hoveredItem: atlasState.images[hoveredTileIndex] ?? null,
    pinnedItem: atlasState.images[pinnedTileIndex] ?? null,
    swapItem: atlasState.images[swapStartIndex] ?? null,
    dragItem: atlasState.images[dragStartIndex] ?? null,
  };
}

function restoreTrackedIndices(tracked) {
  if (!atlasState) {
    hoveredTileIndex = -1;
    pinnedTileIndex = -1;
    swapStartIndex = -1;
    dragStartIndex = -1;
    return;
  }

  hoveredTileIndex = tracked.hoveredItem ? atlasState.images.indexOf(tracked.hoveredItem) : -1;
  pinnedTileIndex = tracked.pinnedItem ? atlasState.images.indexOf(tracked.pinnedItem) : -1;
  swapStartIndex = tracked.swapItem ? atlasState.images.indexOf(tracked.swapItem) : -1;
  dragStartIndex = tracked.dragItem ? atlasState.images.indexOf(tracked.dragItem) : -1;
}

function refreshAtlasAfterOrderChange() {
  resizeAtlasToImageCount();
  drawAtlasContent();
  renderHighlights();
  renderOrderList();
  renderRemovedList();

  if (atlasState?.images.length === 0) {
    hoveredTileIndex = -1;
    pinnedTileIndex = -1;
    swapStartIndex = -1;
    clearInspector();
  } else if (hoveredTileIndex !== -1) {
    drawInspectorTile(hoveredTileIndex);
  } else if (pinnedTileIndex !== -1) {
    drawInspectorTile(pinnedTileIndex, "Pinned");
  } else {
    clearInspector();
  }
}

function removeAtlasImage(index) {
  if (!atlasState || index < 0 || index >= atlasState.images.length) {
    return;
  }

  const removed = atlasState.images.splice(index, 1)[0];
  removedSprites.push(removed);

  if (hoveredTileIndex === index) hoveredTileIndex = -1;
  if (pinnedTileIndex === index) pinnedTileIndex = -1;
  if (swapStartIndex === index) swapStartIndex = -1;
  if (dragStartIndex === index) dragStartIndex = -1;

  if (hoveredTileIndex > index) hoveredTileIndex -= 1;
  if (pinnedTileIndex > index) pinnedTileIndex -= 1;
  if (swapStartIndex > index) swapStartIndex -= 1;
  if (dragStartIndex > index) dragStartIndex -= 1;

  refreshAtlasAfterOrderChange();
}

function restoreRemovedImage(index) {
  if (!atlasState || index < 0 || index >= removedSprites.length) {
    return;
  }

  const [restored] = removedSprites.splice(index, 1);
  atlasState.images.push(restored);
  pinnedTileIndex = atlasState.images.length - 1;
  hoveredTileIndex = -1;
  swapStartIndex = -1;
  dragStartIndex = -1;
  refreshAtlasAfterOrderChange();
}

function moveAtlasImage(fromIndex, toIndex) {
  if (
    !atlasState ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= atlasState.images.length ||
    toIndex >= atlasState.images.length
  ) {
    return;
  }

  const tracked = getTrackedItems();
  const [item] = atlasState.images.splice(fromIndex, 1);
  atlasState.images.splice(toIndex, 0, item);
  restoreTrackedIndices(tracked);
  refreshAtlasAfterOrderChange();
}

function renderOrderList() {
  if (!orderList || !orderCount) {
    return;
  }

  orderList.innerHTML = "";
  const count = atlasState?.images.length ?? 0;
  orderCount.textContent = `${count} sprite${count === 1 ? "" : "s"}`;

  if (!atlasState) {
    return;
  }

  for (const [index, item] of atlasState.images.entries()) {
    const row = document.createElement("li");
    row.className = "order-item";
    row.draggable = true;
    row.dataset.index = String(index);
    row.classList.toggle("is-pinned", index === pinnedTileIndex);
    row.classList.toggle("is-hovered", index === hoveredTileIndex);

    const number = document.createElement("span");
    number.className = "order-index";
    number.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "order-name";
    name.title = item.file.webkitRelativePath || item.file.name;
    name.textContent = item.file.name;

    const upButton = document.createElement("button");
    upButton.className = "order-button";
    upButton.type = "button";
    upButton.dataset.action = "up";
    upButton.dataset.index = String(index);
    upButton.textContent = "Up";
    upButton.disabled = index === 0;

    const downButton = document.createElement("button");
    downButton.className = "order-button";
    downButton.type = "button";
    downButton.dataset.action = "down";
    downButton.dataset.index = String(index);
    downButton.textContent = "Dn";
    downButton.disabled = index === atlasState.images.length - 1;

    const removeButton = document.createElement("button");
    removeButton.className = "order-button remove-button";
    removeButton.type = "button";
    removeButton.dataset.action = "remove";
    removeButton.dataset.index = String(index);
    removeButton.textContent = "Remove";

    row.append(number, name, upButton, downButton, removeButton);
    orderList.append(row);
  }
}

function renderRemovedList() {
  if (!removedList || !removedCount) {
    return;
  }

  removedList.innerHTML = "";
  removedCount.textContent = `${removedSprites.length} sprite${removedSprites.length === 1 ? "" : "s"}`;

  for (const [index, item] of removedSprites.entries()) {
    const row = document.createElement("li");
    row.className = "order-item removed-item";
    row.dataset.index = String(index);

    const number = document.createElement("span");
    number.className = "order-index";
    number.textContent = String(index + 1);

    const name = document.createElement("span");
    name.className = "order-name";
    name.title = item.file.webkitRelativePath || item.file.name;
    name.textContent = item.file.name;

    const restoreButton = document.createElement("button");
    restoreButton.className = "order-button restore-button";
    restoreButton.type = "button";
    restoreButton.dataset.action = "restore";
    restoreButton.dataset.index = String(index);
    restoreButton.textContent = "Restore";

    row.append(number, name, restoreButton);
    removedList.append(row);
  }
}

function trimImage(item) {
  const sourceCanvas = makeCanvas(item.width, item.height);
  const sourceContext = sourceCanvas.getContext("2d");
  sourceContext.imageSmoothingEnabled = false;
  sourceContext.drawImage(item.image, 0, 0);

  const bounds = getTrimBounds(sourceCanvas);
  if (!bounds.trimmed) {
    return {
      ...item,
      source: item.image,
      width: item.width,
      height: item.height,
      trimmed: false,
    };
  }

  const trimmedCanvas = makeCanvas(bounds.width, bounds.height);
  trimmedCanvas.getContext("2d").drawImage(
    sourceCanvas,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    0,
    0,
    bounds.width,
    bounds.height,
  );

  return {
    ...item,
    source: trimmedCanvas,
    width: bounds.width,
    height: bounds.height,
    trimmed: true,
  };
}

function prepareImages(images, shouldTrim) {
  if (!shouldTrim) {
    return images.map((item) => ({ ...item, source: item.image, trimmed: false }));
  }

  return images.map(trimImage);
}

function getLargestSize(images) {
  return {
    width: Math.max(...images.map((item) => item.width)),
    height: Math.max(...images.map((item) => item.height)),
  };
}

function getMajoritySize(images) {
  const sizes = new Map();
  for (const item of images) {
    const key = `${item.width}x${item.height}`;
    sizes.set(key, (sizes.get(key) ?? 0) + 1);
  }

  const [winner] = Array.from(sizes.entries()).sort((a, b) => {
    const [aWidth, aHeight] = a[0].split("x").map(Number);
    const [bWidth, bHeight] = b[0].split("x").map(Number);
    return b[1] - a[1] || aWidth * aHeight - bWidth * bHeight || aWidth - bWidth;
  });
  const [width, height] = winner[0].split("x").map(Number);
  return { width, height };
}

function getBaseCellSize(images) {
  if (cellModeInput.value === "largest") {
    return getLargestSize(images);
  }

  if (cellModeInput.value === "manual") {
    return {
      width: normalizeNumberInput(manualWidthInput, 128, 1),
      height: normalizeNumberInput(manualHeightInput, 128, 1),
    };
  }

  return getMajoritySize(images);
}

function getOversizeImages(images, cell) {
  return images.filter((item) => item.width > cell.width || item.height > cell.height);
}

function applyOutlierPolicy(images, baseCell) {
  const oversizeImages = getOversizeImages(images, baseCell);
  const policy = outlierModeInput.value;

  if (oversizeImages.length === 0 || cellModeInput.value === "largest") {
    return {
      images,
      cell: baseCell,
      outlierText: oversizeImages.length === 0 ? "0" : `${oversizeImages.length} kept`,
    };
  }

  if (policy === "keep") {
    return {
      images,
      cell: getLargestSize(images),
      outlierText: `${oversizeImages.length} kept`,
    };
  }

  if (policy === "skip") {
    return {
      images: images.filter((item) => item.width <= baseCell.width && item.height <= baseCell.height),
      cell: baseCell,
      outlierText: `${oversizeImages.length} skipped`,
    };
  }

  return {
    images,
    cell: baseCell,
    outlierText: `${oversizeImages.length} cropped`,
  };
}

function drawAtlas(images, columns, padding) {
  const preparedImages = prepareImages(images, trimInput.checked);
  const baseCell = getBaseCellSize(preparedImages);
  const policyResult = applyOutlierPolicy(preparedImages, baseCell);
  const atlasImages = policyResult.images;

  if (atlasImages.length === 0) {
    throw new Error("Every image was skipped because it was larger than the selected cell size.");
  }

  const cellWidth = policyResult.cell.width + padding * 2;
  const cellHeight = policyResult.cell.height + padding * 2;
  const rows = Math.ceil(atlasImages.length / columns);

  canvas.width = columns * cellWidth;
  canvas.height = rows * cellHeight;
  highlightCanvas.width = canvas.width;
  highlightCanvas.height = canvas.height;
  updateZoom();
  clearHighlight();

  atlasState = {
    images: atlasImages,
    cell: policyResult.cell,
    columns,
    padding,
    cellWidth,
    cellHeight,
  };
  removedSprites = [];
  hoveredTileIndex = -1;
  swapStartIndex = -1;
  pinnedTileIndex = -1;
  dragStartIndex = -1;
  didDragTile = false;
  drawAtlasContent();
  renderHighlights();
  renderOrderList();
  renderRemovedList();
  cellSize.textContent = `${cellWidth} x ${cellHeight}px`;
  atlasSize.textContent = `${canvas.width} x ${canvas.height}px`;
  outlierCount.textContent = policyResult.outlierText;
  emptyState.hidden = true;
  atlasFrame.hidden = false;
  setDownloadEnabled(true);
  clearInspector();
}

async function buildAtlas() {
  if (selectedFiles.length === 0) {
    return;
  }

  const columns = normalizeNumberInput(columnsInput, 1, 1);
  const padding = normalizeNumberInput(paddingInput, 0, 0);

  buildButton.disabled = true;
  buildButton.textContent = "Building...";
  emptyState.hidden = false;
  emptyState.querySelector("h2").textContent = "Building atlas";
  emptyState.querySelector("p").textContent = "Loading source images and drawing the grid.";
  emptyState.querySelector("p").classList.remove("error");
  atlasFrame.hidden = true;
  setDownloadEnabled(false);

  try {
    const images = await loadImages(selectedFiles);
    if (images.length === 0) {
      throw new Error("No loadable images were found in that folder.");
    }
    drawAtlas(images, columns, padding);
  } catch (error) {
    resetAtlas();
    emptyState.querySelector("h2").textContent = "Atlas could not be created";
    emptyState.querySelector("p").textContent = error.message;
    emptyState.querySelector("p").classList.add("error");
  } finally {
    buildButton.disabled = selectedFiles.length === 0;
    buildButton.textContent = "Build Atlas";
  }
}

folderInput.addEventListener("change", () => {
  selectedFiles = Array.from(folderInput.files)
    .filter(isSupportedImage)
    .sort((a, b) => naturalPathSorter.compare(a.webkitRelativePath, b.webkitRelativePath));

  resetAtlas();
  updateFileCount();

  if (selectedFiles.length > 0) {
    emptyState.querySelector("h2").textContent = "Ready to build";
    emptyState.querySelector("p").textContent =
      "Adjust the columns or padding, then build the atlas preview.";
    emptyState.querySelector("p").classList.remove("error");
  }
});

function updateManualSizeVisibility() {
  const showManual = cellModeInput.value === "manual";
  for (const control of manualSizeControls) {
    control.hidden = !showManual;
  }
}

function rebuildIfPreviewing() {
  if (!atlasFrame.hidden) {
    buildAtlas();
  }
}

function setInspectorBackground() {
  inspectorStage.style.backgroundColor = inspectorBgInput.value;
}

function clearInspector() {
  setInspectorBackground();
  inspectorCtx.imageSmoothingEnabled = false;
  inspectorCtx.fillStyle = inspectorBgInput.value;
  inspectorCtx.fillRect(0, 0, inspectorCanvas.width, inspectorCanvas.height);
  inspectorMode.textContent = "Live";
  inspectorName.textContent = "No sprite selected";
  inspectorTile.textContent = "-";
  inspectorSize.textContent = "-";
}

function clearHighlight() {
  highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
}

function drawGridOverlay() {
  if (!atlasState || !gridInput.checked) {
    return;
  }

  highlightCtx.save();
  highlightCtx.strokeStyle = gridColorInput.value;
  highlightCtx.globalAlpha = 0.85;
  highlightCtx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += atlasState.cellWidth) {
    const pixel = Math.floor(x) + 0.5;
    highlightCtx.beginPath();
    highlightCtx.moveTo(pixel, 0);
    highlightCtx.lineTo(pixel, canvas.height);
    highlightCtx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += atlasState.cellHeight) {
    const pixel = Math.floor(y) + 0.5;
    highlightCtx.beginPath();
    highlightCtx.moveTo(0, pixel);
    highlightCtx.lineTo(canvas.width, pixel);
    highlightCtx.stroke();
  }

  highlightCtx.restore();
}

function drawTileOutline(index, color, shadowColor, insetOffset = 0) {
  if (!atlasState || index < 0 || index >= atlasState.images.length) {
    return;
  }

  const column = index % atlasState.columns;
  const row = Math.floor(index / atlasState.columns);
  const x = column * atlasState.cellWidth;
  const y = row * atlasState.cellHeight;

  highlightCtx.save();
  highlightCtx.strokeStyle = color;
  highlightCtx.lineWidth = Math.max(2, Math.ceil(Math.min(atlasState.cellWidth, atlasState.cellHeight) * 0.035));
  highlightCtx.shadowColor = shadowColor;
  highlightCtx.shadowBlur = 3;
  const inset = highlightCtx.lineWidth / 2 + insetOffset;
  highlightCtx.strokeRect(
    x + inset,
    y + inset,
    atlasState.cellWidth - highlightCtx.lineWidth - insetOffset * 2,
    atlasState.cellHeight - highlightCtx.lineWidth - insetOffset * 2,
  );
  highlightCtx.restore();
}

function renderHighlights() {
  clearHighlight();
  drawGridOverlay();
  drawTileOutline(hoveredTileIndex, "#ffd400", "rgba(29, 36, 51, 0.45)");
  drawTileOutline(pinnedTileIndex, "#2ecb70", "rgba(29, 36, 51, 0.45)", 8);
  drawTileOutline(swapStartIndex, "#00a3ff", "rgba(29, 36, 51, 0.45)", 4);
  drawTileOutline(dragStartIndex, "#d85cff", "rgba(29, 36, 51, 0.45)", 12);
  renderOrderList();
}

function swapTiles(firstIndex, secondIndex) {
  if (!atlasState || firstIndex === secondIndex) {
    return;
  }

  [atlasState.images[firstIndex], atlasState.images[secondIndex]] = [
    atlasState.images[secondIndex],
    atlasState.images[firstIndex],
  ];
  drawAtlasContent();
  renderOrderList();
}

function swapTilesAndPreserveState(firstIndex, secondIndex) {
  if (!atlasState || firstIndex === secondIndex) {
    return;
  }

  const firstItem = atlasState.images[firstIndex];
  const secondItem = atlasState.images[secondIndex];
  swapTiles(firstIndex, secondIndex);

  if (pinnedTileIndex === firstIndex) {
    pinnedTileIndex = secondIndex;
  } else if (pinnedTileIndex === secondIndex) {
    pinnedTileIndex = firstIndex;
  }

  if (swapStartIndex === firstIndex) {
    swapStartIndex = secondIndex;
  } else if (swapStartIndex === secondIndex) {
    swapStartIndex = firstIndex;
  }

  hoveredTileIndex = atlasState.images.indexOf(firstItem) === secondIndex ? secondIndex : atlasState.images.indexOf(secondItem);
}

function drawInspectorTile(index, mode = "Live") {
  if (!atlasState || index < 0 || index >= atlasState.images.length) {
    if (pinnedTileIndex !== -1) {
      drawInspectorTile(pinnedTileIndex, "Pinned");
    } else {
      clearInspector();
    }
    return;
  }

  const item = atlasState.images[index];
  const tileCanvas = makeCanvas(atlasState.cell.width, atlasState.cell.height);
  const tileContext = tileCanvas.getContext("2d");
  tileContext.imageSmoothingEnabled = false;
  drawSpriteInCell(tileContext, item, 0, 0, atlasState.cell, 0);

  const margin = 20;
  const maxWidth = inspectorCanvas.width - margin * 2;
  const maxHeight = inspectorCanvas.height - margin * 2;
  const rawScale = Math.min(maxWidth / tileCanvas.width, maxHeight / tileCanvas.height);
  const scale = rawScale >= 1 ? Math.max(1, Math.floor(rawScale)) : rawScale;
  const drawWidth = Math.max(1, Math.round(tileCanvas.width * scale));
  const drawHeight = Math.max(1, Math.round(tileCanvas.height * scale));
  const x = Math.floor((inspectorCanvas.width - drawWidth) / 2);
  const y = Math.floor((inspectorCanvas.height - drawHeight) / 2);

  setInspectorBackground();
  inspectorCtx.imageSmoothingEnabled = false;
  inspectorCtx.fillStyle = inspectorBgInput.value;
  inspectorCtx.fillRect(0, 0, inspectorCanvas.width, inspectorCanvas.height);
  inspectorCtx.drawImage(tileCanvas, x, y, drawWidth, drawHeight);

  inspectorMode.textContent = mode;
  inspectorName.textContent = item.file.name;
  inspectorTile.textContent = String(index + 1);
  inspectorSize.textContent = `${item.width} x ${item.height}px`;
}

function getTileIndexFromMouse(event) {
  if (!atlasState) {
    return -1;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const column = Math.floor(x / atlasState.cellWidth);
  const row = Math.floor(y / atlasState.cellHeight);

  if (column < 0 || row < 0 || column >= atlasState.columns) {
    return -1;
  }

  const index = row * atlasState.columns + column;
  return index < atlasState.images.length ? index : -1;
}

columnsInput.addEventListener("input", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});

paddingInput.addEventListener("input", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});

cellModeInput.addEventListener("change", () => {
  handleSettingsChange();
  updateManualSizeVisibility();
  rebuildIfPreviewing();
});

manualWidthInput.addEventListener("input", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});
manualHeightInput.addEventListener("input", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});
outlierModeInput.addEventListener("change", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});
trimInput.addEventListener("change", () => {
  handleSettingsChange();
  rebuildIfPreviewing();
});
zoomInput.addEventListener("input", () => {
  handleSettingsChange();
  updateZoom();
  renderHighlights();
});
zoomOutButton?.addEventListener("click", () => {
  setZoomSliderValue(Number.parseFloat(zoomInput.value) - 0.25);
});
zoomInButton?.addEventListener("click", () => {
  setZoomSliderValue(Number.parseFloat(zoomInput.value) + 0.25);
});
zoomResetButton?.addEventListener("click", () => {
  setZoomSliderValue(0);
});
gridInput.addEventListener("change", () => {
  handleSettingsChange();
  renderHighlights();
});
gridColorInput.addEventListener("input", () => {
  handleSettingsChange();
  renderHighlights();
});
previewBgModeInput.addEventListener("change", () => {
  handleSettingsChange();
  updatePreviewBackground();
});
previewBgColorInput.addEventListener("input", () => {
  handleSettingsChange();
  updatePreviewBackground();
});
exportBgModeInput.addEventListener("change", () => {
  handleSettingsChange();
  updateDownloadLink();
});
exportBgColorInput.addEventListener("input", () => {
  handleSettingsChange();
  updateDownloadLink();
});
inspectorBgInput.addEventListener("input", () => {
  handleSettingsChange();
  if (hoveredTileIndex === -1) {
    if (pinnedTileIndex !== -1) {
      drawInspectorTile(pinnedTileIndex, "Pinned");
    } else {
      clearInspector();
    }
    return;
  }

  drawInspectorTile(hoveredTileIndex);
});
canvas.addEventListener("mousemove", (event) => {
  const index = getTileIndexFromMouse(event);
  if (index === hoveredTileIndex) {
    return;
  }

  hoveredTileIndex = index;
  if (dragStartIndex !== -1 && index !== dragStartIndex) {
    didDragTile = true;
  }
  renderHighlights();
  drawInspectorTile(index);
});
canvas.addEventListener("click", (event) => {
  if (didDragTile) {
    didDragTile = false;
    return;
  }

  if (!event.ctrlKey) {
    const index = getTileIndexFromMouse(event);
    swapStartIndex = -1;
    if (index !== -1) {
      pinnedTileIndex = pinnedTileIndex === index ? -1 : index;
      drawInspectorTile(index, pinnedTileIndex === index ? "Pinned" : "Live");
    }
    renderHighlights();
    return;
  }

  const index = getTileIndexFromMouse(event);
  if (index === -1) {
    return;
  }

  if (swapStartIndex === -1) {
    swapStartIndex = index;
    renderHighlights();
    return;
  }

  const firstIndex = swapStartIndex;
  swapTilesAndPreserveState(firstIndex, index);
  swapStartIndex = -1;
  hoveredTileIndex = index;
  renderHighlights();
  drawInspectorTile(index);
});
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.ctrlKey) {
    return;
  }

  const index = getTileIndexFromMouse(event);
  if (index === -1) {
    return;
  }

  dragStartIndex = index;
  didDragTile = false;
  canvas.setPointerCapture(event.pointerId);
  renderHighlights();
});
canvas.addEventListener("pointerup", (event) => {
  if (dragStartIndex === -1) {
    return;
  }

  const fromIndex = dragStartIndex;
  const toIndex = getTileIndexFromMouse(event);
  dragStartIndex = -1;

  if (toIndex !== -1 && toIndex !== fromIndex) {
    didDragTile = true;
    swapTilesAndPreserveState(fromIndex, toIndex);
    hoveredTileIndex = toIndex;
    renderHighlights();
    drawInspectorTile(toIndex);
  } else {
    renderHighlights();
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});
canvas.addEventListener("pointercancel", (event) => {
  dragStartIndex = -1;
  didDragTile = false;
  renderHighlights();
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
});
canvas.addEventListener("mouseleave", () => {
  hoveredTileIndex = -1;
  renderHighlights();
  if (pinnedTileIndex !== -1) {
    drawInspectorTile(pinnedTileIndex, "Pinned");
  } else {
    clearInspector();
  }
});
buildButton.addEventListener("click", buildAtlas);
themeToggle?.addEventListener("click", toggleTheme);
orderList?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) {
    const index = Number.parseInt(button.dataset.index, 10);
    if (button.dataset.action === "up") {
      moveAtlasImage(index, index - 1);
    } else if (button.dataset.action === "down") {
      moveAtlasImage(index, index + 1);
    } else if (button.dataset.action === "remove") {
      removeAtlasImage(index);
    }
    return;
  }

  const row = event.target.closest(".order-item");
  if (!row) {
    return;
  }

  const index = Number.parseInt(row.dataset.index, 10);
  pinnedTileIndex = pinnedTileIndex === index ? -1 : index;
  hoveredTileIndex = -1;
  renderHighlights();
  if (pinnedTileIndex !== -1) {
    drawInspectorTile(pinnedTileIndex, "Pinned");
  } else {
    clearInspector();
  }
});
orderList?.addEventListener("dragstart", (event) => {
  const row = event.target.closest(".order-item");
  if (!row) {
    return;
  }

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", row.dataset.index);
});
orderList?.addEventListener("dragover", (event) => {
  const row = event.target.closest(".order-item");
  if (!row) {
    return;
  }

  event.preventDefault();
  row.classList.add("drag-over");
});
orderList?.addEventListener("dragleave", (event) => {
  const row = event.target.closest(".order-item");
  if (row) {
    row.classList.remove("drag-over");
  }
});
orderList?.addEventListener("drop", (event) => {
  const row = event.target.closest(".order-item");
  if (!row) {
    return;
  }

  event.preventDefault();
  row.classList.remove("drag-over");
  const fromIndex = Number.parseInt(event.dataTransfer.getData("text/plain"), 10);
  const toIndex = Number.parseInt(row.dataset.index, 10);
  moveAtlasImage(fromIndex, toIndex);
});
removedList?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.dataset.action !== "restore") {
    return;
  }

  restoreRemovedImage(Number.parseInt(button.dataset.index, 10));
});

loadSettings();
updateManualSizeVisibility();
updateZoom();
updatePreviewBackground();
updateFileCount();
resetAtlas();
