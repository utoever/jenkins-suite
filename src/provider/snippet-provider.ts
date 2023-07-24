import * as vscode from 'vscode';
import JenkinsConfiguration from '../config/settings';
import { Constants } from '../svc/constants';
import JenkinsSnippet, { SnippetItem } from '../svc/jenkins-snippet';
import { showInfoMessageWithTimeout } from '../ui/ui';
import { printEditorWithNew } from '../utils/editor';
import { openSettings } from '../utils/vsc';

export class SnippetProvider implements vscode.TreeDataProvider<SnippetItem> {

    private readonly jenkinsSnippet: JenkinsSnippet;

    constructor(protected context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('utocode.snippets.settings', () => {
                openSettings('snippet');
            }),
            vscode.commands.registerCommand('utocode.snippets.refresh', () => {
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.generateCode', (snippetItem: SnippetItem) => {
                this.generateCode(snippetItem);
            }),
        );
        this.jenkinsSnippet = JenkinsSnippet.getInstance(context);
    }

    private _onDidChangeTreeData: vscode.EventEmitter<SnippetItem | undefined> = new vscode.EventEmitter<SnippetItem | undefined>();

    readonly onDidChangeTreeData: vscode.Event<SnippetItem | SnippetItem[] | undefined> = this._onDidChangeTreeData.event;

    async getTreeItem(element: SnippetItem): Promise<vscode.TreeItem> {
        const iconPath = element.type && element.type === 'system' ? new vscode.ThemeIcon('symbol-enum') : this.context.asAbsolutePath(`resources/icons/${element.language ?? 'xml'}.svg`);
        const label = this.getLabel(element);
        let treeItem: vscode.TreeItem;
        treeItem = {
            label: label,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            // command: {
            //     command: 'utocode.generateCode',
            //     title: 'Generate Code',
            //     arguments: [element]
            // },
            contextValue: 'snippet',
            iconPath: iconPath,
            tooltip: this.makeToolTip(element)
        };
        return treeItem;
    }

    getLabel(element: SnippetItem) {
        return (element.type === Constants.SNIPPET_TYPE_SYSTEM ? Constants.SNIPPET_PREFIX_JENKINS : Constants.SNIPPET_PREFIX_USER) + element.prefix.toUpperCase();
    }

    async getChildren(element?: SnippetItem): Promise<SnippetItem[]> {
        if (!this.jenkinsSnippet) {
            return [];
        }

        const items = await this.jenkinsSnippet.getSnippets();
        return items.filter(item => {
            const when = item.when ? JenkinsConfiguration.getPropertyAsBoolean(item.when) : true;
            const flag = item.hidden ? !item.hidden : true;
            return when && flag;
        });
    }

    generateCode(snippetItem: SnippetItem) {
        const text = snippetItem.body.join('\n');
        printEditorWithNew(text, snippetItem.language);
        if (snippetItem.language === 'jenkins') {
            showInfoMessageWithTimeout(vscode.l10n.t('To test the pipeline, run validateJenkins (Ctrl+Alt+t)'));
        }
    }

    makeToolTip(snippetItem: SnippetItem) {
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`## * _${snippetItem.description ?? ' '}_\n`);
        if (snippetItem.type !== 'system') {
            text.appendMarkdown(`* Language: **${snippetItem.language ?? '-'}**\n`);
        }
        text.appendMarkdown('\n---\n');

        text.appendMarkdown('```' + snippetItem.language + '\n');
        const items = snippetItem.body.map(item => {
            text.appendMarkdown(`${item}\n`);
        });
        text.appendMarkdown('```\n');

        return text;
    }

    refresh(): void {
        this.jenkinsSnippet.initialized = false;
        this._onDidChangeTreeData.fire(undefined);
    }

}
