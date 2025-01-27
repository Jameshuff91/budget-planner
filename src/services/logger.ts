type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private readonly MAX_LOGS = 1000;
  private logs: LogEntry[] = [];

  private createLogEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
  }

  private log(level: LogLevel, message: string, data?: any) {
    const logEntry = this.createLogEntry(level, message, data);

    // Add to in-memory logs
    this.logs.push(logEntry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Store in localStorage for persistence (only in browser)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('budget_planner_logs', JSON.stringify(this.logs));
      } catch (error) {
        console.error('Failed to store logs in localStorage:', error);
      }
    }

    // Console output with appropriate styling
    const consoleArgs = [
      `%c${logEntry.timestamp} [${level.toUpperCase()}] ${message}`,
      this.getLogStyle(level),
    ];
    if (data) consoleArgs.push(data);

    switch (level) {
      case 'debug':
        console.debug(...consoleArgs);
        break;
      case 'info':
        console.info(...consoleArgs);
        break;
      case 'warn':
        console.warn(...consoleArgs);
        break;
      case 'error':
        console.error(...consoleArgs);
        break;
    }
  }

  private getLogStyle(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return 'color: #808080';
      case 'info':
        return 'color: #0066cc';
      case 'warn':
        return 'color: #ff9900';
      case 'error':
        return 'color: #cc0000; font-weight: bold';
      default:
        return '';
    }
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('budget_planner_logs');
    }
  }

  // Load logs from localStorage on initialization
  initialize() {
    if (typeof window === 'undefined') return;

    try {
      const storedLogs = localStorage.getItem('budget_planner_logs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (error) {
      console.error('Failed to load logs from localStorage:', error);
    }
  }
}

export const logger = new Logger();
logger.initialize();
