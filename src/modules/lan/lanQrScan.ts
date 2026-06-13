import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
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

function isGoogleModuleMissingError(err: unknown): boolean {
  let msg = '';
  if (err instanceof Error) msg = err.message;
  else if (typeof err === 'string') msg = err;
  const lower = msg.toLowerCase();
  return (
    lower.includes('google barcode scanner module') ||
    lower.includes('installgooglebarcodescannermodule')
  );
}

const MODULE_INSTALL_TIMEOUT_MS = 120_000;

async function loadBarcodeScanner() {
  return import('@capacitor-mlkit/barcode-scanning');
}

type LoadedBarcodeScanner = Awaited<ReturnType<typeof loadBarcodeScanner>>;

/**
 * Wait until the Google Play barcode scanner module is ready (Android `scan()` only).
 * installGoogleBarcodeScannerModule() only starts the download — progress events mark completion.
 */
async function ensureGoogleBarcodeScannerModule(
  BarcodeScanner: LoadedBarcodeScanner['BarcodeScanner'],
  installState: LoadedBarcodeScanner['GoogleBarcodeScannerModuleInstallState'],
): Promise<boolean> {
  try {
    const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (mod.available) return true;
  } catch (e) {
    logger.warn('[lanQrScan] Google barcode module availability check failed', e);
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let progressListener: PluginListenerHandle | null = null;

    const finish = (available: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      void (async () => {
        try {
          if (progressListener) await progressListener.remove();
        } catch {
          /* ignore */
        }
        resolve(available);
      })();
    };

    const timeoutId = setTimeout(() => {
      logger.warn('[lanQrScan] Google barcode module install timed out');
      finish(false);
    }, MODULE_INSTALL_TIMEOUT_MS);

    void (async () => {
      try {
        progressListener = await BarcodeScanner.addListener(
          'googleBarcodeScannerModuleInstallProgress',
          (event) => {
            if (event.state === installState.COMPLETED) {
              finish(true);
            } else if (
              event.state === installState.FAILED ||
              event.state === installState.CANCELED
            ) {
              logger.warn('[lanQrScan] Google barcode module install failed', event);
              finish(false);
            }
          },
        );

        await BarcodeScanner.installGoogleBarcodeScannerModule();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('already installed')) {
          try {
            const mod = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
            finish(mod.available);
          } catch {
            finish(false);
          }
          return;
        }
        logger.warn('[lanQrScan] Google barcode module install failed', e);
        finish(false);
      }
    })();
  });
}

function createScanOverlay(onCancel: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'lan-qr-scan-overlay';
  overlay.innerHTML = `
    <div class="lan-qr-scan-overlay__panel">
      <p class="lan-qr-scan-overlay__title">Scan PC QR code</p>
      <p class="lan-qr-scan-overlay__hint">Point the camera at the QR on your PC screen.</p>
      <button type="button" class="lan-qr-scan-overlay__cancel">Cancel</button>
    </div>
  `;
  overlay.querySelector('.lan-qr-scan-overlay__cancel')?.addEventListener('click', onCancel);
  return overlay;
}

/** Embedded CameraX scan — works without the Google Play barcode scanner module. */
async function scanWithEmbeddedCamera(
  BarcodeScanner: LoadedBarcodeScanner['BarcodeScanner'],
  qrFormat: LoadedBarcodeScanner['BarcodeFormat'],
): Promise<string | null> {
  document.body.classList.add('barcode-scanner-active');

  let barcodeListener: PluginListenerHandle | null = null;
  let overlay: HTMLElement | null = null;
  let cancelRequested = false;

  const cleanup = async (): Promise<void> => {
    document.body.classList.remove('barcode-scanner-active');
    overlay?.remove();
    overlay = null;
    try {
      if (barcodeListener) await barcodeListener.remove();
    } catch {
      /* ignore */
    }
    try {
      await BarcodeScanner.stopScan();
    } catch {
      /* ignore */
    }
  };

  return new Promise<string | null>((resolve, reject) => {
    const finish = (value: string | null) => {
      void cleanup().then(() => resolve(value));
    };
    const fail = (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      void cleanup().then(() => reject(error));
    };

    const onCancel = () => {
      if (cancelRequested) return;
      cancelRequested = true;
      finish(null);
    };

    overlay = createScanOverlay(onCancel);
    document.body.appendChild(overlay);

    void (async () => {
      try {
        barcodeListener = await BarcodeScanner.addListener('barcodesScanned', (result) => {
          if (cancelRequested) return;
          const code = result.barcodes?.[0];
          finish(code?.rawValue || code?.displayValue || null);
        });

        await BarcodeScanner.startScan({ formats: [qrFormat.QrCode] });
      } catch (e) {
        if (isScanDismissed(e)) {
          finish(null);
        } else {
          fail(e);
        }
      }
    })();
  });
}

async function scanWithPlayServicesUi(
  BarcodeScanner: LoadedBarcodeScanner['BarcodeScanner'],
  qrFormat: LoadedBarcodeScanner['BarcodeFormat'],
): Promise<string | null> {
  const result = await BarcodeScanner.scan({
    formats: [qrFormat.QrCode],
  });
  const code = result.barcodes?.[0];
  if (!code) return null;
  return code.rawValue || code.displayValue || null;
}

/**
 * Open the native QR scanner (ML Kit on Android / iOS). Returns raw QR text or null if cancelled.
 */
export async function scanLanQrWithCamera(): Promise<string | null> {
  if (!isCapacitorNative()) {
    return null;
  }

  const { BarcodeScanner, BarcodeFormat, GoogleBarcodeScannerModuleInstallState } =
    await loadBarcodeScanner();

  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) {
    throw new Error('Barcode scanning is not supported on this device.');
  }

  const perms = await BarcodeScanner.checkPermissions();
  if (perms.camera !== 'granted') {
    const req = await BarcodeScanner.requestPermissions();
    if (req.camera !== 'granted') {
      throw new Error('Camera permission is required to scan the pairing QR code.');
    }
  }

  const useEmbeddedCamera = async (): Promise<string | null> => {
    try {
      return await scanWithEmbeddedCamera(BarcodeScanner, BarcodeFormat);
    } catch (e) {
      if (isScanDismissed(e)) return null;
      throw e;
    }
  };

  if (Capacitor.getPlatform() === 'android') {
    const moduleReady = await ensureGoogleBarcodeScannerModule(
      BarcodeScanner,
      GoogleBarcodeScannerModuleInstallState,
    );

    if (moduleReady) {
      try {
        return await scanWithPlayServicesUi(BarcodeScanner, BarcodeFormat);
      } catch (e) {
        if (isScanDismissed(e)) return null;
        if (isGoogleModuleMissingError(e)) {
          logger.warn('[lanQrScan] Play Services scan unavailable, using embedded camera', e);
          return useEmbeddedCamera();
        }
        throw e;
      }
    }

    logger.info('[lanQrScan] Google barcode module unavailable — using embedded camera');
    return useEmbeddedCamera();
  }

  try {
    return await scanWithPlayServicesUi(BarcodeScanner, BarcodeFormat);
  } catch (e) {
    if (isScanDismissed(e)) return null;
    throw e;
  }
}

/** Whether live camera QR scan may be available (native Capacitor only). */
export function canUseLanQrCamera(): boolean {
  return isCapacitorNative();
}
