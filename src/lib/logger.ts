type LogLevel = "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: Record<string, unknown>
  error?: { message: string; stack?: string }
}

function formatLog(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry)
  }

  const color = { info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" }[entry.level]
  const reset = "\x1b[0m"
  const prefix = `${color}[${entry.level.toUpperCase()}]${reset}`
  return `${prefix} ${entry.message}${entry.data ? " " + JSON.stringify(entry.data) : ""}${entry.error ? " | Error: " + entry.error.message : ""}`
}

export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { timestamp: new Date().toISOString(), level: "info", message, data }
    console.log(formatLog(entry))
  },

  warn(message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { timestamp: new Date().toISOString(), level: "warn", message, data }
    console.warn(formatLog(entry))
  },

  error(message: string, error?: Error, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      data,
      error: error ? { message: error.message, stack: error.stack } : undefined,
    }
    console.error(formatLog(entry))
  },
}
