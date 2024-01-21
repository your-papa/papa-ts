import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { App, TFile } from 'obsidian';
import crypto from 'crypto';

export function hashString(inputString: string): string {
    return crypto.createHash('sha1').update(inputString, 'utf-8').digest('hex');
}

// TODO create custom Document type

export async function obsidianDocumentLoader(obsidianApp: App, files: TFile[]): Promise<Document[]> {
    let docs: Document[] = [];
    for (const file of files) {
        const fileMetadata = obsidianApp.metadataCache.getFileCache(file);
        if (!fileMetadata) continue;
        //
        // TODO why is seperator only added to the next chunk?
        // Keep in mind that chunksize is not token size but character size
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 0, separators: ['\n', '. ', '? ', '! ', ' ', ''] });

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
                const id = file.path + ' metadata';
                const pageContent = 'Note Path: ' + file.path + '\n' + 'Metadaten:\n' + sectionContent;
                docs.push({
                    metadata: {
                        id,
                        hash: hashString(id + pageContent),
                        filepath: file.path,
                        order: 0,
                        header: [],
                        content: 'Metadaten:\n' + sectionContent,
                    },
                    pageContent,
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
            } else if (section.type === 'paragraph') {
                const splitParagraph = await splitter.splitText(sectionContent);
                for (const paragraph of splitParagraph) {
                    const id = file.path + headingTree.join('') + ' ID' + docCount;
                    const pageContent = 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + paragraph;
                    docs.push({
                        metadata: {
                            id,
                            hash: hashString(id + pageContent),
                            filepath: file.path,
                            order: docCount,
                            header: [...headingTree],
                            content: paragraph,
                        },
                        pageContent,
                    });
                    docCount++;
                }
            } else {
                // TODO handle other types like huge code blocks (Use codespliter)
                const id = file.path + headingTree.join('') + ' ID' + docCount;
                const pageContent = 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + sectionContent;
                docs.push({
                    metadata: {
                        id,
                        hash: hashString(id + pageContent),
                        filepath: file.path,
                        order: docCount,
                        header: [...headingTree],
                        content: sectionContent,
                    },
                    pageContent,
                });
                docCount++;
            }
        }
    }
    console.log('Loaded ' + docs.length + ' documents from Obsidian');

    return docs;
}
