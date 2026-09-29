/**
 * Camera Viewport Geometry Utilities
 *
 * Accurately maps normalized camera bounding boxes (0.0–1.0) into the
 * actual displayed image rectangle after accounting for contentFit="contain"
 * letterboxing on Android and iOS.
 */

export interface ContainedImageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the exact pixel rectangle where a contain-fit image sits
 * inside an outer container.
 */
export function getContainedImageRect(
  containerWidth: number,
  containerHeight: number,
  frameWidth: number,
  frameHeight: number
): ContainedImageRect {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const containerRatio = containerWidth / containerHeight;
  const imageRatio = frameWidth / frameHeight;

  if (containerRatio > imageRatio) {
    // Container is wider than the image: pillarboxing (bars on left/right)
    const height = containerHeight;
    const width = height * imageRatio;
    const x = (containerWidth - width) / 2;
    const y = 0;
    return { x, y, width, height };
  } else {
    // Container is taller than the image: letterboxing (bars on top/bottom)
    const width = containerWidth;
    const height = width / imageRatio;
    const x = 0;
    const y = (containerHeight - height) / 2;
    return { x, y, width, height };
  }
}

/**
 * Maps a normalized bbox into screen pixel coordinates based on the contained image rectangle.
 */
export function mapBBoxToScreen(
  bbox: { x: number; y: number; width: number; height: number },
  imageRect: ContainedImageRect
) {
  return {
    pixelX: imageRect.x + bbox.x * imageRect.width,
    pixelY: imageRect.y + bbox.y * imageRect.height,
    pixelW: bbox.width * imageRect.width,
    pixelH: bbox.height * imageRect.height,
  };
}
