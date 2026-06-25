export type FaceAnnotationRect = {
  id: string;
  /** 0–1 relative to natural image width */
  x: number;
  /** 0–1 relative to natural image height */
  y: number;
  width: number;
  height: number;
  label: string;
};

export function createFaceAnnotationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `face-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
