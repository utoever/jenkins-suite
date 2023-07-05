import { exec } from 'child_process';
import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import { WebSocketClient } from '../api/ws';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { JobsModel, ViewsModel } from '../types/model';
import { switchConnection } from '../ui/manage';
import { openLinkBrowser, showInfoMessageWithTimeout } from '../ui/ui';
import { getSelectionText } from '../utils/editor';
import logger from '../utils/logger';
import { openSettings } from '../utils/vsc';
import { BuildsProvider } from './builds-provider';
import { JobsProvider } from './jobs-provider';
import { NotifyProvider } from './notify-provider';
import { ReservationProvider } from './reservation-provider';
import { ViewsProvider } from './views-provider';

export class ConnectionProvider implements vscode.TreeDataProvider<JenkinsServer> {

    private _executor: Executor | undefined;

    private _wsClient: WebSocketClient | undefined;

    private _currentServer: JenkinsServer | undefined;

    private _primary: string;

    private _onDidChangeTreeData: vscode.EventEmitter<JenkinsServer | undefined> = new vscode.EventEmitter<JenkinsServer | undefined>();

    readonly onDidChangeTreeData: vscode.Event<JenkinsServer | JenkinsServer[] | undefined> = this._onDidChangeTreeData.event;

    constructor(protected context: vscode.ExtensionContext, private readonly viewsProvider: ViewsProvider, private readonly jobsProvider: JobsProvider, private readonly buildsProvider: BuildsProvider, private readonly reservationProvider: ReservationProvider, private readonly notifyProvider: NotifyProvider) {
        context.subscriptions.push(
            vscode.commands.registerCommand('utocode.restart', async () => {
                if (this._executor) {
                    this._executor.restart();
                    showInfoMessageWithTimeout('Restart', 20000);
                }
            }),
            vscode.commands.registerCommand('utocode.switchConnection', async () => {
                switchConnection(context, this);
            }),
            vscode.commands.registerCommand('utocode.connections.settings', () => {
                openSettings('server');
            }),
            vscode.commands.registerCommand('utocode.connections.refresh', () => {
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.openLink#Home', (server: JenkinsServer) => {
                openLinkBrowser(server.url);
            }),
            vscode.commands.registerCommand('utocode.openLink#git', (server: JenkinsServer) => {
                if (server.git) {
                    openLinkBrowser(server.git);
                }
            }),
            vscode.commands.registerCommand('utocode.openLink#sqube', (server: JenkinsServer) => {
                if (server.sonarqube) {
                    openLinkBrowser(server.sonarqube);
                }
            }),
            vscode.commands.registerCommand('utocode.openLink#sparrow', (server: JenkinsServer) => {
                if (server.sparrow) {
                    openLinkBrowser(server.sparrow);
                }
            }),
            vscode.commands.registerCommand('utocode.connectServer', (server: JenkinsServer) => {
                this.connect(server);
            }),
            vscode.commands.registerCommand('utocode.disconnectServer', (server: JenkinsServer) => {
                this.disconnect(server);
            }),
            vscode.commands.registerCommand('utocode.createUser', async () => {
                if (this._executor) {
                    const items: vscode.QuickPickItem[] = [
                        { label: 'USER', description: 'Create Dev User' },
                        { label: 'ADMIN', description: 'Create admin user' },
                        { label: 'GUEST', description: 'Create guest user' },
                    ];
                    const role = await vscode.window.showQuickPick(items, {
                        placeHolder: vscode.l10n.t("Select user type")
                    }).then(async (selectedItem) => {
                        return selectedItem && selectedItem.label;
                    });
                    const username = await vscode.window.showInputBox({ prompt: 'Enter username' }).then((val) => {
                        return val;
                    });
                    const password = await vscode.window.showInputBox({ prompt: 'Enter password' }).then((val) => {
                        return val;
                    });

                    if (role && username && password) {
                        const result = await this._executor.createUser(username, password, role);
                        showInfoMessageWithTimeout(vscode.l10n.t('Create User {0}', result === '' ? `<${username}>` : 'Failed'));
                    } else {
                        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    }
                }
            }),
            vscode.commands.registerCommand('utocode.changeExecutor', async (server: JenkinsServer) => {
                if (this._executor) {
                    const numExecutors = await this._executor.getExecutor();
                    const setNumExecutor = await vscode.window.showInputBox({
                        prompt: 'Enter number of Executor',
                        placeHolder: numExecutors
                    }).then((val) => {
                        return val;
                    });
                    if (setNumExecutor) {
                        const result = await this._executor.changeExecutor(setNumExecutor);
                        showInfoMessageWithTimeout(vscode.l10n.t('Number of Executor <{0}>', result));
                    } else {
                        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    }
                }
            }),
            vscode.commands.registerCommand('utocode.createCredential#SecretText', async (server: JenkinsServer) => {
                if (this._executor) {
                    const username = await vscode.window.showInputBox({ prompt: 'Enter username' }).then((val) => {
                        return val;
                    });
                    const password = await vscode.window.showInputBox({ prompt: 'Enter password' }).then((val) => {
                        return val;
                    });

                    if (username && password) {
                        const result = await this._executor.createCredential(username, password, 'SecretText');
                        showInfoMessageWithTimeout(vscode.l10n.t('Create Credential {0}', result === '' ? `<${username}>` : 'Failed'));
                    } else {
                        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    }
                }
            }),
            vscode.commands.registerCommand('utocode.createCredential#CredentialUser', async (server: JenkinsServer) => {
                if (this._executor) {
                    const username = await vscode.window.showInputBox({ prompt: 'Enter username' }).then((val) => {
                        return val;
                    });
                    const password = await vscode.window.showInputBox({ prompt: 'Enter password' }).then((val) => {
                        return val;
                    });

                    if (username && password) {
                        const result = await this._executor.createCredential(username, password, 'CredentialUser');
                        showInfoMessageWithTimeout(vscode.l10n.t('Create Credential {0}', result === '' ? `<${username}>` : 'Failed'));
                    } else {
                        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    }
                }
            }),
            vscode.commands.registerCommand('utocode.setPrimaryServer', (server: JenkinsServer) => {
                if (JenkinsConfiguration.primary !== server.name) {
                    JenkinsConfiguration.primary = server.name;
                    this._primary = server.name;
                }
            }),
            vscode.commands.registerCommand('utocode.connectSSH', (server: JenkinsServer) => {
                if (server.ssh && server.ssh.enabled) {
                    const terminal = vscode.window.createTerminal(server.name + ' terminal');
                    const port = server.ssh.port === 22 ? '' : ' -p ' + server.ssh.port;
                    const sshCommand = `ssh ${server.ssh.username}@${server.ssh.address}${port}`;
                    terminal.sendText(sshCommand);
                    terminal.show();
                } else {
                    showInfoMessageWithTimeout(vscode.l10n.t('SSH Server is not exist'));
                }
            }),
            vscode.commands.registerCommand('utocode.connectSSHExternal', (server: JenkinsServer) => {
                if (server.ssh && server.ssh.enabled) {
                    const program = server.ssh.externalPath ?? 'putty';
                    let portArg = server.ssh.externalArg ?? '-P';
                    if (!server.ssh.externalArg) {
                        if (program.endsWith('putty.exe')) {
                            portArg = '-P';
                        } else {
                            portArg = ':';
                        }
                    }
                    if (portArg.startsWith('-')) {
                        portArg = ` ${portArg} `;
                    }
                    const port = server.ssh.port === 22 ? '' : `${portArg}${server.ssh.port}`;
                    const execCmd = `${program} ${server.ssh.username}@${server.ssh.address}${port} ${server.ssh.extraArg ?? ''}`;
                    exec(execCmd, (error, stdout, stderr) => {
                        if (error) {
                            console.log(stderr);
                        }
                    });
                } else {
                    showInfoMessageWithTimeout(vscode.l10n.t('SSH Server Address is not exist'));
                }
            }),
            vscode.commands.registerCommand('utocode.views.refresh', () => {
                this.updateViewsProvider();
            }),
            vscode.commands.registerCommand('utocode.showJobs', (view: ViewsModel) => {
                viewsProvider.view = view;
                jobsProvider.view = view;
                const jobs: Partial<JobsModel> = {};
                buildsProvider.jobs = jobs as JobsModel;
            }),
            vscode.commands.registerCommand('utocode.openExternalBrowser', (job: JobsModel) => {
                openLinkBrowser(job.url);
            }),
            vscode.commands.registerCommand('utocode.executeScript', async () => {
                const text = getSelectionText();
                if (!text) {
                    showInfoMessageWithTimeout(vscode.l10n.t('Script is empty'));
                    return;
                }

                const result = await this._executor?.executeScript(text);
                if (result) {
                    if (result === '') {
                        showInfoMessageWithTimeout('Execute successfully', 5000);
                    } else {
                        showInfoMessageWithTimeout(result);
                    }
                    console.log(result);
                }
            }),
        );

        this._primary = JenkinsConfiguration.primary;
        if (this._primary) {
            const server = this.getServer(this._primary);
            this.connect(server);
        }
    }

    async getTreeItem(element: JenkinsServer): Promise<vscode.TreeItem> {
        console.log(`connection::treeItem <${element}>`);
        let status = 'grey';
        let authority = '';
        if (this._currentServer && this._currentServer.name === element.name) {
            if (this.isConnected()) {
                status = 'blue';
            } else {
                status = 'red';
            }
            if (this._currentServer?.admin) {
                authority = '_admin';
            }
        }

        let git = element.git ? '_git' : '';
        let sqube = element.sonarqube ? '_sqube' : '';
        let treeItem: vscode.TreeItem;
        treeItem = {
            label: element.name,
            description: element.description,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'connection' + (this._primary && this._primary === element.name ? '' : '_not') + authority + git + sqube,
            iconPath: this.context.asAbsolutePath(`resources/job/${status}.png`),
            tooltip: this.viewServer(element)
        };
        return treeItem;
    }

    viewServer(server: JenkinsServer) {
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`## Jenkins\n`);
        text.appendMarkdown(`_${server.description ?? ' '}_\n`);
        text.appendMarkdown('\n---\n');
        text.appendMarkdown(`* name: __${server.name}__\n`);
        text.appendMarkdown(`* user: **${server.username}**\n`);
        text.appendMarkdown(`* URL: *${server.url}*\n`);
        text.appendMarkdown('\n---\n');

        const wsStatus = vscode.Uri.file(this.context.asAbsolutePath(`resources/job/${server.wstalk?.enabled ? 'green' : 'grey'}_16.png`));
        text.appendMarkdown(`## WsTalk ![Server](${wsStatus})\n`);
        text.appendMarkdown(`${server.wstalk?.description ?? ' '}\n`);
        text.appendMarkdown('\n---\n');
        if (server.wstalk?.enabled) {
            text.appendMarkdown(`* URL: *${server.wstalk.url}*\n`);
        } else {
            text.appendMarkdown(`* ${server.wstalk?.enabled ? 'enabled' : 'disabled'}\n`);
        }
        text.appendMarkdown('\n---\n');

        const sshStatus = vscode.Uri.file(this.context.asAbsolutePath(`resources/job/${server.ssh?.enabled ? 'green' : 'grey'}_16.png`));
        text.appendMarkdown(`## SSH ![Server](${sshStatus})\n`);
        text.appendMarkdown('\n---\n');
        if (server.ssh?.enabled) {
            text.appendMarkdown(`* user: **${server.ssh.username}**\n`);
            text.appendMarkdown(`* address: **${server.ssh.address}**\n`);
            text.appendMarkdown(`* port: ${server.ssh.port}\n`);
        } else {
            text.appendMarkdown(`* ${server.ssh?.enabled ? 'enabled' : 'disabled'}\n`);
        }
        return text;
    }

    getChildren(element?: JenkinsServer): JenkinsServer[] {
        return this.getServers();
    }

    getServers = () => Array.from(JenkinsConfiguration.servers.values());

    getServer = (name: string): JenkinsServer => this.getServers().filter(it => name === it.name)[0];

    public async connect(server: JenkinsServer) {
        try {
            if (server === undefined) {
                return;
            }
            if (server.name === this._currentServer?.name) {
                showInfoMessageWithTimeout('You are already connected');
                return;
            }

            this._executor = new Executor(this.context, server);
            await this._executor.initialized();
            this._currentServer = server;
            console.log(`  * jenkins <${this._currentServer.name}> url <${server.url}>`);
        } catch (error: any) {
            logger.error(error.message);
            vscode.window.showErrorMessage(error.message);
            return;
        }

        try {
            if (server.wstalk && server.wstalk.enabled && server.wstalk.url) {
                this._wsClient = new WebSocketClient(server.wstalk.url, 15000, this.buildsProvider, this.notifyProvider);
                this._wsClient.connect();
            }
        } catch (error: any) {
            logger.error(error.message);
            vscode.window.showErrorMessage(error.message);
        }
        this.updateUI(true);
    }

    public async updateViewsProvider() {
        if (this._executor) {
            this.viewsProvider.info = await this._executor.getInfo();
            if (this._currentServer) {
                const isAdmin = await this._executor.isAdmin(this._currentServer.username);
                if (isAdmin) {
                    this._currentServer.admin = "Result: true" === isAdmin;
                    this.refresh();
                }
            }
        } else {
            this.viewsProvider.info = undefined;
        }
    }

    public updateUI(connected: boolean) {
        this.updateViewsProvider();
        if (!connected && this._wsClient) {
            this._wsClient?.disconnect();
            this.notifyProvider.clear();
        }
        this.viewsProvider.executor = this._executor;
        this.jobsProvider.executor = this._executor;
        this.buildsProvider.executor = this._executor;
        this.reservationProvider.executor = this._executor;

        if (connected) {
            showInfoMessageWithTimeout(vscode.l10n.t(`Connected Server <{0}>`, `${this._currentServer?.description ?? this._currentServer?.name}`));
        } else {
            const jobs: Partial<JobsModel> = {};
            this.buildsProvider.jobs = jobs as JobsModel;
            this.notifyProvider.clear();

            vscode.window.showInformationMessage(vscode.l10n.t(`Disconnected Server <{0}>`, `${this._currentServer?.name}`));
        }
        this.refresh();
    }

    public async disconnect(server: JenkinsServer): Promise<void> {
        let disconnected = false;
        const reservations = this.reservationProvider.reservationJobModel();
        if (reservations && reservations.length > 0) {
            await vscode.window.showInformationMessage(vscode.l10n.t(`There are {0} scheduled schedules. Do you still want to quit?`, reservations.length), 'Yes', 'No').then(answer => {
                if (answer === 'Yes') {
                    disconnected = true;
                }
            });
        } else {
            disconnected = true;
        }

        if (disconnected && server.name === this._currentServer?.name) {
            this._executor?.disconnect();
            this._executor = undefined;
            this.updateUI(false);
            this._currentServer = undefined;
        }
    }

    public changeServer(server: JenkinsServer) {
        if (server.name !== this._currentServer?.name) {
            if (this._currentServer) {
                this.disconnect(server);
            }
            this.connect(server);
        } else {
            this.refresh();
        }
    }

    public isConnected() {
        return this._executor?.initialized();
    }

    public get executor() {
        if (!this._executor) {
            showInfoMessageWithTimeout(vscode.l10n.t('Server is not connected'));
        }
        return this._executor;
    }

    public executeCommand(cmdName: string, ...params: any[]) {
        if (!this._executor) {
            throw new Error(`Jenkins is not connnected`);
        } else if (typeof this._executor[cmdName] !== 'function') {
            throw new Error(`command < ${cmdName}> is not function`);
        }

        if (this._executor && typeof this._executor[cmdName] === 'function') {
            return (this._executor[cmdName] as Function)(...params);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}
