import { RAGAssistant, RAGAssistantConfig } from './RAG';
import { GeneralAssistant, GeneralAssistantConfig } from './General';

export type Assistant = 'rag' | 'plain';
export type AssistantConfig = RAGAssistantConfig | GeneralAssistantConfig;

export async function createAssistant(type: Assistant, config: AssistantConfig) {
    switch (type) {
        case 'rag':
            return await RAGAssistant.create(config as RAGAssistantConfig);
        case 'plain':
            return new GeneralAssistant(config as GeneralAssistantConfig);
        default:
            throw new Error(`Unsupported assistant type: ${type}`);
    }
}
