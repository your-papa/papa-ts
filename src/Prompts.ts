export const Prompts = {
    de: {
        initialAssistantMessage: `Hallo, ich bin dein Assistent. Wie kann ich dir helfen?`,
        createTitle: `Erstelle einen sehr kurzen Titel als Zussamenfassung über die folgende Konversation (durch XML-Tags begrenzt), sodass er direkt als Dateinamen verwendet werden kann. Der Title darf also ausschließlich nur aus Buchstaben und Leerzeichen bestehen.
<conversation>
{chatHistory}
</conversation>
Titel:`,
        initialReduce: `Fasse meine Notes (durch XML-Tags begrenzt) zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Fasse nur die Notes zusammen die zur beantwortung der Frage beitragen könnten und überspringe die anderen ohne diese weiter zu erwähnen.
Achte darauf, für jede zusammengefassten Note den Wikilink (format: [[<Note Path><# Header1><## Header2>...]]) zur Note als Referenz anzugeben.
Bitte behalte die markdown formatiertung der Notes bei.
<notes>
{content}
</notes>
Zusammenfassung:`,
        reduce: `Fasse meine Notes (durch XML-Tags begrenzt) zusammen, sodass die Frage "{query}" im nachhinein noch ausführlich beantwortet werden könnte.
Achte darauf, die markdown und wikilink formatierung in den Notes beizubehalten.
<notes>
{content}
</notes>
Zusammenfassung:`,
        rag: `Als mein Assistent, bitte antworte basierend auf meiner Frage und der chathistory, wobei du ausschließlich auf mein vorhandenes Wissen (durch XML-Tags begrenzt) aus Obsidian zurückgreifst.
Achte darauf, die Markdown-Formatierung zu verwenden und deiner Antwort, die im Wissen hinterlegten Wikilinks (wikilink format: [[<Note Path>]]) als Referenz hinzu zufügen. 
<knowledge>
{context}
</knowledge>
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Antwort:`,
        conversation: `Antworte als mein Assistent auf meine Frage basierend auf der chathistory (durch XML-Tags begrenzt).
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Antwort:`,
    },
    en: {
        initialAssistantMessage: `Hello, I am your assistant. How can I help you?`,
        createTitle: `Create a very short title as a summary of the following conversation (enclosed by XML tags), so that it can be used directly as a filename. The title may only consist of letters and spaces.
<conversation>
{chatHistory}
</conversation>
Title:`,
        initialReduce: `Summarize my notes (enclosed by XML tags) so that the question "{query}" could still be answered in detail afterwards.
Only summarize the notes that could contribute to answering the question and skip the others without mentioning them further.
Make sure to include the wikilink (format: [[<Note Path><# Header1><## Header2>...]]) to the note as a reference for each summarized note.
Please keep the markdown formatting of the notes.
<notes>
{content}
</notes>
Summary:`,
        reduce: `Summarize my notes (enclosed by XML tags) so that the question "{query}" could still be answered in detail afterwards.
Make sure to keep the markdown and wikilink formatting (format: [[<Note>]]) in the notes.
<notes>
{content}
</notes>
Summary:`,
        rag: `As my assistant, please respond to my query, using only my existing knowledge (enclosed by XML tags) from Obsidian.
Make sure to use Markdown formatting and add the wikilinks (format: [[<Note>]]) from the knowledge as a reference to your answer.
<knowledge>
{context}
</knowledge>
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Response:`,
        conversation: `Respond to my query as my assistant based on the chathistory.
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Response:`,
    },
};

export type Language = keyof typeof Prompts;

export const Languages = Object.keys(Prompts) as (keyof typeof Prompts)[];
