import { App, TFile } from 'obsidian';
import { Document } from 'langchain/document';

export async function obsidianDocumentLoader(obsidianApp: App, files: TFile[]): Promise<Document[]> {
    let docs: Document[] = [];
    for (const file of files) {
        const fileMetadata = obsidianApp.metadataCache.getFileCache(file);
        if (!fileMetadata) continue;
        // TODO respect filepath
        docs.push({
            metadata: {
                id: file.basename + ' metadata',
                filename: file.basename,
            },
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
        let noteCount = 0;
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
                noteCount = 0;
                headerCount++;
            } else {
                docs.push({
                    metadata: {
                        id: headingTree.join('') + ' ID' + noteCount,
                        filename: file.basename,
                    },
                    pageContent: 'Notename: ' + headingTree.join('\n') + '\n' + pageContent.slice(section.position.start.offset, section.position.end.offset),
                });
                noteCount++;
            }
        }
    }
    console.log('Loaded ' + docs.length + ' documents from Obsidian', docs);

    return docs;
}
