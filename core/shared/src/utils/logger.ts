// core/shared/src/utils/logger.ts

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Lấy level từ biến môi trường, mặc định là 'info'
const CURRENT_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    
    // Màu sắc
    const colors = {
      debug: '\x1b[32m', // Green
      info: '\x1b[36m',  // Cyan
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    const color = colors[level];

    // Format: [TIME] [LEVEL] [CONTEXT] Message
    return `${color}[${timestamp}] [${level.toUpperCase()}] [${this.context}]${reset} ${message}${metaString}`;
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, error?: any) {
    if (this.shouldLog('error')) {
      // Với error, ta in riêng error object ra để trình duyệt/server hiển thị stack trace đẹp hơn
      console.error(this.formatMessage('error', message));
      if (error) console.error(error);
    }
  }
}