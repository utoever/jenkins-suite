import { log } from 'console';
import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { BuildStatus, JobsModel, ProjectModel, ProjectModels } from '../types/model';
import { openLinkBrowser, showInfoMessageWithTimeout } from '../ui/ui';
import logger from '../utils/logger';

export class ProjectProvider implements vscode.TreeDataProvider<ProjectModel | JobsModel | BuildStatus> {

    private _executor: Executor | undefined;

    private _projectModels: ProjectModels | undefined;

    private _currentServer: JenkinsServer | undefined;

    private readonly maxBuilds = 5;

    private _onDidChangeTreeData: vscode.EventEmitter<ProjectModel | JobsModel | BuildStatus | undefined> = new vscode.EventEmitter<ProjectModel | JobsModel | BuildStatus | undefined>();

    readonly onDidChangeTreeData: vscode.Event<ProjectModel | ProjectModel[] | JobsModel[] | JobsModel | BuildStatus[] | BuildStatus | undefined> = this._onDidChangeTreeData.event;

    constructor(protected context: vscode.ExtensionContext) {
        this.registerContext();
    }

    registerContext() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('utocode.project.refresh', () => {
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
                // console.log(`buildProjectJob <${mesg}>`);
                setTimeout(() => {
                    this.refresh();
                }, 3300);
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
            // tooltip: this.makeToolTip(element)
        };
    }

    makeJobTreeItem(element: JobsModel): vscode.TreeItem {
        return {
            label: element.fullName,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'project_job',
            iconPath: new vscode.ThemeIcon('symbol-enum'),
            // iconPath: this.context.asAbsolutePath(`resources/icons/${element.language ?? 'xml'}.svg`),
            // tooltip: this.makeToolTip(element)
        };
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
        return {
            label: element.name || '_EMPTY_',
            collapsibleState: this._executor ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            contextValue: 'project_srv' + (status === 'blue' ? '_conn' : ''),
            iconPath: this.context.asAbsolutePath(`resources/job/${status}.png`),
            // tooltip: this.makeToolTip(element)
        };
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
            const servers = JenkinsConfiguration.servers;
            return Object.values(this._projectModels).filter(projectModel => servers.has(projectModel.name!));
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

    public get projectModels(): ProjectModels | undefined {
        return this._projectModels;
    }

    public set projectModels(projectModels: ProjectModels) {
        this._projectModels = projectModels;
        this.refresh();
    }

    clear() {
        this._executor = undefined;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}

enum ProjectModelType {
    projectModel = 10,
    jobsModel = 20,
    // buildModel = 30,
    buildStatus = 40
}
