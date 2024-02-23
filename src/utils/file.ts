import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectModels } from '../types/model';

export function getTempFilePath(filename: string): string {
    let workspacePath = '';
    if (vscode.workspace.workspaceFolders?.length) {
        workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        workspacePath = path.normalize(workspacePath);
    }
    const tempDir = fs.mkdtempSync(path.join(workspacePath, 'temp'));
    return path.join(tempDir, filename);
}

export function writeFileSync(tempFilePath: string, content: string) {
    fs.writeFileSync(tempFilePath, content);
}

export function openAfterConfigXml(content: string) {
    const tempFilePath = getTempFilePath('config.xml');
    writeFileSync(tempFilePath, content);
    vscode.workspace.openTextDocument(tempFilePath).then((document) => {
        vscode.window.showTextDocument(document);
    });
}

export function appendPath(uri: vscode.Uri, pathSuffix: string): vscode.Uri {
    const pathPrefix = uri.path.endsWith("/") ? uri.path : `${uri.path}/`;
    const filePath = `${pathPrefix}${pathSuffix}`;

    return uri.with({
        path: filePath
    });
}

export async function uriExists(uri: vscode.Uri): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(uri);
        return true;
    } catch {
        return false;
    }
}

export async function readFileUriAsProject(uri: vscode.Uri): Promise<ProjectModels> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as ProjectModels;
}

export async function getConfigPath(uri: vscode.Uri): Promise<vscode.Uri> {
    if (await uriExists(appendPath(uri, ".jenkinsrc.json"))) {
        return appendPath(uri, ".jenkinsrc.json");
    }
    return uri;
}
