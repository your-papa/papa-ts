import { Client } from 'langsmith';
import { LangChainTracer } from 'langchain/callbacks';

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
