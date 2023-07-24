import { exec } from 'child_process';
import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import { WebSocketClient } from '../api/ws';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { executeScript } from '../svc/script-svc';
import { JenkinsUser, JobsModel, ViewsModel } from '../types/model';
import { switchConnection } from '../ui/manage';
import { openLinkBrowser, showInfoMessageWithTimeout } from '../ui/ui';
import { getSelectionText, openEditorWithNew, printEditorWithNew } from '../utils/editor';
import logger from '../utils/logger';
import { openSettings } from '../utils/vsc';
import { BuildsProvider } from './builds-provider';
import { JobsProvider } from './jobs-provider';
import { NotifyProvider } from './notify-provider';
import { ReservationProvider } from './reservation-provider';
import { ViewsProvider } from './views-provider';

export class ConnectionProvider implements vscode.TreeDataProvider<JenkinsServer | JenkinsUser> {

    private _executor: Executor | undefined;

    private _wsClient: WebSocketClient | undefined;

    private _currentServer: JenkinsServer | undefined;

    private _primary: string;

    private _onDidChangeTreeData: vscode.EventEmitter<JenkinsServer | JenkinsUser | undefined> = new vscode.EventEmitter<JenkinsServer | JenkinsUser | undefined>();

    readonly onDidChangeTreeData: vscode.Event<JenkinsServer | JenkinsServer[] | JenkinsUser | JenkinsUser[] | undefined> = this._onDidChangeTreeData.event;

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
            vscode.commands.registerCommand('utocode.connections.question', () => {
                openLinkBrowser('https://jenkinssuite.github.io');
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
            vscode.commands.registerCommand('utocode.openLinkUserConfigure', (server: JenkinsServer) => {
                const uri = `${server.url}/user/${server.username}/configure`;
                openLinkBrowser(uri);
            }),
            vscode.commands.registerCommand('utocode.createUser', async () => {
                if (this._executor) {
                    const items: vscode.QuickPickItem[] = [
                        { label: 'USER', description: 'Create Dev User' },
                        { label: 'ADMIN', description: 'Create Admin User' },
                        { label: 'GUEST', description: 'Create Guest User' },
                    ];
                    const role = await vscode.window.showQuickPick(items, {
                        title: vscode.l10n.t("User Type"),
                        placeHolder: vscode.l10n.t("Select User Type")
                    }).then(async (selectedItem) => {
                        return selectedItem && selectedItem.label;
                    });
                    if (!role) {
                        return;
                    }
                    const users = await vscode.window.showInputBox({
                        title: 'User',
                        prompt: 'Enter username'
                    }).then(async (username) => {
                        if (username) {
                            const password = await vscode.window.showInputBox({
                                title: 'User',
                                prompt: 'Enter password'
                            }).then((val) => {
                                return val;
                            });
                            if (password) {
                                return [username, password];
                            }
                            return undefined;
                        }
                        return undefined;
                    });

                    if (role && users && users.length === 2) {
                        const result = await this._executor.createUser(users[0], users[1], role);
                        if (result) {
                            showInfoMessageWithTimeout(vscode.l10n.t('Create User {0}', result ? `<${users[0]}>` : 'Failed'));
                        }
                        this.refresh();
                    } else {
                        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                    }
                }
            }),
            vscode.commands.registerCommand('utocode.changeExecutor', async (server: JenkinsServer) => {
                if (this._executor) {
                    const numExecutors = await this._executor.getExecutor();
                    const setNumExecutor = await vscode.window.showInputBox({
                        title: 'Executor',
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
                    const username = await vscode.window.showInputBox({
                        title: 'User',
                        prompt: 'Enter username'
                    }).then((val) => {
                        return val;
                    });
                    const password = await vscode.window.showInputBox({
                        title: 'User',
                        prompt: 'Enter password'
                    }).then((val) => {
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
            vscode.commands.registerCommand('utocode.setSystemMessage', async () => {
                if (this._executor) {
                    const previous = await this._executor.getSystemMessage();
                    await vscode.window.showInputBox({
                        title: 'System message',
                        prompt: 'Enter system message',
                        value: previous
                    }).then(async (val) => {
                        if (val) {
                            await this._executor!.setSystemMessage(val);
                        }
                    });
                }
            }),
            vscode.commands.registerCommand('utocode.setPrimaryServer', (server: JenkinsServer) => {
                if (JenkinsConfiguration.primary !== server.name) {
                    JenkinsConfiguration.primary = server.name;
                    this._primary = server.name;
                }
            }),
            vscode.commands.registerCommand('utocode.deleteUser', async (user: JenkinsUser) => {
                if (user.delete) {
                    const result = await this._executor?.deleteUser(user.name);
                    if (result) {
                        showInfoMessageWithTimeout(vscode.l10n.t(result ? 'Successfully' : 'failed'));
                    }
                    this.refresh();
                }
            }),
            vscode.commands.registerCommand('utocode.openLink#user', async (user: JenkinsUser) => {
                if (user) {
                    const uri = `${this._currentServer?.url}/user/${user.name}/configure`;
                    openLinkBrowser(uri);
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
            vscode.commands.registerCommand('utocode.executeScript', async (text: string) => {
                if (this._executor) {
                    executeScript(this._executor, text);
                }
            }),
            vscode.commands.registerCommand('utocode.copyScript', async (text: string) => {
                vscode.env.clipboard.writeText(text);
                showInfoMessageWithTimeout('Copied Script to the clipboard');
            }),
            vscode.commands.registerCommand('utocode.copyWithNewEditor', async (text: string, languageId: string) => {
                printEditorWithNew(text, languageId);
            }),
        );

        this._primary = JenkinsConfiguration.primary;
        if (this._primary) {
            const server = this.getServer(this._primary);
            this.connect(server);
        }
    }

    async getTreeItem(element: JenkinsServer | JenkinsUser): Promise<vscode.TreeItem> {
        console.log(`connection::treeItem <${element}>`);
        let treeItem: vscode.TreeItem;
        if (this.isJenkinsUser(element)) {
            const user = element as JenkinsUser;
            treeItem = {
                label: user.name,
                description: user.description ?? '',
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextValue: 'user' + (user.delete ? '' : '_not'),
                iconPath: new vscode.ThemeIcon('account'),
                tooltip: user.name
            };
        } else {
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
            treeItem = {
                label: element.name,
                description: element.description,
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextValue: 'connection' + (this._primary && this._primary === element.name ? '' : '_not') + authority + git + sqube + (status === 'blue' ? '_conn' : ''),
                iconPath: this.context.asAbsolutePath(`resources/job/${status}.png`),
                tooltip: this.viewServer(element)
            };
        }
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

    async getChildren(element?: JenkinsServer): Promise<JenkinsServer[] | JenkinsUser[]> {
        if (element) {
            if (this._executor && element.name === this._currentServer?.name) {
                const users = await this._executor?.getUsers();
                return users ? Object.values(users) : [];
            } else {
                return [];
            }
        } else {
            return this.getServers();
        }
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
            logger.info(`* Connected <${this._currentServer.name}> url <${server.url}>`);
        } catch (error: any) {
            logger.error(error.message);
            vscode.window.showErrorMessage(vscode.l10n.t('The connection to the {0} server failed', server.name));
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
                    this._currentServer.admin = 'Result: true' === isAdmin;
                    this.refresh();
                }
            }
        } else {
            this.viewsProvider.info = undefined;
        }
    }

    public async updateUI(connected: boolean) {
        await this.updateViewsProvider();
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
            await this.updateUI(false);
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

    isJenkinsServer(element: any): element is JenkinsServer {
        return element && (typeof element.name === 'string');
    }

    isJenkinsUser(element: any): element is JenkinsUser {
        return element && (typeof element.delete === 'boolean');
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
