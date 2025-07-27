// import { BaseAssistant, AssistantResponse, PipeInput } from '../BaseAssistant';
// import { Language } from '../Prompts';
// import { GenModel, GenModelFilled } from '../../ProviderRegistry/GenProvider';

// import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
// import { MemorySaver } from '@langchain/langgraph';
// import { HumanMessage } from '@langchain/core/messages';
// import { createReactAgent } from '@langchain/langgraph/prebuilt';
// import { IterableReadableStream } from '@langchain/core/utils/stream';
// import { StreamEvent } from '@langchain/core/dist/tracers/event_stream';

// export type AgenticAssistantConfig = {
//     genModel: GenModel;
//     tavilyApiKey: string;
//     lang?: Language;
// };

// export class AgenticAssistant extends BaseAssistant {
//     private agent;

//     constructor(config: { genModel: GenModelFilled; tavilyApiKey: string; lang?: Language }, langsmithApiKey?: string) {
//         super(config.genModel, langsmithApiKey);

//         const agentTools = [new TavilySearchResults({ maxResults: 3, apiKey: config.tavilyApiKey })];
//         const agentCheckpointer = new MemorySaver();
//         this.agent = createReactAgent({ llm: this.genModel.lc, tools: agentTools, checkpointSaver: agentCheckpointer });
//         this.lang = config.lang ?? 'en';
//     }

//     run(input: PipeInput): AsyncGenerator<AssistantResponse> {
//         return this.streamProcessor(
//             this.agent.streamEvents(
//                 { messages: [new HumanMessage(input.userQuery)] },
//                 { version: 'v2', callbacks: [this.tracer ? this.tracer : {}], configurable: { thread_id: '42' } }
//             )
//         );
//     }

//     protected async *streamProcessor(eventStream: IterableReadableStream<StreamEvent>): AsyncGenerator<AssistantResponse> {
//         let sbResponse: AssistantResponse = { status: 'startup' };
//         let content = '';
//         for await (const event of eventStream) {
//             if (this.stopRunFlag) {
//                 this.stopRunFlag = false;
//                 yield { status: 'stopped', content: event.data.chunk };
//                 return;
//             }
//             if (event.event === 'on_chat_model_stream') {
//                 content += event.data.chunk.content;
//                 sbResponse = { status: 'generating', content };
//             } else if (event.event === 'on_chat_model_end') {
//                 content = event.data.output.content;
//                 sbResponse = { status: 'generating', content };
//             }
//             yield sbResponse;
//         }
//     }
// }
