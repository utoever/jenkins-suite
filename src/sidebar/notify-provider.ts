import * as vscode from 'vscode';
import JenkinsConfiguration from '../config/settings';
import { CauseParameter, WsTalkMessage } from '../types/model';
import { getLocalDate } from '../utils/datetime';

export class NotifyProvider implements vscode.TreeDataProvider<WsTalkMessage> {

    private _notifies: WsTalkMessage[] = [];

    constructor(protected context: vscode.ExtensionContext) {
    }

    private _onDidChangeTreeData: vscode.EventEmitter<WsTalkMessage | undefined> = new vscode.EventEmitter<WsTalkMessage | undefined>();

    readonly onDidChangeTreeData: vscode.Event<WsTalkMessage | WsTalkMessage[] | undefined> = this._onDidChangeTreeData.event;

    async getTreeItem(element: WsTalkMessage): Promise<vscode.TreeItem> {
        console.log(`notify::treeItem <${element}>`);
        let treeItem: vscode.TreeItem;
        treeItem = {
            label: `[${getLocalDate(element.timestamp)}] ${element.job} #${element.number} (${element.duration})`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            // command: {
            //     command: 'utocode.showBuilds',
            //     title: 'Show Builds',
            //     arguments: [element]
            // },
            contextValue: 'notify',
            iconPath: this.context.asAbsolutePath(`resources/job/${element.iconColor.replace('_anime', '')}.png`),
            tooltip: this.getToolTip(element)
        };
        return treeItem;
    }

    getToolTip(element: WsTalkMessage) {
        // const paramAction: JobParameter[] | undefined = element.parameterAction?.parameters;
        // if (paramAction) {
        //     results.push('Parameters: ');
        //     paramAction.map(param => results.push(`  ${param.name}: [${param.value}]`));
        // }
        const builds: any | undefined = element.builds;
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`### Job: __${element.job}__\n`);
        text.appendMarkdown(`* number: _#${element.number}_\n`);
        text.appendMarkdown(`* duration: ${element.duration}\n`);
        text.appendMarkdown('\n---\n');

        text.appendMarkdown(`### Parameter: \n`);
        if (builds) {
            const entries = Object.entries(builds);
            for (let [key, val] of entries) {
                text.appendMarkdown(`* ${key}: [__${val}__]`);
            }
        } else {
            text.appendMarkdown('* __None__\n');
        }
        text.appendMarkdown('\n---\n');

        const causeAction: CauseParameter[] | undefined = element.causeAction.causes;
        if (causeAction) {
            text.appendMarkdown(`### Causes: \n`);
            for (let param of causeAction) {
                text.appendMarkdown(`* ${param.shortDescription}\n`);
            }
        }
        text.appendMarkdown('\n---\n');

        text.appendMarkdown(`**${getLocalDate(element.timestamp)}**\n`);
        return text;
    }

    async getChildren(element?: WsTalkMessage): Promise<WsTalkMessage[]> {
        console.log(`notify::children <${element}>`);
        return this._notifies;
    }

    insert(element: WsTalkMessage) {
        if (this._notifies.length >= JenkinsConfiguration.limitHistory) {
            this._notifies.pop();
        }
        this._notifies.unshift(element);
        this.refresh();
    }

    clear() {
        this._notifies = [];
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}
