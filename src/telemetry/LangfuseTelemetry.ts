import { CallbackHandler } from '@langfuse/langchain';
import type { Callbacks } from '@langchain/core/callbacks/manager';
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

import type { Telemetry } from './Telemetry';

// See https://langfuse.com/integrations/frameworks/langchain for the official integration pattern.
export interface LangfuseTelemetryOptions {
    /** Optional user identifier to attach to traces. */
    userId?: string;
    /** Optional session identifier to group traces. */
    sessionId?: string;
    /** Optional tags forwarded to Langfuse. */
    tags?: string[];
    /** Optional version of the application emitting traces. */
    version?: string;
    /** Additional metadata stored alongside each trace. */
    traceMetadata?: Record<string, unknown>;
    /** When true, call `flush` on the handler after each run (useful in short-lived scripts). */
    flushOnComplete?: boolean;
    /** Langfuse public key. */
    publicKey: string;
    /** Langfuse secret key. */
    secretKey: string;
    /** Langfuse base URL. */
    baseUrl: string;
    /** Optional environment tag for traces. Defaults to "node-tools-demo". */
    environment?: string;
}

export class LangfuseTelemetry implements Telemetry {
    private readonly handler: CallbackHandler;
    private readonly flushOnComplete: boolean;

    constructor(options: LangfuseTelemetryOptions) {
        const {
            flushOnComplete = false,
            publicKey,
            secretKey,
            baseUrl,
            environment,
            ...handlerOptions
        } = options;

        if (!publicKey || !secretKey || !baseUrl) {
            throw new Error('LangfuseTelemetry requires publicKey, secretKey, and baseUrl.');
        }

        const sdk = new NodeSDK({
            spanProcessors: [new LangfuseSpanProcessor({
                publicKey,
                secretKey,
                baseUrl,
                environment,
            })],
        });

        sdk.start();
        this.handler = new CallbackHandler(handlerOptions);
        this.flushOnComplete = flushOnComplete;
    }

    getCallbacks(): Callbacks {
        return [this.handler];
    }

    async onRunComplete(): Promise<void> {
        if (!this.flushOnComplete) {
            return;
        }
        const maybeFlush = (this.handler as unknown as { flush?: () => Promise<void> }).flush;
        if (typeof maybeFlush === 'function') {
            await maybeFlush.call(this.handler);
        }
    }
}

