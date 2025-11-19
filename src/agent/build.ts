import { createAgent } from 'langchain';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseCheckpointSaver } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';

export interface BuildAgentParams {
    model: BaseChatModel;
    tools?: readonly unknown[];
    systemPrompt?: string;
    checkpointer?: BaseCheckpointSaver;
}

export function buildAgent(params: BuildAgentParams) {
    const { model, tools = [], systemPrompt, checkpointer } = params;
    const toolList = Array.isArray(tools) ? [...tools] : [];
    return createAgent({
        model,
        tools: toolList,
        systemPrompt,
        checkpointer: checkpointer ?? new MemorySaver(),
    });
}

