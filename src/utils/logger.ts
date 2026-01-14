// Lightweight logger wrapper used across the app.
// In development this forwards to console; in production it's a noop.
const enabled = !import.meta.env?.PROD;

const noop = () => {};

const logger = {
  log: (...args: any[]) => {
    if (enabled) console.log(...args);
  },
  debug: (...args: any[]) => {
    if (enabled) {
      if (console.debug) {
        console.debug(...args);
      } else {
        console.log(...args);
      }
    }
  },
  info: (...args: any[]) => {
    if (enabled) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (enabled) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (enabled) console.error(...args);
  },
};

export default logger;
