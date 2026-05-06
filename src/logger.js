function formatTimestamp() {
  return new Date().toISOString();
}

function write(method, args) {
  method(`[${formatTimestamp()}]`, ...args);
}

export const logger = {
  info: (...args) => write(console.info, args),
  warn: (...args) => write(console.warn, args),
  error: (...args) => write(console.error, args),
  log: (...args) => write(console.log, args),
};
