export const Prompts = {
    de: {
        initialAssistantMessage: `Hallo, ich bin dein Assistent. Wie kann ich dir helfen?`,
        createTitle: `Erstelle einen sehr kurzen Titel als Zussamenfassung über die folgende Konversation, sodass er direkt als Dateinamen verwendet werden kann. Der Title darf also ausschließlich nur aus Buchstaben und Leerzeichen bestehen.
Conversation:
"{chatHistory}"

Titel:`,
        initialReduce: `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Fasse nur die Notes zusammen die zur beantwortung der Frage beitragen könnten und überspringe die anderen ohne diese weiter zu erwähnen.
Achte darauf, für jede zusammengefassten Note einen Wikilink (e.g. [[<Note Path><# Header1><## Header2>...]]) zur Note als Referenz anzugeben.
Bitte behalte die markdown formatiertung der Notes bei.
------------
Meine Notes: 
{content}
------------
Zusammenfassung:`,
        reduce: `Fasse meine Notes zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Achte darauf, die markdown und wikilink formatierung in den Notes beizubehalten.
------------
Meine Notes: 
{content}
------------
Zusammenfassung:`,
        rag: `Als mein Assistent, bitte antworte auf meine Frage, wobei du ausschließlich auf mein vorhandenes Wissen aus Obsidian zurückgreifst.
Achte darauf, die Markdown-Formatierung zu verwenden und deiner Antwort, die im Wissen hinterlegten Wikilinks als Referenz (e.g. [[<Note Path>]]) hinzu zufügen. 
------------
Mein Wissen:
{context}
------------
Chat History: 
{chatHistory}
------------
Frage: {query}
------------
Antwort:`,
        conversation: `Antworte als mein Assistent auf meine Frage.
------------
Chat History: 
{chatHistory}
------------
Frage: {query}
Antwort:`,
    },
    en: {
        initialAssitantMessage: `Hello, I am your assistant. How can I help you?`,
        createTitle: `Create a short Title about the following conversation, so that it can be used directly as a filename. The Title may only consist of letters and spaces.
Conversation:
"{chatHistory}"

Title:`,
        initialReduce: `Summarize my notes so that the question "{query}" could still be answered in detail afterwards.
Only summarize the notes that could contribute to answering the question and skip the others without mentioning them further.
Make sure to include a wikilink (e.g. [[<Note Path><# Header1><## Header2>...]]) to the note as a reference for each summarized note.
Please keep the markdown formatting of the notes.
------------
My Notes:
{content}
Summary:`,
        reduce: `Summarize my notes so that the question "{query}" could still be answered in detail afterwards.
Make sure to keep the markdown and wikilink formatting in the notes.
------------
My Notes:
{content}
Summary:`,
        rag: `As my assistant, please answer my question, using only my existing knowledge from Obsidian.
Make sure to use Markdown formatting and add the wikilinks from the knowledge as a reference (e.g. [[<Note>]]) to your answer.
------------
My Knowledge:
{context}
------------
Chat History:
{chatHistory}
------------
Question: {query}
------------
Answer:`,
        conversation: `Answer my question as my assistant.
------------
Chat History:
{chatHistory}
------------
Question: {query}
------------
Answer:`,
    },
};

export type Language = keyof typeof Prompts;

export const Languages = Object.keys(Prompts) as (keyof typeof Prompts)[];
