export const Prompts = {
    de: {
        initialAssistantMessage: `Hallo, ich bin dein Assistent. Wie kann ich dir helfen?`,
        createTitle: `Erstelle einen sehr kurzen Titel als Zussamenfassung über die folgende Konversation (durch XML-Tags begrenzt), sodass er direkt als Dateinamen verwendet werden kann. Der Title darf also ausschließlich nur aus Buchstaben und Leerzeichen bestehen.
<conversation>
{firstMessage}
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
{firstMessage}
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
    fr: {
        initialAssistantMessage: `Bonjour, je suis votre assistant. Comment puis-je vous aider?`,
        createTitle: `Créez un titre très court comme résumé de la conversation suivante (encadrée par des balises XML), de sorte qu'il puisse être utilisé directement comme nom de fichier. Le titre ne peut contenir que des lettres et des espaces.
<conversation>
{firstMessage}
</conversation>
Titre:`,
        initialReduce: `Résumez mes notes (encadrées par des balises XML) de manière à ce que la question "{query}" puisse encore être répondue en détail par la suite.
Résumez uniquement les notes qui pourraient contribuer à répondre à la question et ignorez les autres sans les mentionner davantage.
Assurez-vous d'inclure le wikilink (format: [[<Note Path><# Header1><## Header2>...]]) à la note comme référence pour chaque note résumée.
<notes>
{content}
</notes>
Résumé:`,
        reduce: `Résumez mes notes (encadrées par des balises XML) de manière à ce que la question "{query}" puisse encore être répondue en détail par la suite.
Veillez à conserver la mise en forme markdown et les wikilinks (format: [[<Note>]]) dans les notes.
<notes>
{content}
</notes>
Résumé:`,
        rag: `En tant qu'assistant, veuillez répondre à ma question en utilisant uniquement mes connaissances existantes (encadrées par des balises XML) provenant d'Obsidian.
Assurez-vous d'utiliser la mise en forme Markdown et d'ajouter les wikilinks (format: [[<Note>]]) des connaissances comme référence à votre réponse.
<knowledge>
{context}
</knowledge>
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Réponse:`,
        conversation: `Répondez à ma question en tant qu'assistant basé sur l'historique du chat.
<chathistory>
{chatHistory}
</chathistory>
<query>
{query}
</query>
Réponse:`,
    },
    zh: {
        initialAssistantMessage: `你好，我是你的助手。我能帮你什么？`,
        createTitle: `创建一个非常简短的标题，作为以下对话的总结（用XML标签括起来），以便可以直接用作文件名。标题只能由字母和空格组成。
        <conversation>
        {firstMessage}
         </conversation>
         标题：`,
        initialReduce: `总结我的笔记（用XML标签括起来），以便问题 "{query}" 之后仍然可以详细回答。仅总结那些能有助于回答问题的笔记，跳过其他内容而不再提及。确保包含维基链接（格式：[[<Note Path><# Header1><## Header2>...]])作为每个总结笔记的参考。
        <notes>
        {content}
        </notes>
        总结：`,
        reduce: `总结我的笔记（用XML标签括起来），以便问题 "{query}" 之后仍然可以详细回答。确保保留笔记的Markdown和维基链接格式（格式：[[<Note>]]）。
        <notes>
        {content}
        </notes>
        总结：`,
        rag: `作为我的助手，请根据我在Obsidian中的现有知识（用XML标签括起来）回答我的问题。确保使用Markdown格式，并添加维基链接（格式：[[<Note>]]）作为你回答的参考。
        <knowledge>
        {context}
        </knowledge>
        <chathistory>
        {chatHistory}
        </chathistory>
        <query>
        {query}
        </query>
        回应：`,
        conversation: `作为我的助手，根据聊天记录回应我的问题。
        <chathistory>
        {chatHistory}
        </chathistory>
        <query>
        {query}
        </query>
        回答：`,
    },
};

export type Language = keyof typeof Prompts;

export const Languages = Object.keys(Prompts) as (keyof typeof Prompts)[];
