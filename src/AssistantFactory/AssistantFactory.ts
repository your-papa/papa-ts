import { RAGAssistant, RAGAssistantConfig } from './Assistants/RAG';
import { GeneralAssistant, GeneralAssistantConfig } from './Assistants/General';

export type Assistant = 'rag' | 'plain';
export type AssistantConfig = RAGAssistantConfig | GeneralAssistantConfig;

export async function createAssistant(type: Assistant, config: AssistantConfig, langsmithApiKey?: string): Promise<RAGAssistant | GeneralAssistant> {
    switch (type) {
        case 'rag':
            return await RAGAssistant.create(config as RAGAssistantConfig, langsmithApiKey);
        case 'plain':
            return new GeneralAssistant(config as GeneralAssistantConfig, langsmithApiKey);
        default:
            throw new Error(`Unsupported assistant type: ${type}`);
    }
}
