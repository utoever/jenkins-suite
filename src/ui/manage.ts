import * as vscode from 'vscode';
import JenkinsConfiguration, { JenkinsServer } from "../config/settings";
import { ConnectionProvider } from '../provider/connection-provider';
import { JobsProvider } from '../provider/jobs-provider';
import { BallColor } from '../types/jenkins-types';
import { JobModelType, JobsModel, ModelQuickPick } from '../types/model';
import { showInfoMessageWithTimeout } from "./ui";

export async function switchConnection(context: vscode.ExtensionContext, connectionProvider: ConnectionProvider) {
    const servers = JenkinsConfiguration.servers;
    if (!servers) {
        showInfoMessageWithTimeout(vscode.l10n.t("Server is not exists"));
        return;
    }

    const items: ModelQuickPick<JenkinsServer>[] = [];
    for (const [name, server] of servers) {
        items.push({
            label: `$(device-desktop) ${name}`,
            detail: server.description,
            model: server
        });
    }

    await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t("Switch Server"),
        placeHolder: vscode.l10n.t("Select to switch server")
    }).then(async (selectedItem) => {
        if (selectedItem) {
            connectionProvider.connect(selectedItem.model!);
        }
    });
}

export async function runJobAll(jobsProvider: JobsProvider, includeJob: boolean = true) {
    const jobs = await jobsProvider.getJobsWithView();
    if (!jobs || jobs.length === 0) {
        showInfoMessageWithTimeout(vscode.l10n.t('Jobs is not exists'));
        return;
    }

    const items = getJobsAsModel(jobsProvider, jobs, includeJob);
    await vscode.window.showQuickPick(items, {
        title: vscode.l10n.t("Build Job"),
        placeHolder: vscode.l10n.t("Select the job you want to build"),
        canPickMany: false
    }).then(async (selectedItem) => {
        if (selectedItem) {
            vscode.commands.executeCommand('utocode.buildJob', selectedItem.model);
        }
    });
}

export async function getJobsAsModel(jobsProvider: JobsProvider, jobs: JobsModel[], includeJob: boolean = true): Promise<ModelQuickPick<JobsModel>[]> {
    const items: ModelQuickPick<JobsModel>[] = [];
    if (includeJob) {
        const jobTypes = [JobModelType.freeStyleProject.toString(), JobModelType.workflowJob.toString(), JobModelType.workflowMultiBranchProject.toString()];
        let idx = 0;
        for (const job of jobs) {
            if (!jobTypes.includes(job._class) || !job.jobDetail?.buildable) {
                continue;
            }
            if (idx % 5 === 0) {
                items.push({
                    label: '',
                    kind: vscode.QuickPickItemKind.Separator
                });
            }
            items.push({
                label: (job._class === JobModelType.freeStyleProject ? "$(terminal) " : "$(tasklist) ") + job.name,
                description: job.jobDetail?.description ? job.jobDetail?.description : job.jobDetail?.displayName,
                model: job
            });
            idx++;
        }
        items.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator
        });
    }

    for (const job of jobs) {
        if (job._class !== JobModelType.folder.toString()) {
            continue;
        }

        const folderJobsModel: JobsModel[] | undefined = await jobsProvider.getJobsWithFolder(job);
        if (folderJobsModel) {
            for (let folderJob of folderJobsModel) {
                items.push({
                    label: (folderJob._class === JobModelType.freeStyleProject ? "$(terminal) " : "$(tasklist) ") + folderJob.name,
                    description: folderJob.jobDetail?.description ? folderJob.jobDetail?.description : folderJob.name,
                    detail: `${job.name}`,
                    model: folderJob
                });
            }
        }
        items.push({
            label: '',
            kind: vscode.QuickPickItemKind.Separator
        });
    }

    return items;
}

export async function getFolderAsModel(jobs: JobsModel[], selectedJob: JobsModel): Promise<ModelQuickPick<JobsModel>[]> {
    const items: ModelQuickPick<JobsModel>[] = [];
    const jobTypes = [JobModelType.folder.toString()];
    const rootJob: JobsModel = {
        name: '',
        url: '',
        healthReport: [],
        color: BallColor.notbuilt,
        buildable: false,
        fullName: 'Jenkins',
        fullDisplayName: 'Jenkins',
        _class: ''
    };

    items.push({
        label: `$(root-folder-opened) Jenkins`,
        description: `${rootJob.fullName}`,
        model: rootJob
    });

    let idx = 1;
    for (const job of jobs) {
        if (!jobTypes.includes(job._class)) {
            continue;
        }
        if (selectedJob.name === job.name) {
            continue;
        }
        if (idx % 5 === 0) {
            items.push({
                label: '',
                kind: vscode.QuickPickItemKind.Separator
            });
        }
        items.push({
            label: (job._class === JobModelType.freeStyleProject ? "$(terminal) " : "$(folder) ") + job.name,
            description: job.jobDetail?.description ? job.jobDetail?.description : job.jobDetail?.displayName,
            model: job
        });
        idx++;
    }
    return items;
}
