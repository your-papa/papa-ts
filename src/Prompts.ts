import { PromptTemplate } from 'langchain/prompts';

export const Prompts = {
    de: {
        createTitle:
            PromptTemplate.fromTemplate(`Erstelle einen Titel der die folgende Chathistory zusammenfasst, sodass er direkt als Dateinamen verwendet werden kann. Der Dateiname darf also keine Sonderzeichen wie Schrägstriche (/, \\), Doppelpunkte (:), Sternchen (*), Fragezeichen (*), oder Ausrufezeichen (!) enthalten.
Chathistory:
"{chatHistory}"

Titel:`),
        initialReduce: PromptTemplate.fromTemplate(
            `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Fasse nur die Notes zusammen die zur beantwortung der Frage beitragen könnten und überspringe die anderen ohne diese weiter zu erwähnen.
Achte darauf, für jede zusammengefassten Note einen Wikilink (e.g. [[<Note Path><# Header1><## Header2>...]]) zur Note als Referenz anzugeben.
Bitte behalte die markdown formatiertung der Notes bei.
------------
Meine Notes: 
{content}`
        ),
        reduce: PromptTemplate.fromTemplate(
            `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Achte darauf, die markdown und wikilink formatierung in den Notes beizubehalten.
------------
Meine Notes: 
{content}`
        ),

        rag: PromptTemplate.fromTemplate(
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
        ),

        conversation: PromptTemplate.fromTemplate(
            `Antworte als mein Assistent auf meine Frage.
------------
Chat History: 
{chatHistory}
------------
Frage: {query}`
        ),
    },
    en: {
        createTitle:
            PromptTemplate.fromTemplate(`Create a title that summarizes the following chat history so that it can be used directly as a filename. The filename must not contain any special characters such as slashes (/, \\), colons (:), asterisks (*), question marks (*), or exclamation marks (!).
Chat History:
"{chatHistory}"

Title:`),
        initialReduce: PromptTemplate.fromTemplate(
            `Summarize my notes so that the question "{query}" could still be answered in detail afterwards.
Only summarize the notes that could contribute to answering the question and skip the others without mentioning them further.
Make sure to include a wikilink (e.g. [[<Note Path><# Header1><## Header2>...]]) to the note as a reference for each summarized note.
Please keep the markdown formatting of the notes.
------------
My Notes:
{content}`
        ),
        reduce: PromptTemplate.fromTemplate(
            `Summarize my notes so that the question "{query}" could still be answered in detail afterwards.
Make sure to keep the markdown and wikilink formatting in the notes.
------------
My Notes:
{content}`
        ),

        rag: PromptTemplate.fromTemplate(
            `As my assistant, please answer my question, using only my existing knowledge from Obsidian.
Make sure to use Markdown formatting and add the wikilinks from the knowledge as a reference (e.g. [[<Note>]]) to your answer.
------------
My Knowledge:
{context}
------------
Chat History:
{chatHistory}
------------
Question: {query}`
        ),

        conversation: PromptTemplate.fromTemplate(
            `Answer my question as my assistant.
------------
Chat History:
{chatHistory}
------------
Question: {query}`
        ),
    },
};

export type Language = keyof typeof Prompts;

export const Languages = Object.keys(Prompts) as (keyof typeof Prompts)[];
