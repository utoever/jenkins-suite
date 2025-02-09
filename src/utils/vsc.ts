import * as vscode from 'vscode';
import { Constants } from '../svc/constants';
import { showInfoMessageWithTimeout } from '../ui/ui';

export function getMessageL10n(mesg: string, ...args: Array<string | number | boolean>) {
    let message = vscode.l10n.t(mesg);
    return message;
}

export function notifyMessageWithTimeout(message: string | undefined, timeout: number = 3000) {
    if (message) {
        // vscode.window.showInformationMessage(message);
        showInfoMessageWithTimeout(message, timeout);
    }
}

export function translateMessage(mesgKey: string) {
    const message = vscode.l10n.t(mesgKey);

    const message2 = vscode.l10n.t({
        message: mesgKey,
        args: ['Joey'],
        comment: ['{0} is a person\'s name']
    });
    vscode.window.showInformationMessage(message2);
}

export function showMessageWithTimeout(message: string, timeout: number = 2200) {
    const statusBarItem = vscode.window.setStatusBarMessage(message);

    setTimeout(() => {
        statusBarItem.dispose();
    }, timeout);
}

export function openSettings(kind?: string) {
    vscode.commands.executeCommand("workbench.action.openSettings", kind ? `jenkinssuite.${kind} ` : "jenkinssuite");
}

export function getExtensionSetting() {
    return getUserSetting(Constants.EXTENSION_NAME);
}

export function getUserSetting(section: string, resource?: vscode.Uri | null | undefined) {
    return vscode.workspace.getConfiguration(section, resource);
}

export function executeCommand(command: string, ...rest: any[]): Thenable<any> {
    return vscode.commands.executeCommand(command, ...rest);
}

export function onWillSaveTextDocument(listener: (e: vscode.TextDocumentWillSaveEvent) => any, thisArgs?: any) {
    return vscode.workspace.onWillSaveTextDocument(listener, thisArgs);
}

export function onDidSaveTextDocument(listener: (e: vscode.TextDocument) => any, thisArgs?: any) {
    return vscode.workspace.onDidSaveTextDocument(listener, thisArgs);
}

export function onDidOpenTextDocument(listener: (e: vscode.TextDocument) => any, thisArgs?: any) {
    return vscode.workspace.onDidOpenTextDocument(listener, thisArgs);
}

export function pathRelativeToWorkspace(localPath: string | vscode.Uri) {
    return vscode.workspace.asRelativePath(localPath);
}

export function getActiveTextEditor() {
    return vscode.window.activeTextEditor;
}

export function getWorkspaceFolders() {
    return vscode.workspace.workspaceFolders;
}

export function refreshExplorer() {
    return executeCommand('workbench.files.action.refreshFilesExplorer');
}

export function focusOpenEditors() {
    return executeCommand('workbench.files.action.focusOpenEditorsView');
}

export function showTextDocument(uri: vscode.Uri, option?: vscode.TextDocumentShowOptions) {
    return vscode.window.showTextDocument(uri, option);
}

export function diffFiles(leftFsPath: string, rightFsPath: string, title: string, option?: any) {
    const leftUri = vscode.Uri.file(leftFsPath);
    const rightUri = vscode.Uri.file(rightFsPath);

    return executeCommand('vscode.diff', leftUri, rightUri, title, option);
}

export function promptForPassword(prompt: string): Promise<string | undefined> {
    return vscode.window.showInputBox({
        ignoreFocusOut: true,
        password: true,
        prompt,
    }) as Promise<string | undefined>;
}

export function setContextValue(key: string, value: any, extName: string = 'jenkinssuite') {
    executeCommand('setContext', extName + '.' + key, value);
}

export function showErrorMessage(message: string, ...items: string[]) {
    return vscode.window.showErrorMessage(message, ...items);
}

export function showInformationMessage(message: string, ...items: string[]) {
    return vscode.window.showInformationMessage(message, ...items);
}

export function showWarningMessage(message: string, ...items: string[]) {
    return vscode.window.showWarningMessage(message, ...items);
}

export async function showConfirmMessage(message: string, confirmLabel: string = 'Yes', cancelLabel: string = 'No') {
    const result = await vscode.window.showInformationMessage(message,
        { title: confirmLabel },
        { title: cancelLabel }
    );

    return Boolean(result && result.title === confirmLabel);
}

export function showOpenDialog(options: vscode.OpenDialogOptions) {
    return vscode.window.showOpenDialog(options);
}

export function openFolder(uri?: vscode.Uri, newWindow?: boolean) {
    return executeCommand('vscode.openFolder', uri, newWindow);
}

export function registerCommand(context: vscode.ExtensionContext, name: string,
    callback: (...args: any[]) => any, thisArg?: any) {
    const disposable = vscode.commands.registerCommand(name, callback, thisArg);
    context.subscriptions.push(disposable);
}

export function addWorkspaceFolder(...workspaceFoldersToAdd: { uri: vscode.Uri; name?: string }[]) {
    return vscode.workspace.updateWorkspaceFolders(0, 0, ...workspaceFoldersToAdd);
}
