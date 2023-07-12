import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import { DefinitionPropertyType, ParametersDefinitionProperty } from '../types/jenkins-types';
import buildJobModelType, { BuildsModel, JobModelType, JobParamDefinition, JobProperty, JobsModel } from "../types/model";
import { getJobParamDefinitions } from '../types/model-util';
import { ShortcutJob, parseXml } from './xml';

export function getParameterDefinition(build: BuildsModel | undefined): JobProperty[] {
    if (build) {
        return build.property.filter(val => val._class === DefinitionPropertyType.parametersDefinitionProperty.toString());
    } else {
        return [];
    }
}

export function getIconPathByClass(classname: string) {
    let iconPath: string | vscode.ThemeIcon;
    if (classname === JobModelType.workflowMultiBranchProject) {
        iconPath = new vscode.ThemeIcon('symbol-enum');
    } else if (buildJobModelType.includes(classname)) {
        iconPath = new vscode.ThemeIcon('file-code');
    } else if (classname === JobModelType.folder || classname === JobModelType.organizationFolder) {
        iconPath = new vscode.ThemeIcon('folder');
    } else if (classname === JobModelType.shortcutJob) {
        iconPath = new vscode.ThemeIcon('link');
    } else if (classname === JobModelType.externalJob) {
        iconPath = new vscode.ThemeIcon('live-share');
    } else {
        iconPath = new vscode.ThemeIcon('output');
    }
    return iconPath;
}

export async function makeJobTreeItems(jobsModel: JobsModel, executor: Executor, context: vscode.ExtensionContext) {
    let treeItem: vscode.TreeItem;
    let jobDetail: BuildsModel | undefined = jobsModel.jobDetail;
    if (jobsModel._class === JobModelType.workflowMultiBranchProject) {
        treeItem = {
            label: jobsModel.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'jobs',
            iconPath: new vscode.ThemeIcon('symbol-enum'),
            tooltip: jobsModel.jobDetail?.description ?? jobsModel.name
        };
    } else if (buildJobModelType.includes(jobsModel._class)) {
        let status = 'grey';
        let paramAction;
        if (jobDetail) {
            if (jobDetail.buildable) {
                status = jobsModel._class === JobModelType.workflowJob ? 'green' : 'blue';
            }
            paramAction = getJobParamDefinitions(jobDetail.property);
        }
        let cntParam = paramAction ? paramAction.length : 0;
        const hiddenParams = paramAction && paramAction.filter(param => param._class === ParametersDefinitionProperty.wHideParameterDefinition.toString());
        const ctx = [];
        if (hiddenParams) {
            for (let param of hiddenParams) {
                if (param.name.endsWith('.url')) {
                    ctx.push('_' + param.name.split('.url')[0]);
                }
            }
        }

        treeItem = {
            label: jobsModel.name,
            collapsibleState: cntParam === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: (jobDetail?.buildable ? 'jobs' : 'jobs_disabled') + ctx.join(''),
            // iconPath: new vscode.ThemeIcon('output-view-icon'),
            iconPath: context.asAbsolutePath(`resources/job/${status}.png`),
            tooltip: makeToolTipJob(jobsModel)
        };
    } else if (jobsModel._class === JobModelType.folder || jobsModel._class === JobModelType.organizationFolder) {
        treeItem = {
            label: `<${jobsModel.jobDetail?.jobs.length}> ${jobsModel.name}`,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'jobs_folder',
            iconPath: new vscode.ThemeIcon('folder'),
            tooltip: makeToolTipFolder(jobsModel)
        };
    } else if (jobsModel._class === JobModelType.shortcutJob) {
        const detail = await executor.getConfigJob(jobsModel);
        const xmlData: ShortcutJob = parseXml(detail);
        treeItem = {
            label: jobsModel.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'jobs_no',
            iconPath: new vscode.ThemeIcon('link'),
            tooltip: makeToolTipShortcut(xmlData)
        };
    } else if (jobsModel._class === JobModelType.externalJob) {
        treeItem = {
            label: jobsModel.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            contextValue: 'jobs_no',
            iconPath: new vscode.ThemeIcon('live-share'),
            tooltip: jobsModel.jobDetail?.description ?? jobsModel.name
        };
    } else {
        treeItem = {
            label: jobsModel.name,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: jobDetail?.buildable ? 'jobs' : 'jobs_disabled',
            // iconPath: new vscode.ThemeIcon('output-view-icon'),
            iconPath: context.asAbsolutePath(`resources/job/${jobsModel.color}.png`),
            tooltip: jobsModel.jobDetail?.description ?? jobsModel.name
        };
    }
    return treeItem;
}

export function makeToolTipJob(jobModel: JobsModel) {
    const jobDetail: BuildsModel = jobModel.jobDetail!;
    const paramAction: JobParamDefinition[] | undefined = getJobParamDefinitions(jobDetail.property);
    const text = new vscode.MarkdownString();
    text.appendMarkdown(`### Job: \n`);
    text.appendMarkdown(`* name: ${jobModel.name}\n`);
    text.appendMarkdown(`* buildable: ${jobModel.jobDetail?.buildable}\n`);
    const hiddenParams = paramAction?.filter(param => param._class === ParametersDefinitionProperty.wHideParameterDefinition.toString());
    if (hiddenParams) {
        for (let param of hiddenParams) {
            text.appendMarkdown(`* ${param.name} (${param.defaultParameterValue.value}) \n`);
        }
    }
    text.appendMarkdown('\n---\n');

    text.appendMarkdown(`### Parameters: \n`);
    const usedParams = paramAction?.filter(param => param._class !== ParametersDefinitionProperty.wHideParameterDefinition.toString());
    if (usedParams && usedParams.length > 0) {
        for (let param of usedParams) {
            text.appendMarkdown(`* ${param.name} (${param.defaultParameterValue.value}) \n`);
        }
    } else {
        text.appendMarkdown('* __None__\n');
    }

    text.appendMarkdown('\n---\n');
    text.appendMarkdown('### Summary: \n');
    text.appendMarkdown(`${jobDetail.description ? jobDetail.description : jobDetail.fullDisplayName}\n`);
    text.appendMarkdown('\n---\n');

    text.appendMarkdown(`${jobModel.url}\n`);
    return text;
}

export function makeToolTipShortcut(xmlData: ShortcutJob) {
    const text = new vscode.MarkdownString();
    text.appendMarkdown(`### URL: \n`);
    text.appendMarkdown(`${xmlData['com.legrig.jenkins.shortcut.ShortcutJob'].targetUrl._text}\n`);
    return text;
}

export function makeToolTipFolder(jobModel: JobsModel) {
    const jobDetail: BuildsModel = jobModel.jobDetail!;
    const text = new vscode.MarkdownString();
    text.appendMarkdown('### Summary: \n');
    text.appendMarkdown(`${jobDetail.displayName ?? jobDetail.fullDisplayName}\n`);
    text.appendMarkdown('\n---\n');

    text.appendMarkdown(`### Jobs: \n`);
    if (jobDetail.jobs && jobDetail.jobs.length > 0) {
        for (let folderJob of jobDetail.jobs) {
            text.appendMarkdown(`* ${folderJob.name}: ${folderJob.color}\n`);
        }
    } else {
        text.appendMarkdown('* __None__\n');
    }
    text.appendMarkdown('\n---\n');

    text.appendMarkdown(`*${jobModel.url}*\n`);
    return text;
}
