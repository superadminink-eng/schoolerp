type LogLevel = "info" | "warn" | "error" | "debug";

class StructuredLogger {
  private isDev = process.env.NODE_ENV === "development";

  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      message,
      ...(meta && { meta }),
    };

    if (this.isDev) {
      // Pretty printing in development
      const metaStr = meta ? ` | Meta: ${JSON.stringify(meta)}` : "";
      const levelColors = {
        info: "\x1b[32mINFO\x1b[0m",
        warn: "\x1b[33mWARN\x1b[0m",
        error: "\x1b[31mERROR\x1b[0m",
        debug: "\x1b[34mDEBUG\x1b[0m",
      };
      const formattedLevel = levelColors[level] || level.toUpperCase();
      console.log(`[${timestamp}] [${formattedLevel}] ${message}${metaStr}`);
    } else {
      // Standard JSON printing in production (Pino/CloudWatch/GCP format)
      console.log(JSON.stringify(payload));
    }
  }

  info(message: string, meta?: Record<string, any>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log("warn", message, meta);
  }

  error(message: string, error?: unknown, meta?: Record<string, any>) {
    const errorMeta: Record<string, any> = { ...meta };
    if (error instanceof Error) {
      errorMeta.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      errorMeta.error = error;
    }
    this.log("error", message, errorMeta);
  }

  debug(message: string, meta?: Record<string, any>) {
    if (this.isDev) {
      this.log("debug", message, meta);
    }
  }
}

export const logger = new StructuredLogger();
