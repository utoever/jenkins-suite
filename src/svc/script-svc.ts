import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import JenkinsConfiguration from '../config/settings';
import { notifyUIUserMessage, refreshView, showInfoMessageWithTimeout } from "../ui/ui";
import { getSelectionText, printEditor, printEditorWithNew, saveCurrentEditor } from "../utils/editor";
import logger from '../utils/logger';
import { JenkinsBatch } from './jenkins-batch';

export async function executeQuick(_executor: Executor) {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const document = activeEditor.document;
        const languageIds = document.languageId;
        // logger.debug(`language <${languageIds}>`);

        if (languageIds === 'jenkins' || languageIds === 'jkssh') {
            const text = getSelectionText();
            if (text.startsWith('#!jenkins')) {
                const jenkinsBatch = new JenkinsBatch(_executor!);
                await notifyUIUserMessage('Processing', false);
                const results = await jenkinsBatch.execute(text);

                const scriptNextWindowEnabled = JenkinsConfiguration.scriptNextWindowEnabled;
                if (scriptNextWindowEnabled) {
                    const columnCount = vscode.window.visibleTextEditors.length;
                    if (columnCount === 1) {
                        await vscode.commands.executeCommand('workbench.action.splitEditor');
                    } else if (columnCount === 2) {
                        await vscode.commands.executeCommand('workbench.action.focusNextGroup');
                    }
                    printEditorWithNew(results, languageIds);
                } else {
                    printEditor(results, true);
                }

                await refreshView('utocode.views.refresh');
                refreshView('utocode.jobs.refresh', 100);
            } else {
                await vscode.commands.executeCommand('utocode.validateJenkins');
            }
        } else if (languageIds === 'groovy') {
            await vscode.commands.executeCommand('utocode.executeScript');
        } else if (languageIds === 'xml') {
            await vscode.commands.executeCommand('utocode.withJob');
        } else {
            showInfoMessageWithTimeout(vscode.l10n.t('Language Mode {0}, {1}, {2} is supported. Try changing to a different mode', 'xml', 'jenkins', 'groovy'));
        }
    }
}

export async function executeScript(_executor: Executor) {
    const text = getSelectionText();
    if (!text) {
        showInfoMessageWithTimeout(vscode.l10n.t('Script is empty'));
        return;
    }

    try {
        const result = await _executor.executeScript(text);
        if (result) {
            logger.info(result);
            if (result === '') {
                showInfoMessageWithTimeout('Execute successfully', 5000);
            } else if (typeof result === 'object') {
                showInfoMessageWithTimeout(JSON.stringify(result));
            } else {
                showInfoMessageWithTimeout(result);
            }
        }
    } catch (error: any) {
        logger.error(error.message);
    }
}

export async function convertJksshAsJob(_executor: Executor) {
    const saved = saveCurrentEditor();
    let jobName = await vscode.window.showInputBox({
        title: 'Job Name',
        prompt: 'Enter job name'
    }).then((val) => {
        return val;
    });

    notifyUIUserMessage('Processing', false);
    const text = getSelectionText();
    if (jobName) {
        const suffix = JenkinsConfiguration.batchJobNameSuffix;
        if (!jobName.endsWith(suffix)) {
            jobName = jobName + suffix;
        }
        const result = await _executor.convertJksshAsJob(jobName, text);
        if (result) {
            showInfoMessageWithTimeout(result);
        }
    } else {
        showInfoMessageWithTimeout(vscode.l10n.t('Cancelled by User'));
    }
}

export async function deleteJobParam(_executor: Executor, jobName: string, paramName: string) {
    const result = await _executor.deleteJobParam(jobName, paramName);
    notifyUIUserMessage('Processing', false);
    if (result) {
        showInfoMessageWithTimeout(result);
    }
}