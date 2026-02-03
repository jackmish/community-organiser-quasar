// Lightweight logger wrapper used across the app.
// In development this forwards to console; in production it's a noop.
// Non-error logging is disabled per project policy; only `error` remains.
const noop = (..._args: any[]) => {};

const logger = {
  log: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: (...args: any[]) => {
    console.error(...args);
  },
};

export default logger;
