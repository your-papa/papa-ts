import { App, TFile } from 'obsidian';
import { Document } from 'langchain/document';
import { TokenTextSplitter } from 'langchain/text_splitter';

export async function obsidianDocumentLoader(obsidianApp: App, files: TFile[]): Promise<Document[]> {
    let docs: Document[] = [];
    const splitter = new TokenTextSplitter({ encodingName: 'cl100k_base', chunkSize: 8192, chunkOverlap: 0 });
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
            const sectionContent = pageContent.slice(section.position.start.offset, section.position.end.offset);
            if (section.type === 'yaml' && !foundFrontmatter) {
                docs.push({
                    metadata: {
                        id: file.path + ' metadata',
                        filepath: file.path,
                        order: 0,
                        header: [],
                        content: 'Metadaten:\n' + sectionContent,
                    },
                    pageContent: 'Note Path: ' + file.path + '\n' + 'Metadaten:\n' + sectionContent,
                });
                foundFrontmatter = true;
                continue;
            } else if (section.type === 'heading') {
                const currentHeading = fileMetadata.headings![headerCount];
                const headingContent = pageContent.slice(currentHeading.position.start.offset, currentHeading.position.end.offset);
                if (currentHeading.level > currentHeadingLevel) {
                    headingTree.push(headingContent);
                    currentHeadingLevel = currentHeading.level;
                } else if (currentHeading.level < currentHeadingLevel) {
                    headingTree.pop();
                    headingTree.pop();
                    headingTree.push(headingContent);
                    currentHeadingLevel = currentHeading.level;
                } else {
                    headingTree.pop();
                    headingTree.push(headingContent);
                }
                headerCount++;
            } else if (section.type === 'thematicBreak') {
                // ignoring --- in markdown
                continue;
            } else {
                // console.log("Splitting document '" + file.path + headingTree.join('') + ' ID' + docCount + "' into chunks");
                // const splits = await splitter.splitText(sectionContent);
                // console.log('Split document into ' + splits.length + ' chunks', splits);
                // console.log(splits[0].length);
                docs.push({
                    metadata: {
                        id: file.path + headingTree.join('') + ' ID' + docCount,
                        filepath: file.path,
                        order: docCount,
                        header: [...headingTree],
                        content: sectionContent,
                    },
                    pageContent: 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + sectionContent,
                });
                docCount++;
            }
        }
    }
    console.log('Loaded ' + docs.length + ' documents from Obsidian', docs);

    return docs;
}
