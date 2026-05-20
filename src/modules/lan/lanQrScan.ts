import { Capacitor } from '@capacitor/core';
import logger from 'src/utils/logger';

/** True when running inside a native Capacitor shell (Android / iOS). */
export function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isScanDismissed(err: unknown): boolean {
  let msg = '';
  if (err instanceof Error) msg = err.message;
  else if (typeof err === 'string') msg = err;
  const lower = msg.toLowerCase();
  return (
    lower.includes('cancel') ||
    lower.includes('dismiss') ||
    lower.includes('user denied') ||
    lower.includes('aborted')
  );
}

/**
 * Open the native QR scanner (ML Kit on Android / iOS). Returns raw QR text or null if cancelled.
 */
export async function scanLanQrWithCamera(): Promise<string | null> {
  if (!isCapacitorNative()) {
    return null;
  }
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) {
    throw new Error('Barcode scanning is not supported on this device.');
  }

  if (Capacitor.getPlatform() === 'android') {
    try {
      const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!mod.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }
    } catch (e) {
      logger.warn('[lanQrScan] Google barcode module check failed', e);
    }
  }

  const perms = await BarcodeScanner.checkPermissions();
  if (perms.camera !== 'granted') {
    const req = await BarcodeScanner.requestPermissions();
    if (req.camera !== 'granted') {
      throw new Error('Camera permission is required to scan the pairing QR code.');
    }
  }

  try {
    const result = await BarcodeScanner.scan({
      formats: [BarcodeFormat.QrCode],
    });
    const code = result.barcodes?.[0];
    if (!code) return null;
    return code.rawValue || code.displayValue || null;
  } catch (e) {
    if (isScanDismissed(e)) return null;
    throw e;
  }
}

/** Whether live camera QR scan may be available (native Capacitor only). */
export function canUseLanQrCamera(): boolean {
  return isCapacitorNative();
}
