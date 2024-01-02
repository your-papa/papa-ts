import { PromptTemplate } from 'langchain/prompts';

export const initialReducePrompt = PromptTemplate.fromTemplate(
    `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Fasse nur die Notes zusammen die zur beantwortung der Frage beitragen könnten und überspringe die anderen ohne diese weiter zu erwähnen.
Achte darauf, für jede zusammengefassten Note einen Wikilink (e.g. [[<Note Path><# Header1><## Header2>...]]) zur Note als Referenz anzugeben.
Bitte behalte die markdown formatiertung der Notes bei.
------------
Meine Notes: 
{content}`
);

export const reducePrompt = PromptTemplate.fromTemplate(
    `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Achte darauf, die markdown und wikilink formatierung in den Notes beizubehalten.
------------
Meine Notes: 
{content}`
);

export const ragPrompt = PromptTemplate.fromTemplate(
    `Als mein Assistent, bitte antworte auf meine Frage, wobei du ausschließlich auf mein vorhandenes Wissen aus Obsidian zurückgreifst.
Achte darauf, die Markdown-Formatierung zu verwenden und deiner Antwort, die im Wissen hinterlegten Wikilinks als Referenz (e.g. [[<Note>]]) hinzu zufügen. 
------------
Mein Wissen:
{context}
------------
Chat History: 
{chatHistory}
------------
Frage: {query}`
);

export const conversationPrompt = PromptTemplate.fromTemplate(
    `Antworte als mein Assistent auf meine Frage.
------------
Chat History: 
{chatHistory}
------------
Frage: {query}`
);
