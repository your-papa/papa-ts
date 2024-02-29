import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { App, TFile } from 'obsidian';
import crypto from 'crypto';

import Log from './Logging';

export function hashString(inputString: string): string {
    return crypto.createHash('sha1').update(inputString, 'utf-8').digest('hex');
}

// TODO create custom Document type

export async function obsidianDocumentLoader(obsidianApp: App, files: TFile[]): Promise<Document[]> {
    let docs: Document[] = [];
    for (const file of files) {
        const fileMetadata = obsidianApp.metadataCache.getFileCache(file);
        if (!fileMetadata) continue;
        // Keep in mind that chunksize is not token size but character size
        const maxTokenSize = 512;
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: maxTokenSize * 4, chunkOverlap: 0, separators: ['\n', '. ', '? ', '! ', ' ', ''] }); // One token is 4 characters on average

        // TODO check for edge cases for example if # is used and directly afterwards ###
        const noteContent = await obsidianApp.vault.cachedRead(file);
        let headerCount = 0;
        let docCount = 1;
        let headingTree: string[] = [];
        let currentHeadingLevel = 0;
        let foundFrontmatter = false;

        for (const section of fileMetadata.sections || []) {
            const sectionContent = noteContent.slice(section.position.start.offset, section.position.end.offset);
            const addDoc = async (embedContent: string, isMetadata: boolean = false) => {
                const id = file.path + (isMetadata ? ' metadata' : headingTree.join('') + ' ID' + docCount);
                docs.push({
                    metadata: {
                        id,
                        hash: hashString(id + sectionContent),
                        filepath: file.path,
                        order: isMetadata ? 0 : docCount,
                        header: [...headingTree],
                        content: isMetadata ? 'Metadaten:\n' + sectionContent : sectionContent,
                    },
                    pageContent: embedContent,
                });
                if (!isMetadata) docCount++;
            };

            if (section.type === 'yaml' && !foundFrontmatter) {
                const embedContent = 'Note Path: ' + file.path + '\n' + 'Metadaten:\n' + sectionContent;
                addDoc(embedContent, true);
                foundFrontmatter = true;
                continue;
            } else if (section.type === 'heading') {
                const currentHeading = fileMetadata.headings![headerCount];
                const headingContent = noteContent.slice(currentHeading.position.start.offset, currentHeading.position.end.offset);
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
                for (let i = 0; i < splitParagraph.length; i++) {
                    // this is done becuase seperator is only added to the next chunk for whatever reason
                    let splittedByChar = '';
                    if (
                        splitParagraph[i + 1] &&
                        (splitParagraph[i + 1].charAt(0) === '.' || splitParagraph[i + 1].charAt(0) === '?' || splitParagraph[i + 1].charAt(0) === '!')
                    ) {
                        splittedByChar = splitParagraph[i + 1].charAt(0);
                        splitParagraph[i + 1] = splitParagraph[i + 1].slice(1).trim();
                    }
                    const paragraph = splitParagraph[i] + splittedByChar;
                    const embedContent = 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + paragraph;
                    addDoc(embedContent);
                }
            } else if (section.type === 'code') {
                // ignore code blocks bigger than maxTokenSize for now (TODO)
                if (sectionContent.length > maxTokenSize * 4) continue;
                const embedContent = 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + sectionContent;
                addDoc(embedContent);
            } else {
                const embedContent = 'Note Path: ' + file.path + '\n' + headingTree.join('\n') + '\n' + sectionContent;
                addDoc(embedContent);
            }
        }
    }
    Log.info('Loaded ' + docs.length + ' documents from Obsidian');

    return docs;
}
