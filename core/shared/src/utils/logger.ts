export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || 'info';

export class Logger {
  private defaultContext: string;

  constructor(context: string = 'Global') {
    this.defaultContext = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LOG_LEVEL];
  }

  private formatMessage(
    level: LogLevel,
    context: string,
    message: string,
    meta?: unknown
  ): string {
    const timestamp = new Date().toISOString();
    const metaString = meta
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';

    const colors: Record<LogLevel, string> = {
      debug: '\x1b[32m',
      info: '\x1b[36m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
    };

    const reset = '\x1b[0m';
    const color = colors[level];

    return `${color}[${timestamp}] [${level.toUpperCase()}] [${context}]${reset} ${message}${metaString}`;
  }

  info(ctxOrMsg: string, msgOrMeta?: unknown, meta?: unknown) {
    if (!this.shouldLog('info')) return;

    const context =
      typeof msgOrMeta === 'string' ? ctxOrMsg : this.defaultContext;
    const message =
      typeof msgOrMeta === 'string' ? msgOrMeta : ctxOrMsg;
    const data =
      typeof msgOrMeta === 'string' ? meta : msgOrMeta;

    console.log(this.formatMessage('info', context, message, data));
  }

  warn(ctxOrMsg: string, msgOrMeta?: unknown, meta?: unknown) {
    if (!this.shouldLog('warn')) return;

    const context =
      typeof msgOrMeta === 'string' ? ctxOrMsg : this.defaultContext;
    const message =
      typeof msgOrMeta === 'string' ? msgOrMeta : ctxOrMsg;
    const data =
      typeof msgOrMeta === 'string' ? meta : msgOrMeta;

    console.warn(this.formatMessage('warn', context, message, data));
  }

  debug(ctxOrMsg: string, msgOrMeta?: unknown, meta?: unknown) {
    if (!this.shouldLog('debug')) return;

    const context =
      typeof msgOrMeta === 'string' ? ctxOrMsg : this.defaultContext;
    const message =
      typeof msgOrMeta === 'string' ? msgOrMeta : ctxOrMsg;
    const data =
      typeof msgOrMeta === 'string' ? meta : msgOrMeta;

    console.debug(this.formatMessage('debug', context, message, data));
  }

  error(ctxOrMsg: string, msgOrErr?: unknown, err?: unknown) {
    if (!this.shouldLog('error')) return;

    const context =
      typeof msgOrErr === 'string' ? ctxOrMsg : this.defaultContext;
    const message =
      typeof msgOrErr === 'string' ? msgOrErr : ctxOrMsg;
    const errorObj =
      typeof msgOrErr === 'string' ? err : msgOrErr;

    console.error(this.formatMessage('error', context, message));
    if (errorObj) console.error(errorObj);
  }
}

export const logger = new Logger('App');
