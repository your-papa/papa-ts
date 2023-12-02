import { App, TFile } from 'obsidian';
import { Document } from 'langchain/document';

export async function obsidianDocumentLoader(obsidianApp: App, files: TFile[]): Promise<Document[]> {
    let docs: Document[] = [];
    for (const file of files) {
        const fileMetadata = obsidianApp.metadataCache.getFileCache(file);
        if (!fileMetadata) continue;

        // TODO check for edge cases for example if # is used and directly afterwards ###
        const pageContent = await obsidianApp.vault.cachedRead(file);
        let headerCount = 0;
        let docCount = 1;
        let headingTree = [];
        let currentHeadingLevel = 0;
        let foundFrontmatter = false;
        for (const section of fileMetadata.sections || []) {
            if (section.type === 'yaml' && !foundFrontmatter) {
                // TODO respect filepath
                docs.push({
                    metadata: {
                        id: file.basename + ' metadata',
                        filename: file.basename,
                        order: 0,
                        header: [],
                        // content: 'Datei Erstellt am: ' + new Date(file.stat.ctime) + '\n' + 'Metadaten: ' + JSON.stringify(fileMetadata.frontmatter || {}),
                        content: 'Metadaten:\n' + pageContent.slice(section.position.start.offset, section.position.end.offset),
                    },
                    pageContent:
                        'Note Name: ' +
                        file.basename +
                        '\n' +
                        // 'Datei erstellt am: ' +
                        // new Date(file.stat.ctime) +
                        // '\n' +
                        'Metadaten:\n' +
                        pageContent.slice(section.position.start.offset, section.position.end.offset),
                });
                foundFrontmatter = true;
                continue;
            } else if (section.type === 'heading') {
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
            } else if (section.type === 'thematicBreak') {
                continue;
            } else {
                // TODO respect filepath
                docs.push({
                    metadata: {
                        id: file.basename + headingTree.join('') + ' ID' + docCount,
                        filename: file.basename,
                        order: docCount,
                        header: [...headingTree],
                        content: pageContent.slice(section.position.start.offset, section.position.end.offset),
                    },
                    pageContent:
                        'Note Name: ' +
                        file.basename +
                        '\n' +
                        headingTree.join('\n') +
                        '\n' +
                        pageContent.slice(section.position.start.offset, section.position.end.offset),
                });
                docCount++;
            }
        }
    }
    console.log('Loaded ' + docs.length + ' documents from Obsidian', docs);

    return docs;
}
