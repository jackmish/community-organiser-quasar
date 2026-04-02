import { presentation } from 'src/modules/presentation/presentationRepository';

/**
 * Returns true when the app is running in test or presentation mode.
 * Use this to gate storage reads/writes that should be skipped during demos.
 */
export function isPresentationModeActive(): boolean {
  try {
    const m = presentation?.mode?.value;
    return m === 'test' || m === 'presentation';
  } catch {
    return false;
  }
}
