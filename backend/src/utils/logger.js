const MAX_LOGS = 500;
const serverLogs = [];

function addLog(type, message, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    details,
  };

  serverLogs.unshift(logEntry);
  if (serverLogs.length > MAX_LOGS) {
    serverLogs.pop();
  }

  console.log(`[${type.toUpperCase()}] ${message}`, details);
}

function getLogs({ type, limit = 100 } = {}) {
  const filtered = type
    ? serverLogs.filter((log) => log.type === type)
    : serverLogs;
  return {
    logs: filtered.slice(0, limit),
    total: filtered.length,
  };
}

module.exports = {
  addLog,
  getLogs,
};
