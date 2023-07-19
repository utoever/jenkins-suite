import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import JenkinsConfiguration from '../config/settings';
import { SnippetItem } from '../snippet/snippet';
import { Constants } from '../svc/constants';
import { executeQuick } from '../svc/script-svc';
import { SnippetSvc } from '../svc/snippet';
import { ParametersDefinitionProperty } from '../types/jenkins-types';
import buildJobModelType, { BaseJobModel, BuildStatus, BuildsModel, JobModelType, JobParamDefinition, JobsModel, ModelQuickPick, ViewsModel, WsTalkMessage } from '../types/model';
import { getJobParamDefinitions } from '../types/model-util';
import { getFolderAsModel, runJobAll } from '../ui/manage';
import { notifyUIUserMessage, openLinkBrowser, refreshView, showInfoMessageWithTimeout } from '../ui/ui';
import { clearEditor, getSelectionText, printEditor, printEditorWithNew } from '../utils/editor';
import logger from '../utils/logger';
import { getParameterDefinition, makeJobTreeItems } from '../utils/model-utils';
import { inferFileExtension } from '../utils/util';
import { notifyMessageWithTimeout, showErrorMessage } from '../utils/vsc';
import { FlowDefinition, parseXml } from '../utils/xml';
import { BuildsProvider } from './builds-provider';
import { ReservationProvider } from './reservation-provider';

export class JobsProvider implements vscode.TreeDataProvider<JobsModel> {

    private _view!: ViewsModel;

    private _executor: Executor | undefined;

    private snippetSvc: SnippetSvc;

    private _onDidChangeTreeData: vscode.EventEmitter<JobsModel | undefined> = new vscode.EventEmitter<JobsModel | undefined>();

    readonly onDidChangeTreeData: vscode.Event<JobsModel | JobsModel[] | undefined> = this._onDidChangeTreeData.event;

    constructor(protected context: vscode.ExtensionContext, private readonly buildsProvider: BuildsProvider, private readonly reservationProvider: ReservationProvider) {
        this.registerContext();
        this.snippetSvc = new SnippetSvc(this.context);
    }

    registerContext() {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('utocode.jobs.refresh', () => {
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.openLinkJob', (job: JobsModel) => {
                openLinkBrowser(job.url);
            }),
            vscode.commands.registerCommand('utocode.withJob', async () => {
                if (!this.executor?.initialized()) {
                    return;
                }

                const items: vscode.QuickPickItem[] = [
                    { label: 'Create', description: 'Create a job with a new name' },
                    { label: 'Update', description: 'Update the existing Job' },
                ];
                const jobCmd = await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Create or Update"),
                    placeHolder: vscode.l10n.t("Select the command you want to execute")
                }).then(async (selectedItem) => {
                    return selectedItem;
                });

                if (jobCmd) {
                    let cmd = jobCmd.label === 'Create' ? 'utocode.createJob' : 'utocode.updateConfigJob';
                    await vscode.commands.executeCommand(cmd);
                } else {
                    showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
                }
            }),
            vscode.commands.registerCommand('utocode.executeQuick', async () => {
                if (this._executor) {
                    executeQuick(this._executor);
                }
            }),
            vscode.commands.registerCommand('utocode.createJob', async () => {
                this.createJob();
            }),
            vscode.commands.registerCommand('utocode.createFolder', async () => {
                const mesg = await this.executor?.createFolder(undefined, this.view.name);
                setTimeout(() => {
                    this.refresh();
                }, Constants.JENKINS_DEFAULT_GROOVY_DELAY);
            }),
            vscode.commands.registerCommand('utocode.updateConfigJob', async () => {
                this.createJob(false);
            }),
            vscode.commands.registerCommand('utocode.getConfigJob', async (job: JobsModel, reuse: boolean = false) => {
                this.buildsProvider.jobs = job;
                const text = await this.executor?.getConfigJob(job);
                if (reuse) {
                    printEditor(text, reuse);
                } else {
                    printEditorWithNew(text);
                }
            }),
            vscode.commands.registerCommand('utocode.openLink#appHome', (job: JobsModel) => {
                this.openLinkHomeWithHidden(job, 'home.url');
            }),
            vscode.commands.registerCommand('utocode.openLink#manage', (job: JobsModel) => {
                this.openLinkHomeWithHidden(job, 'manage.url');
            }),
            vscode.commands.registerCommand('utocode.openLink#swagger', (job: JobsModel) => {
                this.openLinkHomeWithHidden(job, 'swagger.url');
            }),
            vscode.commands.registerCommand('utocode.generateJobCode', async () => {
                const items: vscode.QuickPickItem[] = [
                    { label: 'Pipeline_SCM', description: 'Generate Pipeline Job From SCM' },
                    { label: 'Pipeline', description: 'Generate Pipeline Job' },
                    { label: 'FreeStyle', description: 'Generate FreeStyle Job' },
                ];
                const result = await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Generate Job Code"),
                    placeHolder: vscode.l10n.t("Select to generate Job Code")
                }).then(async (selectedItem) => {
                    return selectedItem;
                });

                if (result) {
                    const snippetItem = await this.snippetSvc.invokeSnippet(`c_job_${result.label}`.toUpperCase());
                    printEditorWithNew(snippetItem.body.join('\n'));

                    setTimeout(() => {
                        showInfoMessageWithTimeout(vscode.l10n.t('If you want to modify the xml data and apply it to the server, run "Create Job" or "Update Config Job"'), 10000);
                    }, Constants.JENKINS_DEFAULT_GROOVY_DELAY);
                }
            }),
            vscode.commands.registerCommand('utocode.generateJobCodePick', async () => {
                const snippets = await this.snippetSvc.invokeSnippetAll(true);
                const items: ModelQuickPick<SnippetItem>[] = [];

                Object.keys(snippets).forEach((key: string) => {
                    const snippet = snippets[key];
                    items.push({
                        label: (snippet.type === Constants.SNIPPET_TYPE_SYSTEM ? '$(lightbulb) ' + Constants.SNIPPET_PREFIX_JENKINS : '$(edit) ' + Constants.SNIPPET_PREFIX_USER) + key,
                        description: snippet.description,
                        model: snippet
                    });
                });

                const item = await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Generate Custom Code"),
                    placeHolder: vscode.l10n.t("Select to generate Job Code")
                }).then(async (selectedItem) => {
                    return selectedItem;
                });

                if (item && item.model) {
                    printEditorWithNew(item.model.body.join('\n'), item.model.language);
                }
            }),
            vscode.commands.registerCommand('utocode.switchJob', async (job: JobsModel) => {
                const items = this.getJobsWithViewAsModel();

                await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Switch job"),
                    placeHolder: vscode.l10n.t("Select to switch only job")
                }).then(async (selectedItem) => {
                    if (selectedItem) {
                        this.buildsProvider.jobs = selectedItem.model!;
                    }
                });
            }),
            vscode.commands.registerCommand('utocode.addReservation', async (job: JobsModel) => {
                this.reservationProvider.addReservation(job);
            }),
            vscode.commands.registerCommand('utocode.runAddReservation', async () => {
                const items = this.getJobsWithViewAsModel();

                await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Reservation"),
                    placeHolder: vscode.l10n.t("Select to switch only job")
                }).then(async (selectedItem) => {
                    if (selectedItem) {
                        this.reservationProvider.addReservation(selectedItem.model!);
                    }
                });
            }),
            vscode.commands.registerCommand('utocode.runAddMultiReservation', async () => {
                const items = this.getJobsWithViewAsModel();

                await vscode.window.showQuickPick(items, {
                    title: vscode.l10n.t("Reservation"),
                    placeHolder: vscode.l10n.t("Select to switch only job"),
                    canPickMany: true
                }).then(async (selectedItems) => {
                    if (selectedItems) {
                        const delayInSeconds = JenkinsConfiguration.reservationDelaySeconds;
                        const delayStr = await vscode.window.showInputBox({
                            title: 'Delay Seconds',
                            prompt: 'Enter Delay Seconds',
                            value: delayInSeconds.toString()
                        });
                        if (!delayStr) {
                            return;
                        }
                        let delay;
                        try {
                            delay = Number.parseInt(delayStr);
                        } catch (error: any) {
                            delay = delayInSeconds;
                        }

                        let idx = 1;
                        for (let selectedItem of selectedItems) {
                            this.reservationProvider.registerReservation(selectedItem.model!, delay * idx);
                            idx += 1;
                        }
                    }
                });
            }),
            vscode.commands.registerCommand('utocode.buildJob', async (job: JobsModel) => {
                const mesg = await this.executor?.buildJobWithParameter(job, JenkinsConfiguration.buildDelay);
                // console.log(`buildJob <${mesg}>`);
                setTimeout(() => {
                    notifyMessageWithTimeout(mesg);
                    this.buildsProvider.jobs = job;
                }, Constants.JENKINS_DEFAULT_BUILD_DELAY);
            }),
            vscode.commands.registerCommand('utocode.deleteJob', async (job: JobsModel) => {
                let mesg = await this.executor?.deleteJob(job.url);
                // console.log(`deleteJob <${mesg}>`);
                if (mesg && !mesg.startsWith("Request failed")) {
                    mesg = `Success to delete job <${job.name}>`;
                }
                setTimeout(() => {
                    notifyMessageWithTimeout(mesg);
                    this.buildsProvider.jobs = undefined;
                    this.refresh();
                }, Constants.JENKINS_DEFAULT_GROOVY_DELAY);
            }),
            vscode.commands.registerCommand('utocode.copyUri', async (job: JobsModel) => {
                const uri = this.executor?.extractUrl(job.url);
                if (uri) {
                    vscode.env.clipboard.writeText(uri.substring(1));
                }
            }),
            vscode.commands.registerCommand('utocode.copyJob', async (job: JobsModel) => {
                const name = await vscode.window.showInputBox({
                    title: 'Copy Job',
                    prompt: 'Enter Job Name',
                    value: job.name + '-copy'
                });

                if (!name) {
                    return;
                } else if (name === job.name) {
                    showInfoMessageWithTimeout('Job name is equals');
                    return;
                }
                try {
                    const mesg = await this.executor?.copyJob(job, name);
                    this.refresh();
                } catch (error: any) {
                    showInfoMessageWithTimeout(error.message);
                    console.log(error.message);
                }
            }),
            vscode.commands.registerCommand('utocode.moveJob', async (job: JobsModel) => {
                const jobs = await this.getJobsWithView();
                if (!jobs || jobs.length === 0) {
                    showInfoMessageWithTimeout(vscode.l10n.t('Jobs is not exists'));
                    return;
                }

                const items = getFolderAsModel(jobs, job);
                let newJob = await vscode.window.showQuickPick(items, {
                    placeHolder: vscode.l10n.t("Select the job you want to build"),
                    canPickMany: false
                }).then(async (selectedItem) => {
                    return selectedItem ? selectedItem.model : undefined;
                });

                try {
                    if (newJob) {
                        const mesg = await this.executor?.moveJobUrl(job.url, newJob.name);
                        this.refresh();
                    }
                } catch (error: any) {
                    showInfoMessageWithTimeout(error.message);
                }
            }),
            vscode.commands.registerCommand('utocode.renameJob', async (job: JobsModel) => {
                const name = await vscode.window.showInputBox({
                    prompt: 'Enter Job Name',
                    value: job.name
                });
                if (!name || name === job.name) {
                    showInfoMessageWithTimeout('Job name is equals');
                    return;
                }

                try {
                    const mesg = await this.executor?.renameJobUrl(job.url, name);
                } catch (error: any) {
                    showInfoMessageWithTimeout(error.message);
                    console.log(error.message);
                }
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.enabledJob', async (job: JobsModel) => {
                const mesg = await this.executor?.enabledJob(job);
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.disabledJob', async (job: JobsModel) => {
                const mesg = await this.executor?.enabledJob(job, false);
                this.refresh();
            }),
            vscode.commands.registerCommand('utocode.runJob', async () => {
                runJobAll(this, true);
            }),
            vscode.commands.registerCommand('utocode.runFolderJob', async () => {
                runJobAll(this, false);
            }),
            vscode.commands.registerCommand('utocode.withJobLog', async (build: BuildStatus) => {
                openLinkBrowser(build.url + 'console');
            }),
            vscode.commands.registerCommand('utocode.viewJobConsole', async (message: WsTalkMessage) => {
                const text = await this.executor?.getJobLog(message.url, message.number);
                printEditorWithNew(text, 'shellscript');
            }),
            vscode.commands.registerCommand('utocode.openLinkNotifyJob', async (message: WsTalkMessage) => {
                openLinkBrowser(`${message.url}${message.number}/console`);
            }),
            vscode.commands.registerCommand('utocode.validateJenkins', async () => {
                let content = getSelectionText();

                if (inferFileExtension(content) === 'xml') {
                    const xmlData: FlowDefinition = parseXml(content);
                    const script = xmlData["flow-definition"].definition.script._text;
                    content = script;
                }

                const text = await this.executor?.validateJenkinsfile(content);
                // console.log(`text <${text}>`);
                if (!text) {
                    return;
                }
                if (text.startsWith('Jenkinsfile successfully validated')) {
                    showInfoMessageWithTimeout(vscode.l10n.t(text));
                } else {
                    logger.error(`validate <${text}>`);
                    showErrorMessage(text);
                }
            }),
        );
    }

    openLinkHomeWithHidden(job: JobsModel, target: string) {
        if (job.jobDetail) {
            const paramAction: JobParamDefinition[] | undefined = getJobParamDefinitions(job.jobDetail?.property);
            const hiddenParams = paramAction?.filter(param => param._class === ParametersDefinitionProperty.wHideParameterDefinition.toString());
            if (hiddenParams) {
                let url;
                for (let param of hiddenParams) {
                    if (param.name === target) {
                        url = param.defaultParameterValue.value;
                        break;
                    }
                }
                if (url) {
                    openLinkBrowser(url);
                }
            }
        }
    }

    async getJobsWithViewAsModel() {
        if (!this._executor) {
            return [];
        }

        const items: ModelQuickPick<JobsModel>[] = [];
        const viewname = this.view.name ?? (await this._executor.getInfo()).primaryView.name;
        let allViewModel = await this.executor?.getViewsWithDetail(viewname, true);
        if (allViewModel?.jobs) {
            allViewModel.jobs.filter(job => job.jobDetail?.buildable && job._class !== JobModelType.folder.toString()).forEach(job => {
                items.push({
                    label: (job._class === JobModelType.freeStyleProject ? "$(terminal) " : "$(tasklist) ") + job.name,
                    description: job.jobDetail?.description,
                    model: job
                });

                if (items.length % 5 === 0) {
                    items.push({
                        label: '',
                        kind: vscode.QuickPickItemKind.Separator
                    });
                }
            });
        }

        // let allViewModel;
        // if (this._view.name === 'all') {
        //     const views = (await this._executor.getInfo()).views;
        //     for (let view of views) {
        //         const viewModel = await this.executor?.getViewsWithDetail(view.name, true);
        //         if (!viewModel) {
        //             continue;
        //         }
        //         viewModel.jobs.filter(job => job._class !== JobModelType.folder.toString()).forEach(job => {
        //             items.push({
        //                 label: (job._class === JobModelType.freeStyleProject ? "$(terminal) " : "$(tasklist) ") + job.name,
        //                 detail: view.name === 'all' ? '' : view.name,
        //                 description: job.jobDetail?.description ?? job.description,
        //                 model: job
        //             });
        //         });
        //         items.push({
        //             label: '',
        //             kind: vscode.QuickPickItemKind.Separator
        //         });
        //     }
        // }

        return items;
    }

    async createJob(flag: boolean = true) {
        const text = getSelectionText();
        if (!text) {
            showInfoMessageWithTimeout(vscode.l10n.t('Job Data is not exist'));
            return;
        }

        if (flag) {
            const viewName = this.view?.name ?? 'all';
            notifyUIUserMessage();
            const mesg = await this.executor?.createJobInput(text, viewName);
            console.log(`result <${mesg}>`);
            clearEditor();
        } else {
            let jobs = this.buildsProvider.jobs;
            if (!jobs || !jobs?.name) {
                showInfoMessageWithTimeout(vscode.l10n.t('Please choose the job first'));
                return;
            }

            notifyUIUserMessage();
            const mesg = await this.executor?.updateJobConfig(jobs.name, text);
            console.log(`result <${mesg}>`);
            setTimeout(() => {
                vscode.commands.executeCommand('utocode.getConfigJob', jobs, true);
            }, Constants.JENKINS_DEFAULT_GROOVY_DELAY);
        }

        refreshView('utocode.jobs.refresh');
    }

    async getTreeItem(jobsModel: JobsModel): Promise<vscode.TreeItem> {
        // console.log(`jobs::treeItem <${element?.fullName ?? element?.name}>`);
        let treeItem: vscode.TreeItem;
        if (jobsModel && jobsModel.jobParam && jobsModel.level === 100) {
            const jobParam = jobsModel.jobParam;
            treeItem = {
                label: `${jobParam.name} [${jobParam.defaultParameterValue.value}]`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon(jobParam._class === ParametersDefinitionProperty.wHideParameterDefinition ? 'eye-closed' : 'file-code'),
                tooltip: this.getToolTipParams(jobsModel)
            };
        } else {
            treeItem = await makeJobTreeItems(jobsModel, this._executor!, this.context);
        }
        treeItem.command = {
            command: 'utocode.showBuilds',
            title: 'Show Builds',
            arguments: [jobsModel]
        };
        return treeItem;
    }

    async getChildren(element?: JobsModel): Promise<JobsModel[]> {
        if (!this._view || !this._executor) {
            return [];
        }

        if (element) {
            return this.getJobs(element);
        } else {
            const jobs = await this.getJobsWithView();
            return jobs;
        }
    }

    async getJobs(element: JobsModel): Promise<JobsModel[]> {
        let jobsModel: JobsModel[] = [];
        if (!this._executor) {
            return jobsModel;
        }

        let jobDetail: BuildsModel | undefined = await this.executor?.getJob(element);
        if (jobDetail && (element._class === JobModelType.folder || element._class === JobModelType.organizationFolder)) {
            jobsModel = await this.getJobsWithFolder(jobDetail);
            if (jobsModel) {
                jobsModel.forEach(jobs => {
                    if (!jobs.parents) {
                        jobs.parents = [];
                    }
                    jobs.parents.push(element);
                });
            }
        } else if (jobDetail) {
            const paramDefinition = getParameterDefinition(jobDetail);
            if (paramDefinition.length > 0) {
                const definitions: JobParamDefinition[] = paramDefinition[0].parameterDefinitions;
                for (let definition of definitions) {
                    const prop: JobsModel = {
                        level: 100,
                        jobParam: definition,
                        url: jobDetail.url,
                        color: jobDetail.color,
                        buildable: false,
                        fullName: jobDetail.name,
                        fullDisplayName: jobDetail.fullDisplayName,
                        healthReport: jobDetail.healthReport,
                        ...definition
                    };
                    jobsModel.push(prop);
                }
            }
        }
        return jobsModel;
    }

    public async getJobsWithFolder(folder: BaseJobModel): Promise<JobsModel[]> {
        if (!this._executor) {
            return [];
        }

        // const foldername = folder.fullName ?? folder.name;
        const allViewModel = await this.executor?.getJobAsView(folder);
        if (allViewModel) {
            for (let job of allViewModel.jobs) {
                // let jobDetail = await this._jenkins.getJob(job.name);
                job.jobDetail = await this.executor?.getJob(job);
            }
        }
        return allViewModel ? allViewModel.jobs : [];
    }

    public async getJobsWithView(): Promise<JobsModel[]> {
        if (!this._executor) {
            return [];
        }

        const allViewModel = await this.executor?.getViewsWithDetail(this._view ? this.view.name : 'all', true);
        return allViewModel ? allViewModel.jobs : [];
    }

    getToolTipParams(jobModel: JobsModel) {
        const jobParam = jobModel.jobParam!;
        const text = new vscode.MarkdownString();
        text.appendMarkdown(`### Job: \n`);
        text.appendMarkdown(`* name: ${jobModel.fullDisplayName ?? jobModel.fullName}\n`);
        text.appendMarkdown('\n---\n');

        text.appendMarkdown(`### Parameter: \n`);
        text.appendMarkdown(`* Type: _${jobParam.type.substring(0, jobParam.type.length - 'ParameterValue'.length)}_\n`);
        text.appendMarkdown(`* Default Value: *${jobParam.defaultParameterValue.value}*\n`);
        return text;
    }

    get view() {
        return this._view;
    }

    set view(view: ViewsModel) {
        this._view = view;
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

    clear() {
        this._executor = undefined;
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

}
