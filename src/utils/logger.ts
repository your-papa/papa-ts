type DebugFlag = boolean | string | undefined;

function resolveFlagValue(value: DebugFlag): boolean | undefined {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1';
    }
    return undefined;
}

const globalFlag =
    typeof globalThis !== 'undefined'
        ? (globalThis as { PRIVACY_AGENT_DEBUG?: DebugFlag }).PRIVACY_AGENT_DEBUG
        : undefined;

const envFlag = (() => {
    if (typeof globalThis === 'undefined') {
        return undefined;
    }
    const maybeProcess = (globalThis as { process?: { env?: Record<string, DebugFlag> } }).process;
    return maybeProcess?.env?.PRIVACY_AGENT_DEBUG;
})();

const isDebugEnabled = resolveFlagValue(globalFlag) ?? resolveFlagValue(envFlag) ?? false;

export function debugLog(scope: string, details: Record<string, unknown> | string): void {
    if (!isDebugEnabled) {
        return;
    }
    const globalConsole = typeof globalThis !== 'undefined' ? globalThis.console : undefined;
    const logFn =
        globalConsole && typeof globalConsole.debug === 'function'
            ? globalConsole.debug.bind(globalConsole)
            : globalConsole?.log?.bind(globalConsole);
    if (!logFn) {
        return;
    }
    const payload = typeof details === 'string' ? details : JSON.stringify(details, (_, value) => value, 2);
    logFn(`[privacy-agent][${new Date().toISOString()}][${scope}]`, payload);
}

