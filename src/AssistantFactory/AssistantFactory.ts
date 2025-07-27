// import { RAGAssistant, RAGAssistantConfig } from './Assistants/RAG';
// import { GeneralAssistant, GeneralAssistantConfig } from './Assistants/General';
// import { ProviderRegistry } from '../ProviderRegistry/ProviderRegistry';
// import { AgenticAssistant, AgenticAssistantConfig } from './Assistants/Agentic';

// export type Assistant = 'rag' | 'plain' | 'agentic';

// export type AssistantConfigType<T extends Assistant> = T extends 'rag'
//     ? RAGAssistantConfig
//     : T extends 'plain'
//     ? GeneralAssistantConfig
//     : AgenticAssistantConfig;

// export type AssistantType<T extends Assistant> = T extends 'rag' ? RAGAssistant : T extends 'plain' ? GeneralAssistant : AgenticAssistant;

// export async function createAssistant<T extends Assistant>(
//     providerRegistry: ProviderRegistry,
//     type: T,
//     config: AssistantConfigType<T>,
//     langsmithApiKey?: string
// ) {
//     if (type === 'rag') {
//         const ragAssistantConfig = config as RAGAssistantConfig;
//         return (await RAGAssistant.create(
//             {
//                 ...ragAssistantConfig,
//                 embedModel: await providerRegistry.getEmbedProvider(ragAssistantConfig.embedModel.provider).useModel(ragAssistantConfig.embedModel.name),
//                 genModel: await providerRegistry.getGenProvider(ragAssistantConfig.genModel.provider).useModel(ragAssistantConfig.genModel.name),
//             },
//             langsmithApiKey
//         )) as AssistantType<T>;
//     } else if (type === 'plain') {
//         const generalAssistantConfig = config as GeneralAssistantConfig;
//         return new GeneralAssistant(
//             {
//                 ...generalAssistantConfig,
//                 genModel: await providerRegistry.getGenProvider(generalAssistantConfig.genModel.provider).useModel(generalAssistantConfig.genModel.name),
//             },
//             langsmithApiKey
//         ) as AssistantType<T>;
//     } else if (type === 'agentic') {
//         const agenticAssistantConfig = config as AgenticAssistantConfig;
//         return new AgenticAssistant(
//             {
//                 ...agenticAssistantConfig,
//                 genModel: await providerRegistry.getGenProvider(agenticAssistantConfig.genModel.provider).useModel(agenticAssistantConfig.genModel.name),
//             },
//             langsmithApiKey
//         ) as AssistantType<T>;
//     } else {
//         throw new Error('Unsupported assistant type');
//     }
// }
