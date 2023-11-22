import { App } from 'obsidian';
import { Document } from 'langchain/document';

export async function obsidianDocumentLoader(obsidianApp: App): Promise<Document[]> {
    let docs: Document[] = [];
    for (const file of obsidianApp.vault.getMarkdownFiles()) {
        const fileMetadata = obsidianApp.metadataCache.getFileCache(file);
        if (!fileMetadata) continue;
        docs.push({
            metadata: {},
            pageContent:
                'Note: ' +
                file.basename +
                '\n' +
                'Erstellt am: ' +
                new Date(file.stat.ctime) +
                '\n' +
                'Metadaten: ' +
                JSON.stringify(fileMetadata.frontmatter || {}),
        });

        const pageContent = await obsidianApp.vault.cachedRead(file);
        let headerCount = 0;
        let headingTree = [];
        headingTree.push(file.basename);
        let currentHeadingLevel = 0;
        for (const section of fileMetadata.sections || []) {
            if (section.type === 'heading') {
                const currentHeading = fileMetadata.headings![headerCount];
                if (currentHeading.level > currentHeadingLevel) {
                    headingTree.push(pageContent.slice(currentHeading.position.start.offset, currentHeading.position.end.offset));
                    currentHeadingLevel = currentHeading.level;
                } else if (currentHeading.level < currentHeadingLevel) {
                    headingTree.pop();
                    headingTree.pop();
                    headingTree.push(pageContent.slice(currentHeading.position.start.offset, currentHeading.position.end.offset));
                    currentHeadingLevel = currentHeading.level;
                } else {
                    headingTree.pop();
                    headingTree.push(pageContent.slice(currentHeading.position.start.offset, currentHeading.position.end.offset));
                }
                headerCount++;
            } else
                docs.push({
                    metadata: {},
                    pageContent: 'Notename: ' + headingTree.join('\n') + '\n' + pageContent.slice(section.position.start.offset, section.position.end.offset),
                });
        }
    }

    return docs;
}
