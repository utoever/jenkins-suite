import { initial } from 'lodash';
import * as path from 'path';
import * as vscode from 'vscode';
import logger from '../utils/logger';
import { SnippetSvc } from './snippet';

export default class JenkinsSnippet {

    private _snippets: SnippetItems | undefined;

    private static _instance: JenkinsSnippet;

    private snippetSvc: SnippetSvc;

    private _initialized: boolean = false;

    private constructor(protected context: vscode.ExtensionContext) {
        this.snippetSvc = new SnippetSvc(this.context);
    }

    async initialize() {
        this._snippets = await this.snippetSvc.invokeSnippetAll(true);
    }

    static getInstance(context: vscode.ExtensionContext) {
        if (!JenkinsSnippet._instance) {
            JenkinsSnippet._instance = new JenkinsSnippet(context);
        }
        return JenkinsSnippet._instance;
    }

    get(snippetName: string): SnippetItem | undefined {
        return this._snippets ? this._snippets[snippetName] : undefined;
    }

    get snippets() {
        return this._snippets;
    }

    async getSnippets(): Promise<SnippetItem[]> {
        if (!this._initialized) {
            await this.initialize();
        }
        if (!this._snippets) {
            return [];
        }
        return Object.values(this._snippets);
    }

    public set initialized(value: boolean) {
        this._initialized = value;
    }

}

export type SnippetItems = {
    [key: string]: SnippetItem
};

export interface SnippetItem {
    prefix: string
    body: string[]
    description: string
    language?: string
    hidden?: boolean
    when?: string
    type?: string
}
