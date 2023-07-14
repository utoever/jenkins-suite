import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function getSelectionText() {
    const editor = vscode.window.activeTextEditor;
    let content: string = '';
    if (editor) {
        const selection: vscode.Selection = editor.selection;
        if (selection.isEmpty) {
            content = editor.document.getText();
        } else {
            content = editor.document.getText(selection);
        }
    }
    return content;
}

export async function openEditorWithNew(languageId: string = 'xml') {
    const document = await vscode.workspace.openTextDocument({ content: '' });
    await vscode.languages.setTextDocumentLanguage(document, languageId);
    await vscode.window.showTextDocument(document);
    return vscode.window.activeTextEditor;
}

export async function openEditorWithNewOld(filename: string = 'untitled:Untitled', languageId: string = 'xml') {
    const baseUri = vscode.Uri.parse(filename + '-1');
    let uri = baseUri;
    let count = 1;
    let document: vscode.TextDocument;

    try {
        while (vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === uri.toString())) {
            count++;
            uri = baseUri.with({ path: `${filename.split(':')[1]}-${count}`, fragment: `${filename}-${count}` });
        }

        document = await vscode.workspace.openTextDocument(uri);
    } catch (error: any) {
        console.log(`Error <${error.message}>`);
        count++;
        uri = baseUri.with({ path: `${filename.split(':')[1]}-${count}`, fragment: `${filename}-${count}` });
        document = await vscode.workspace.openTextDocument(uri);
    }
    await vscode.languages.setTextDocumentLanguage(document, languageId);
    await vscode.window.showTextDocument(document);
    return vscode.window.activeTextEditor;
}

export async function getDocument(languageId: string = 'xml') {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const document = activeEditor.document;
        await vscode.languages.setTextDocumentLanguage(document, languageId);
        return document;
    }
    return null;
}

export async function printEditorWithNew(output: string | undefined, languageId: string = 'xml') {
    if (!output) {
        return;
    }

    const editor = await openEditorWithNew(languageId);
    if (editor) {
        editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.start, output);
        });
    } else {
        vscode.window.showErrorMessage("There is no Editor window. Create or open a file");
    }
}

export async function clearEditor() {
    await printEditor('', true);
}

export async function printEditor(output: string, redraw: boolean = false) {
    if (!output && !redraw) {
        return;
    }
    // console.log(output);
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        if (redraw) {
            const document = editor.document;
            const range = document.validateRange(new vscode.Range(0, 0, document.lineCount, 0));
            editor.edit((editBuilder) => {
                editBuilder.replace(new vscode.Selection(range.start, range.end), output);
            });
        } else {
            const currentPosition = editor.selection.start;
            editor.edit((editBuilder) => {
                editBuilder.insert(currentPosition, output);
            });
        }
    } else {
        vscode.window.showErrorMessage("There is no Editor window. Create or open a file");
    }
}

export async function closeActiveEditor() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const document = activeEditor.document;
        const edit = new vscode.WorkspaceEdit();
        edit.set(document.uri, [{ range: document.validateRange(new vscode.Range(0, 0, Infinity, Infinity)), newText: document.getText() }]);
        vscode.workspace.applyEdit(edit).then(() => {
            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        });
    }
}