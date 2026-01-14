// Global logger shim: disable noisy console output in non-dev environments.
// Import this once (e.g. in your main layout) to apply globally.
const disableInProduction = Boolean(import.meta.env?.PROD);
const forceDisableAll = true; // set to true to always disable logs

if (typeof window !== 'undefined' && (disableInProduction || forceDisableAll)) {
  const methods: Array<keyof Console> = ['log', 'debug', 'info', 'warn', 'error'];
  for (const m of methods) {
    try {
      // @ts-expect-error - assigning to console methods
      console[m] = () => {};
    } catch (_) {
      // ignore
    }
  }
}

export {};
