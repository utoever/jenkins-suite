import { log } from 'console';
import * as path from 'path';
import * as vscode from 'vscode';
import JenkinsConfiguration from '../config/settings';
import { SnippetItem, SnippetItems } from '../snippet/snippet';
import { Constants } from '../svc/constants';

export async function invokeSnippet(context: vscode.ExtensionContext, snippetName: string): Promise<SnippetItem> {
    const snippetFilePath = path.join(context.extensionPath, 'snippets', 'snippet.json');
    const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
    const snippets = JSON.parse(snippetContent.toString());
    return snippets[snippetName];
}

export async function invokeSnippetJenkins(context: vscode.ExtensionContext, snippetName: string): Promise<SnippetItem> {
    return await invokeSnippetFromPath(context, snippetName, Constants.SNIPPET_JENKINS_SUITE);
}

export async function invokeSnippetFromPath(context: vscode.ExtensionContext, snippetName: string, snippetPath: string): Promise<SnippetItem> {
    const snippetFilePath = path.join(context.extensionPath, 'snippets', snippetPath);
    const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
    const snippets = JSON.parse(snippetContent.toString());
    return snippets[snippetName];
}

export async function invokeSnippetAll(context: vscode.ExtensionContext, filtering: boolean = true): Promise<SnippetItems> {
    const files = ['snippet.json'];
    const customFile = JenkinsConfiguration.snippetCustomFilePath.split(';');

    let snippets: SnippetItems = {};
    for (let snippetPath of files) {
        const snippetFilePath = path.join(context.extensionPath, 'snippets', snippetPath);
        const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
        const snippet = JSON.parse(snippetContent.toString()) as SnippetItems;
        snippets = { ...snippets, ...snippet };
    }

    for (let snippetPath of customFile) {
        try {
            const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetPath));
            const snippet = JSON.parse(snippetContent.toString()) as SnippetItems;
            snippets = { ...snippets, ...snippet };
        } catch (error: any) {
            console.log(error.message);
        }
    }

    let filteredSnippets: SnippetItems = {};
    if (filtering) {
        Object.keys(snippets).forEach((key: string) => {
            const item = snippets[key];
            // const when = item.when ? JenkinsConfiguration.getPropertyAsBoolean(item.when) : true;
            if (!item.hidden) {
                filteredSnippets = {
                    ...filteredSnippets, ...{
                        [key]: item
                    }
                };
            }
        });
    } else {
        filteredSnippets = snippets;
    }
    return filteredSnippets;
}

export function toArray<T>(obj: T | T[]): T[] {
    if (obj instanceof Array) {
        return obj;
    } else {
        return [obj];
    }
}

export function inferFileExtension(content: string): string | null {
    const fileExtensionMapping = {
        'xml': /<\?xml.*\?>/i,
        'json': /^\s*\{.*\}\s*$/,
        'csv': /^.+$/
    };

    for (const [extension, pattern] of Object.entries(fileExtensionMapping)) {
        if (pattern.test(content)) {
            return extension;
        }
    }
    return null;
}

export function randomCharacters(length: number = 6): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}