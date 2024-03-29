// TODO eslint rule to remove all console.logs before production

export enum LogLvl {
    DEBUG = 1,
    INFO = 2,
    ERROR = 3,
    DISABLED = 4,
}

class Logger {
    private static logLevel = LogLvl.DISABLED;

    static setLogLevel(logLevel: LogLvl) {
        Logger.logLevel = logLevel;
    }

    static debug(...args: any[]) {
        if (Logger.logLevel <= LogLvl.DEBUG) console.debug('[PAPA]', ...args);
    }

    static info(...args: any[]) {
        if (Logger.logLevel <= LogLvl.INFO) console.info('[PAPA]', ...args);
    }

    static error(...args: any[]) {
        if (Logger.logLevel <= LogLvl.ERROR) console.error('[PAPA]', ...args);
    }
}

export default Logger;
