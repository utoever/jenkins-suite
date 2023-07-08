import path from 'path';
import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import { ViewType } from '../types/jenkins-types';
import { JenkinsInfo, ModelQuickPick, ViewsModel } from '../types/model';
import { openLinkBrowser, showInfoMessageWithTimeout } from '../ui/ui';
import { getSelectionText, printEditor, printEditorWithNew } from '../utils/editor';
import logger from '../utils/logger';
import { extractViewnameFromText } from '../utils/xml';
import { JobsProvider } from './jobs-provider';

export class ViewsProvider implements vscode.TreeDataProvider<ViewsModel> {

    private _info: JenkinsInfo | undefined;

    private _executor: Executor | undefined;

    private _view!: ViewsModel;

    constructor(protected context: vscode.ExtensionContext, private readonly jobsProvider: JobsProvider) {
        context.subscriptions.push(
            vscode.commands.registerCommand('utocode.reloadWebview', (view: ViewsModel) => {
                logger.debug(view.name);
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.switchView', async () => {
                this.switchView();
            }),
            vscode.commands.registerCommand('utocode.openLinkView', (view: ViewsModel) => {
                openLinkBrowser(view.url);
            }),
            vscode.commands.registerCommand('utocode.createView', async () => {
                const mesg = await this.executor?.createView();
                setTimeout(() => {
                    vscode.commands.executeCommand('utocode.views.refresh');
                }, 2000);
            }),
            vscode.commands.registerCommand('utocode.updateConfigView', async () => {
                const text = getSelectionText();
                if (text) {
                    showInfoMessageWithTimeout('Processing', 1500);
                    printEditor(' ', true);

                    const viewname = extractViewnameFromText(text);
                    this.updateUIView(viewname, text);
                } else {
                    showInfoMessageWithTimeout(vscode.l10n.t('Please There is not exist contents of the view'));
                }
            }),
            vscode.commands.registerCommand('utocode.getConfigView', async (view: ViewsModel, reuse: boolean = false) => {
                this.changeView(view);
                const text = await this.executor?.getConfigView(view.name);
                if (reuse) {
                    printEditor(text, reuse);
                } else {
                    printEditorWithNew(text);
                }
            }),
            vscode.commands.registerCommand('utocode.renameView', async (view: ViewsModel) => {
                if (!this._executor || !this._executor?.isConnected()) {
                    vscode.window.showErrorMessage('Jenkins server is not connected');
                    return;
                }

                const newViewname = await vscode.window.showInputBox({
                    prompt: 'Enter view name',
                    placeHolder: view.name
                }).then((val) => {
                    return val;
                });
                if (!newViewname) {
                    showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    return;
                }

                this.renameView(view.name, newViewname);
            }),
            vscode.commands.registerCommand('utocode.withView', async () => {
                if (!this._executor || !this._executor?.isConnected()) {
                    vscode.window.showErrorMessage('Jenkins server is not connected');
                    return;
                }

                const items: vscode.QuickPickItem[] = [
                    { label: 'Update', description: 'Update the existing view' },
                    { label: 'Create', description: 'Create a view with a new name' },
                ];
                const viewCmd = await vscode.window.showQuickPick(items, {
                    placeHolder: vscode.l10n.t("Select to run view")
                }).then(async (selectedItem) => {
                    return selectedItem;
                });

                if (viewCmd) {
                    const cmd = viewCmd.label === 'Create' ? 'createView' : 'updateConfigView';
                    await vscode.commands.executeCommand('utocode.' + cmd);
                } else {
                    showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                }
            }),
        );
    }

    async updateUIView(viewname: string, text: string) {
        const mesg = await this.executor?.updateConfigView(viewname, text);
        // console.log(`result <${mesg}>`);
        setTimeout(async () => {
            if (viewname === this.jobsProvider.view.name) {
                vscode.commands.executeCommand('utocode.jobs.refresh');
            }
            vscode.commands.executeCommand('utocode.getConfigView', this._view, true);
        }, 2000);
    }

    async renameView(viewname: string, newViewName: string) {
        const result = await this.executor?.renameView(viewname, newViewName);
        setTimeout(() => {
            this.refresh();
            if (viewname === this.jobsProvider.view.name) {
                this.jobsProvider.view.name = newViewName;
                this.jobsProvider.refresh();
            }
        }, 2000);
    }

    async switchView() {
        const views = this.info?.views;
        if (!views) {
            showInfoMessageWithTimeout(vscode.l10n.t('View is not exists'));
            return;
        }

        const items: ModelQuickPick<ViewsModel>[] = [];
        views.forEach(view => {
            let icon = this.getViewIcon(view._class);
            if (this._view && this._view.name === view.name) {
                icon = 'eye';
            }
            items.push({
                label: `$(${icon}) ${view.name}`,
                description: view._class.split('.').pop(),
                model: view
            });
        });

        await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t("Select to switch view")
        }).then(async (selectedItem) => {
            if (selectedItem) {
                this.changeView(selectedItem.model!);
            }
        });
    }

    private _onDidChangeTreeData: vscode.EventEmitter<ViewsModel | undefined> = new vscode.EventEmitter<ViewsModel | undefined>();

    readonly onDidChangeTreeData: vscode.Event<ViewsModel | ViewsModel[] | undefined> = this._onDidChangeTreeData.event;

    changeView(view: ViewsModel) {
        this.view = view;
        this.jobsProvider.view = view;
    }

    getViewIcon(name: string) {
        let icon = 'root-folder';
        if (name === ViewType.categorizedJobsView.toString()) {
            icon = 'search';
        } else if (name === ViewType.myView.toString()) {
            icon = 'heart';
        }
        return icon;
    }

    getTreeItem(element: ViewsModel): vscode.TreeItem {
        let icon = this.getViewIcon(element._class);
        if (element.name === this._view?.name) {
            icon = 'eye'; // 'root-folder-opened';
        }

        let treeItem: vscode.TreeItem;
        treeItem = {
            label: element.name,
            description: element.description,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'utocode.showJobs',
                title: 'Show Jobs',
                arguments: [element]
            },
            contextValue: 'views' + (this._info?.primaryView.name === element.name ? '' : '_enabled'),
            iconPath: new vscode.ThemeIcon(icon),
            tooltip: this.makeToolTip(element)
        };
        return treeItem;
    }

    makeToolTip(viewModel: ViewsModel) {
        const text = new vscode.MarkdownString();

        text.appendMarkdown(`## ${viewModel.name}\n`);
        text.appendMarkdown(`* Type: _${viewModel._class.split('.').pop()}_\n`);
        text.appendMarkdown('\n---\n');
        if (viewModel.description) {
            text.appendMarkdown(`** Description:** ${viewModel.description}\n`);
            text.appendMarkdown('\n---\n');
        }

        text.appendMarkdown(`* ${viewModel.url} *\n`);
        return text;
    }

    getChildren(element?: ViewsModel | undefined): vscode.ProviderResult<ViewsModel[]> {
        if (element || !this.info) {
            return Promise.resolve([]);
        } else {
            return this.info.views;
        }
    }

    public get info(): JenkinsInfo | undefined {
        return this._info;
    }

    public set info(info: JenkinsInfo | undefined) {
        this._info = info;
        if (info) {
            this.changeView(this._info?.primaryView!);
        }
        this.refresh();
    }

    public get executor() {
        if (!this._executor) {
            showInfoMessageWithTimeout(vscode.l10n.t('Server is not connected'));
        }
        return this._executor;
    }

    public set executor(executor: Executor | undefined) {
        this._executor = executor;
        this.refresh();
    }

    set view(view: ViewsModel) {
        this._view = view;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}
