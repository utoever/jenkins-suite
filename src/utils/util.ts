import * as path from 'path';
import * as vscode from 'vscode';
import JenkinsConfiguration from '../config/settings';
import { SnippetItem } from '../snippet/snippet';
import { BuildsModel, JobProperty } from "../types/model";

export function getParameterDefinition(build: BuildsModel | undefined): JobProperty[] {
    if (build) {
        return build.property.filter(val => val._class === 'hudson.model.ParametersDefinitionProperty');
    } else {
        return [];
    }
}

export async function invokeSnippet(context: vscode.ExtensionContext, snippetName: string): Promise<SnippetItem> {
    const snippetFilePath = path.join(context.extensionPath, 'snippets', 'snippet.json');
    const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
    const snippets = JSON.parse(snippetContent.toString());
    return snippets[snippetName];
}

export async function invokeSnippetJenkins(context: vscode.ExtensionContext, snippetName: string): Promise<SnippetItem> {
    return await invokeSnippetFromPath(context, snippetName, 'jenkins.json');
}

export async function invokeSnippetFromPath(context: vscode.ExtensionContext, snippetName: string, snippetPath: string): Promise<SnippetItem> {
    const snippetFilePath = path.join(context.extensionPath, 'snippets', snippetPath);
    const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
    const snippets = JSON.parse(snippetContent.toString());
    return snippets[snippetName];
}

export async function invokeSnippetAll(context: vscode.ExtensionContext, filtering: boolean = true): Promise<{ [key: string]: SnippetItem }> {
    const files = ['snippet.json', 'jenkins.json'];
    let snippets: { [key: string]: SnippetItem } = {};
    for (let snippetPath of files) {
        const snippetFilePath = path.join(context.extensionPath, 'snippets', snippetPath);
        const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
        const snippet = JSON.parse(snippetContent.toString());
        snippets = { ...snippets, ...snippet };
    }

    let filteredSnippets: { [key: string]: SnippetItem } = {};
    if (filtering) {
        Object.keys(snippets).forEach((key: string) => {
            const item = snippets[key];
            const when = item.when ? JenkinsConfiguration.getPropertyAsBoolean(item.when) : true;
            const flag = item.hidden ? !item.hidden : true;
            if (when && flag) {
                filteredSnippets = {
                    ...filteredSnippets, ...{
                        key: item
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

