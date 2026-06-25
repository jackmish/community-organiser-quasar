import type { FaceAnnotationRect } from './mediaFaceAnnotationModel';

export type ImageDisplayMetrics = {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
  naturalWidth: number;
  naturalHeight: number;
};

export type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function computeImageDisplayMetrics(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageDisplayMetrics {
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
    return {
      offsetX: 0,
      offsetY: 0,
      displayWidth: containerWidth,
      displayHeight: containerHeight,
      naturalWidth,
      naturalHeight,
    };
  }

  const scale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;

  return {
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
    naturalWidth,
    naturalHeight,
  };
}

export function normalizedRectToScreen(
  rect: FaceAnnotationRect,
  metrics: ImageDisplayMetrics,
): ScreenRect {
  return {
    x: metrics.offsetX + rect.x * metrics.displayWidth,
    y: metrics.offsetY + rect.y * metrics.displayHeight,
    width: rect.width * metrics.displayWidth,
    height: rect.height * metrics.displayHeight,
  };
}

export function screenRectToNormalized(
  rect: ScreenRect,
  metrics: ImageDisplayMetrics,
): { x: number; y: number; width: number; height: number } {
  const relX = (rect.x - metrics.offsetX) / metrics.displayWidth;
  const relY = (rect.y - metrics.offsetY) / metrics.displayHeight;
  const relW = rect.width / metrics.displayWidth;
  const relH = rect.height / metrics.displayHeight;

  return {
    x: clamp01(relX),
    y: clamp01(relY),
    width: clamp01(Math.min(relW, 1 - relX)),
    height: clamp01(Math.min(relH, 1 - relY)),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function stagePointFromClient(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
): { x: number; y: number } {
  return {
    x: clientX - containerRect.left,
    y: clientY - containerRect.top,
  };
}

export function isPointInImageDisplay(
  stageX: number,
  stageY: number,
  metrics: ImageDisplayMetrics,
): boolean {
  return (
    stageX >= metrics.offsetX &&
    stageY >= metrics.offsetY &&
    stageX <= metrics.offsetX + metrics.displayWidth &&
    stageY <= metrics.offsetY + metrics.displayHeight
  );
}

export function clampStagePointToImage(
  stageX: number,
  stageY: number,
  metrics: ImageDisplayMetrics,
): { x: number; y: number } {
  return {
    x: Math.min(metrics.offsetX + metrics.displayWidth, Math.max(metrics.offsetX, stageX)),
    y: Math.min(metrics.offsetY + metrics.displayHeight, Math.max(metrics.offsetY, stageY)),
  };
}

export function screenRectFromStageDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  metrics: ImageDisplayMetrics,
): ScreenRect {
  const clamped = clampStagePointToImage(end.x, end.y, metrics);
  const x = Math.min(start.x, clamped.x);
  const y = Math.min(start.y, clamped.y);
  return {
    x,
    y,
    width: Math.abs(clamped.x - start.x),
    height: Math.abs(clamped.y - start.y),
  };
}

export type StagePoint = { x: number; y: number };

function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function clampToStage(
  pos: StagePoint,
  cardWidth: number,
  cardHeight: number,
  stageWidth: number,
  stageHeight: number,
): StagePoint {
  return {
    x: Math.min(stageWidth - cardWidth - 8, Math.max(8, pos.x)),
    y: Math.min(stageHeight - cardHeight - 8, Math.max(8, pos.y)),
  };
}

/** Place the name card beside the selection, preferring letterbox / empty margins. */
export function computeNameCardPosition(
  selection: ScreenRect,
  metrics: ImageDisplayMetrics,
  stageWidth: number,
  stageHeight: number,
  cardWidth = 280,
  cardHeight = 112,
): StagePoint {
  const margin = 12;
  const imageRect: ScreenRect = {
    x: metrics.offsetX,
    y: metrics.offsetY,
    width: metrics.displayWidth,
    height: metrics.displayHeight,
  };
  const imageRight = metrics.offsetX + metrics.displayWidth;
  const imageBottom = metrics.offsetY + metrics.displayHeight;
  const rightLetterbox = stageWidth - imageRight;
  const leftLetterbox = metrics.offsetX;
  const bottomLetterbox = stageHeight - imageBottom;
  const topLetterbox = metrics.offsetY;

  const candidates: Array<{ pos: StagePoint; score: number }> = [];

  function addCandidate(pos: StagePoint, score: number): void {
    candidates.push({ pos, score });
  }

  if (rightLetterbox >= cardWidth + margin) {
    addCandidate({ x: imageRight + margin, y: selection.y }, 100);
  }
  if (leftLetterbox >= cardWidth + margin) {
    addCandidate({ x: metrics.offsetX - cardWidth - margin, y: selection.y }, 100);
  }
  if (bottomLetterbox >= cardHeight + margin) {
    addCandidate({ x: selection.x, y: imageBottom + margin }, 95);
  }
  if (topLetterbox >= cardHeight + margin) {
    addCandidate({ x: selection.x, y: metrics.offsetY - cardHeight - margin }, 95);
  }

  addCandidate({ x: selection.x, y: selection.y + selection.height + margin }, 80);
  addCandidate({ x: selection.x + selection.width + margin, y: selection.y }, 75);
  addCandidate({ x: selection.x, y: selection.y - cardHeight - margin }, 70);
  addCandidate({ x: selection.x - cardWidth - margin, y: selection.y }, 65);

  candidates.sort((a, b) => b.score - a.score);

  const cardAt = (pos: StagePoint): ScreenRect => ({
    x: pos.x,
    y: pos.y,
    width: cardWidth,
    height: cardHeight,
  });

  for (const candidate of candidates) {
    const clamped = clampToStage(candidate.pos, cardWidth, cardHeight, stageWidth, stageHeight);
    const card = cardAt(clamped);
    if (!rectsOverlap(card, selection) && !rectsOverlap(card, imageRect)) {
      return clamped;
    }
  }

  for (const candidate of candidates) {
    const clamped = clampToStage(candidate.pos, cardWidth, cardHeight, stageWidth, stageHeight);
    if (!rectsOverlap(cardAt(clamped), selection)) {
      return clamped;
    }
  }

  return clampToStage(
    { x: selection.x, y: selection.y + selection.height + margin },
    cardWidth,
    cardHeight,
    stageWidth,
    stageHeight,
  );
}