import { Client } from 'langsmith';
import { LangChainTracer } from '@langchain/core/tracers/tracer_langchain';

export const getTracer = (langsmithApiKey: string) => {
    const client = new Client({
        apiKey: langsmithApiKey,
        apiUrl: 'https://api.smith.langchain.com',
    });
    return new LangChainTracer({
        projectName: 'Papa-ts',
        client,
    });
};
