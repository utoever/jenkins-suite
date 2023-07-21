import { log } from 'console';
import path from 'path';
import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { Constants } from '../svc/constants';
import { JenkinsShell } from '../svc/jenkins-shell';
import { SnippetSvc } from '../svc/snippet';
import { BuildStatus, JobsModel, ProjectModel, ProjectModels } from '../types/model';
import { openLinkBrowser, showInfoMessageWithTimeout } from '../ui/ui';
import { getConfigPath, readFileUriAsProject, writeFileSync } from '../utils/file';
import logger from '../utils/logger';
import { ProjectJob, parseXmlData } from '../utils/xml';

export class ProjectProvider implements vscode.TreeDataProvider<ProjectModel | JobsModel | BuildStatus> {

    private _executor: Executor | undefined;

    private _projectModels: ProjectModels | undefined;

    private _currentServer: JenkinsServer | undefined;

    private snippetSvc: SnippetSvc;

    private readonly maxBuilds = 5;

    private _onDidChangeTreeData: vscode.EventEmitter<ProjectModel | JobsModel | BuildStatus | undefined> = new vscode.EventEmitter<ProjectModel | JobsModel | BuildStatus | undefined>();

    readonly onDidChangeTreeData: vscode.Event<ProjectModel | ProjectModel[] | JobsModel[] | JobsModel | BuildStatus[] | BuildStatus | undefined> = this._onDidChangeTreeData.event;

    constructor(protected context: vscode.ExtensionContext) {
        this.registerContext();
        this.snippetSvc = new SnippetSvc(this.context);
    }

    async registerContext() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('utocode.project.settings', async () => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                let rootDir;

                if (workspaceFolders && workspaceFolders.length > 1) {
                    const items: vscode.QuickPickItem[] = [];
                    workspaceFolders.forEach(folder => {
                        items.push(
                            { label: folder.name, description: folder.uri.path }
                        );
                    });
                    rootDir = await vscode.window.showQuickPick(items, {
                        placeHolder: vscode.l10n.t("Select to view")
                    }).then(async (selectedItem) => {
                        return selectedItem?.description;
                    });
                } else if (workspaceFolders && workspaceFolders.length === 1) {
                    rootDir = workspaceFolders[0].uri.fsPath;
                } else {
                    showInfoMessageWithTimeout('Project Folder is not exist');
                }

                if (!rootDir) {
                    return;
                }

                const filePath = vscode.Uri.file(path.join(rootDir, '.jenkinsrc.json'));
                try {
                    await vscode.workspace.fs.stat(filePath);
                } catch (error) {
                    const snippetItem = await this.snippetSvc.invokeSnippet('C_SETTING_JENKINSRC');
                    writeFileSync(filePath.fsPath, snippetItem.body.join('\n'));
                }
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);
            }),
            vscode.commands.registerCommand('utocode.project.refresh', async () => {
                this._projectModels = await this.getProjectSettings();
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.connectProjectServer', (projectModel: ProjectModel) => {
                this.connect(projectModel);
            }),
            vscode.commands.registerCommand('utocode.disconnectProjectServer', (projectModel: ProjectModel) => {
                this.disconnect(projectModel);
            }),
            vscode.commands.registerCommand('utocode.buildProjectJob', async (job: JobsModel) => {
                const mesg = await this.executor?.buildJobWithParameter(job, JenkinsConfiguration.buildDelay);
                setTimeout(() => {
                    this.refresh();
                }, Constants.JENKINS_DEFAULT_BUILD_DELAY);
            }),
            vscode.commands.registerCommand('utocode.buildProjectAll', async (projectModel: ProjectModel) => {
                let buildProject = projectModel.buildProject;
                if (buildProject) {
                    const jksShell = new JenkinsShell(this._executor!);
                    const suffix = JenkinsConfiguration.batchJobNameSuffix;
                    if (buildProject.length === 1 && buildProject[0].split(' ')[1].endsWith(suffix)) {
                        const cmds = buildProject[0].split(' ');
                        const text = await this.executor?.getConfigJobUri(cmds[1]);
                        const xmlData = parseXmlData(text) as ProjectJob;
                        const commands = xmlData.project.builders?.['hudson.tasks.Shell'];
                        buildProject = commands.command.split('\n');
                    }
                    const result = await jksShell.execute(buildProject);
                    // logger.info(`Result:::\n${result}`);
                }
            }),
            vscode.commands.registerCommand('utocode.openLink#projectServer', (projectModel: ProjectModel) => {
                openLinkBrowser(projectModel.server!.url);
            }),
            vscode.commands.registerCommand('utocode.openLink#projectJob', (job: JobsModel) => {
                openLinkBrowser(job.url);
            }),
            vscode.commands.registerCommand('utocode.openLink#projectBuild', (build: BuildStatus) => {
                openLinkBrowser(build.url + 'console');
            }),
        );
    }

    async getTreeItem(element: ProjectModel | JobsModel | BuildStatus): Promise<vscode.TreeItem> {
        // console.log(`jobs::treeItem <${element?.fullName ?? element?.name}>`);
        const projectType = this.getModelType(element);
        let treeItem: vscode.TreeItem;
        if (projectType === ProjectModelType.projectModel) {
            treeItem = this.makeProjectTreeItem(element as ProjectModel);
        } else if (projectType === ProjectModelType.buildStatus) {
            treeItem = this.makeBuildTreeItem(element as BuildStatus);
        } else {
            treeItem = this.makeJobTreeItem(element as JobsModel);
        }
        return treeItem;
    }

    makeBuildTreeItem(element: BuildStatus): vscode.TreeItem {
        return {
            label: '' + element.number,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'project_build',
            iconPath: new vscode.ThemeIcon('output'),
            tooltip: this.makeBuildToolTip(element)
        };
    }

    makeBuildToolTip(buildStatus: BuildStatus): string | vscode.MarkdownString | undefined {
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`## Status\n`);
        text.appendMarkdown(`* number: ${buildStatus.number}\n`);
        text.appendMarkdown('\n---\n');

        text.appendMarkdown(`*${buildStatus.url}*\n`);
        return text;
    }

    makeJobTreeItem(element: JobsModel): vscode.TreeItem {
        return {
            label: element.fullName,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'project_job',
            iconPath: new vscode.ThemeIcon('symbol-enum'),
            tooltip: this.makeJobToolTip(element)
        };
    }

    makeJobToolTip(jobModel: JobsModel): string | vscode.MarkdownString | undefined {
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`## Job\n`);
        text.appendMarkdown(`* name: ${jobModel.fullDisplayName ?? jobModel.fullName}\n`);
        text.appendMarkdown('\n---\n');

        text.appendMarkdown(`### Parameter: \n`);
        if (jobModel.jobParam) {
            const jobParam = jobModel.jobParam;
            text.appendMarkdown(`* Type: _${jobParam.type.substring(0, jobParam.type.length - 'ParameterValue'.length)}_\n`);
            text.appendMarkdown(`* Default Value: *${jobParam.defaultParameterValue.value}*\n`);
        } else {
            text.appendMarkdown('* __None__\n');
        }
        text.appendMarkdown('\n---\n');
        text.appendMarkdown(`*${jobModel.url}*\n`);
        return text;
    }

    makeProjectTreeItem(element: ProjectModel): vscode.TreeItem {
        let status = 'grey';
        if (this._currentServer && this._currentServer.name === element.name) {
            if (this.executor) {
                status = 'blue';
            } else {
                status = 'red';
            }
        }

        const batchCmd = this._projectModels && element && this._projectModels[element.name!].buildProject;
        return {
            label: element.name || '_EMPTY_',
            collapsibleState: this._executor ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            contextValue: 'project_srv' + (status === 'blue' ? '_conn' : '') + (batchCmd ? '_batch' : ''),
            iconPath: this.context.asAbsolutePath(`resources/job/${status}.png`),
            tooltip: this.makeProjectToolTip(element)
        };
    }

    makeProjectToolTip(projectModel: ProjectModel): string | vscode.MarkdownString | undefined {
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`## Server\n`);

        text.appendMarkdown(`_${projectModel.description ?? projectModel.server?.name}_\n`);
        text.appendMarkdown('\n---\n');
        text.appendMarkdown(`* name: __${projectModel.name}__\n`);
        text.appendMarkdown(`* URL: *${projectModel.server!.url}*\n`);

        text.appendMarkdown('\n---\n');
        text.appendMarkdown(`## Project:\n`);
        if (projectModel.buildProject) {
            projectModel.buildProject.forEach(cmd => {
                text.appendMarkdown(`* ${cmd}\n`);
            });
        } else {
            text.appendMarkdown('* None\n');
        }
        return text;
    }

    getModelType(target: ProjectModel | JobsModel | BuildStatus): ProjectModelType {
        const modelType = (target as ProjectModel).applications !== undefined ? ProjectModelType.projectModel :
            (target as BuildStatus).number !== undefined ? ProjectModelType.buildStatus :
                ProjectModelType.jobsModel;
        return modelType;
    }

    async getChildren(element?: ProjectModel | JobsModel | BuildStatus): Promise<ProjectModel[] | JobsModel[] | BuildStatus[]> {
        if (!this._projectModels) {
            return [];
        }

        if (element) {
            if (!this._executor) {
                return [];
            }

            const projectType = this.getModelType(element);
            if (projectType === ProjectModelType.projectModel) {
                const projectModel = element as ProjectModel;
                const jobsModels: JobsModel[] = [];
                for (let job of projectModel.applications) {
                    try {
                        const jobModel = await this.getJobsAll(job);
                        if (jobModel) {
                            jobsModels.push(jobModel);
                        }
                    } catch (error: any) {
                        console.log(error.message + `\nOccur Error: job <${job}>`);
                        logger.error(error.message);
                    }
                }
                return jobsModels;
            } else {
                const jobModel = element as JobsModel;
                const buildModel = await this._executor.getJob(jobModel);
                let builds = buildModel.builds;
                if (builds && builds.length > this.maxBuilds) {
                    builds = builds.slice(0, this.maxBuilds);
                }
                return builds;
            }
        } else {
            Object.entries<ProjectModel>(this._projectModels).forEach(([key, projectModel]) => {
                projectModel.name = key;
            });
            // const servers = JenkinsConfiguration.servers;
            return Object.values(this._projectModels); // .filter(projectModel => servers.has(projectModel.name!));
        }
    }

    public async getJobsAll(uri: string): Promise<JobsModel | undefined> {
        const jobDetail = await this.executor?.getJobFromProject(uri);
        if (jobDetail) {
            const jobs: JobsModel = jobDetail as JobsModel;
            jobs.jobDetail = jobDetail;
        }
        return jobDetail;
    }

    public async getJobsWithDetail(uri: string): Promise<JobsModel[]> {
        const allViewModel = await this.executor?.getJobAsViewFromProject(uri);
        if (allViewModel) {
            for (let job of allViewModel.jobs) {
                job.jobDetail = await this.executor?.getJob(job);
            }
        }
        return allViewModel ? allViewModel.jobs : [];
    }

    public async connect(projectModel: ProjectModel) {
        try {
            if (projectModel === undefined || projectModel.server === undefined) {
                return;
            }
            if (projectModel.server.name === this._currentServer?.name) {
                showInfoMessageWithTimeout('You are already connected');
                return;
            }

            this._executor = new Executor(this.context, projectModel.server);
            await this._executor.initialized();
            this._currentServer = projectModel.server;
            console.log(`  * jenkins <${this._currentServer.name}> url <${projectModel.server.url}>`);
        } catch (error: any) {
            logger.error(error.message);
            vscode.window.showErrorMessage(error.message);
        }
        this.refresh();
    }

    public async disconnect(projectModel: ProjectModel) {
        this._executor?.disconnect();
        this.executor = undefined;
        this._currentServer = undefined;
    }

    async getProjectSettings(): Promise<ProjectModels> {
        if (!vscode.workspace.workspaceFolders) {
            return {};
        }

        let allProjectModels: ProjectModels = {};
        try {
            const servers = JenkinsConfiguration.servers;
            for (const folder of vscode.workspace.workspaceFolders) {
                const jenkinsrcPath = await getConfigPath(folder.uri);
                if (jenkinsrcPath.fsPath !== folder.uri.fsPath) {
                    const projectModels = await readFileUriAsProject(jenkinsrcPath);
                    if (projectModels && servers) {
                        Object.entries<ProjectModel>(projectModels).forEach(([key, projectModel]) => {
                            const server = servers.get(key);
                            if (!server) {
                                return;
                            }
                            projectModel.server = server;
                            if (allProjectModels[key]) {
                                const modelKey = key + '-' + folder.name;
                                projectModel.name = modelKey;
                                allProjectModels[modelKey] = projectModel;
                            } else {
                                allProjectModels[key] = projectModel;
                            }
                        });
                        // allProjectModels = { ...allProjectModels, ...projectModels };
                    }
                }
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(vscode.l10n.t("Error while retrieving .jenkinsrc.json"));
            console.log(error.message);
        }
        return allProjectModels;
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

    clear() {
        this._executor = undefined;
        this.refresh();
    }

    async refresh(): Promise<void> {
        this._projectModels = await this.getProjectSettings();
        this._onDidChangeTreeData.fire(undefined);
    }

}

enum ProjectModelType {
    projectModel = 10,
    jobsModel = 20,
    // buildModel = 30,
    buildStatus = 40
}
