import _ from 'lodash';
import * as vscode from 'vscode';

export class JksshHoverProvider implements vscode.HoverProvider {

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w-]+/);
        if (!wordRange) {
            return;
        }

        const word = document.getText(wordRange);
        const hoverInfo: { [key: string]: KeywordInfo } = {
            'jenkins': {
                content: this.makeHelp(),
                description: '',
            },
            'createUser': {
                content: 'Create user\n' +
                    '\n---\n' +
                    '### create-user {username} {password}\n' +
                    '\n---\n' +
                    '* _username_: User Name\n' +
                    '* _password_: The password of the User\n' +
                    '\n---\n' +
                    '### snippet: user, cr',
                description: 'Creates a new user',
            },
            'deleteUser': {
                content: 'Delete user\n' +
                    '\n---\n' +
                    '### delete-user {username}\n' +
                    '\n---\n' +
                    '* _username_: User Name\n' +
                    '\n---\n' +
                    '### snippet: del',
                description: 'Deletes a user',
            },
            'createView': {
                content: 'Create view with regex setting\n' +
                    '\n---\n' +
                    '### create-view {viewname} [{regex}]\n' +
                    '\n---\n' +
                    '* _viewname_: View Name\n' +
                    '* _regex_: Reg Expression\n' +
                    '\n---\n' +
                    '### snippet: view, cr',
                description: 'Creates a new view.',
            },
            'deleteView': {
                content: 'Delete view with regex setting\n' +
                    '\n---\n' +
                    '### delete-view {viewname}\n' +
                    '\n---\n' +
                    '* _viewname_: View Name\n' +
                    '\n---\n' +
                    '### snippet: del',
                description: 'Deletes a view.',
            },
            'createViews': {
                content: 'Create multiple views with default settings\n' +
                    '\n---\n' +
                    '### create-views {viewname} [{viewname} {viewname}]\n' +
                    '\n---\n' +
                    '* _viewname_: View Name\n' +
                    '\n---\n' +
                    '### snippet: view, cr',
                description: 'Create multiple views with default settings',
            },
            'createPipeline': {
                content: 'Create pipeline\n' +
                    '\n---\n' +
                    '### create-pipeline {pipeline}\n' +
                    '\n---\n' +
                    '* _pipeline_: Pipeline Name\n' +
                    '\n---\n' +
                    '### snippet: cr, crp',
                description: 'Creates a new pipeline.',
            },
            'createFolder': {
                content: 'Create folder\n' +
                    '\n---\n' +
                    '### create-folder {folder}\n' +
                    '\n---\n' +
                    '* _folder_: Folder Name\n' +
                    '\n---\n' +
                    '### snippet: cr, crf',
                description: 'Creates a new folder.',
            },
            'createShortcut': {
                content: 'Create shortcut\n' +
                    '\n---\n' +
                    '### create-shortcut {shortcut}\n' +
                    '\n---\n' +
                    '* _shortcut_: Shortcut Name\n' +
                    '\n---\n' +
                    '### snippet: cr',
                description: 'Creates a new shortcut.',
            },
            'buildJob': {
                content: 'Build job\n' +
                    '\n---\n' +
                    '### build-job job/{job}\n' +
                    '\n---\n' +
                    '* _job_: Job Name\n' +
                    '\n---\n' +
                    '### snippet: cr, crp',
                description: 'Builds a job.',
            },
            'deleteJob': {
                content: 'Delete job\n' +
                    '\n---\n' +
                    '### delete-job {jobname} [{regex}]\n' +
                    '\n---\n' +
                    '* _jobname_: Job\n' +
                    '\n---\n' +
                    '### snippet: del',
                description: 'Deletes a job.',
            },
            'createSecretText': {
                content: 'Create secretText\n' +
                    '\n---\n' +
                    '### create-secret-text {username} {password}\n' +
                    '\n---\n' +
                    '* _username_: Username Name\n' +
                    '* _password_: The password of the User\n' +
                    '\n---\n' +
                    '### snippet: cr',
                description: 'Creates a credential secret text',
            },
            'createCredUser': {
                content: 'Create credential user\n' +
                    '\n---\n' +
                    '### create-cred-user {username} {password}\n' +
                    '\n---\n' +
                    '* _username_: Username Name\n' +
                    '* _password_: The password of the User\n' +
                    '\n---\n' +
                    '### snippet: cr',
                description: 'Creates a credential secret text',
            },
            'createGlobalVar': {
                content: 'Create global variable\n' +
                    '\n---\n' +
                    '### create-global-var {key} {value}\n' +
                    '\n---\n' +
                    '* _key_: The key of Global Variable \n' +
                    '* _password_: The password of the GlobalVar\n' +
                    '\n---\n' +
                    '### snippet: cr, gv, glv',
                description: 'Creates a new global variable',
            },
            'deleteGlobalVar': {
                content: 'Delete global variable\n' +
                    '\n---\n' +
                    '### delete-global-var {key}\n' +
                    '\n---\n' +
                    '* _key_: The key of Global Variable \n' +
                    '\n---\n' +
                    '### snippet: del, gv, glv',
                description: 'Deletes a global variable',
            },
            'getLogRotator': {
                content: 'Get Log Rotator\n' +
                    '\n---\n' +
                    '### get-log-rotator {jobName}\n' +
                    '\n---\n' +
                    '* _jobName_: Only Job Name\n' +
                    '\n---\n' +
                    '### snippet: log',
                description: 'Get count of the log Rotator',
            },
            'setLogRotator': {
                content: 'Set Log Rotator\n' +
                    '\n---\n' +
                    '### set-log-rotator {jobName} {maxCount}\n' +
                    '\n---\n' +
                    '* _jobName_: Only Job Name\n' +
                    '* _maxCount_: if not empty, only up to this number of build records are kept\n' +
                    '\n---\n' +
                    '### snippet: log',
                description: 'Set count of the log Rotator',
            },
            'deleteLogRotator': {
                content: 'Delete Log Rotator\n' +
                    '\n---\n' +
                    '### delete-log-rotator {jobName}\n' +
                    '\n---\n' +
                    '* _jobName_: Only Job Name\n' +
                    '\n---\n' +
                    '### snippet: log',
                description: 'Deletes a log Rotator',
            },
        };

        const keywordInfo = hoverInfo[_.camelCase(word)];
        if (keywordInfo) {
            const hoverContents = new vscode.MarkdownString(keywordInfo.content);
            return new vscode.Hover(hoverContents, wordRange);
        }

        return null;
    }

    makeHelp(): string {
        return `Jenkins: \n
---
Available Commands: \n
---
* create-user / delete-user
* create-view / delete-view
* build-job / create-pipeline / create-folder / create-shortcut / delete-job
* create-secret-text / create-cred-user
* create-global-var / delete-global-var
* get-log-rotator / set-log-rotator / delete-log-rotator
---
`;
    }

}

interface KeywordInfo {
    content: string;
    description: string;
}
