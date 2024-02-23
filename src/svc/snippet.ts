import { initial } from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import JenkinsConfiguration from '../config/settings';
import logger from '../utils/logger';
import { Constants } from './constants';
import { SnippetItem, SnippetItems } from './jenkins-snippet';

export class SnippetSvc {

    private suiteSnippets: SnippetItems = {};

    private initialized = false;

    constructor(private readonly context: vscode.ExtensionContext) {
    }

    async invokeSnippet(snippetName: string): Promise<SnippetItem> {
        if (!this.initialized) {
            await this.loadSnippet();
        }
        const customFile = JenkinsConfiguration.snippetCustomFilePath.split(';');

        let snippets: SnippetItems = this.suiteSnippets;
        for (let snippetPath of customFile) {
            try {
                const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetPath));
                const snippet = JSON.parse(snippetContent.toString()) as SnippetItems;
                snippets = { ...snippets, ...snippet };
            } catch (error: any) {
                logger.error(error.message);
            }
        }
        return snippets[snippetName];
    }

    async invokeSnippetAll(filtering: boolean = true): Promise<SnippetItems> {
        const files = ['snippet.json'];
        const customFile = JenkinsConfiguration.snippetCustomFilePath.split(';');

        let snippets: SnippetItems = {};
        for (let snippetPath of files) {
            const snippetFilePath = path.join(this.context.extensionPath, 'snippets', snippetPath);
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
                logger.error(error.message);
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

    async invokeSnippetJenkins(snippetName: string): Promise<SnippetItem> {
        return await this.invokeSnippetFromPath(snippetName, Constants.SNIPPET_JENKINS_SUITE);
    }

    async invokeSnippetFromPath(snippetName: string, snippetPath: string): Promise<SnippetItem> {
        const snippetFilePath = path.join(this.context.extensionPath, 'snippets', snippetPath);
        const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
        const snippets = JSON.parse(snippetContent.toString());
        return snippets[snippetName];
    }

    async loadSnippet() {
        const files = ['snippet.json'];
        for (let snippetPath of files) {
            const snippetFilePath = path.join(this.context.extensionPath, 'snippets', snippetPath);
            const snippetContent = await vscode.workspace.fs.readFile(vscode.Uri.file(snippetFilePath));
            const snippet = JSON.parse(snippetContent.toString()) as SnippetItems;
            this.suiteSnippets = { ...this.suiteSnippets, ...snippet };
        }
    }

}
