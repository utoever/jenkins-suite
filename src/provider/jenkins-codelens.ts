import * as vscode from 'vscode';
import { CodeLens, window } from 'vscode';

export class JenkinsCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public constructor(context: vscode.ExtensionContext) {
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
        if (document.languageId === 'jenkins') {
            const text = document.getText();

            if (text) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                if (text.startsWith('pipeline {')) {
                    const command = {
                        title: '▶ Validate Jenkinsfile',
                        command: 'utocode.validateJenkins',
                        arguments: []
                    };

                    const codeLens = new vscode.CodeLens(range, command);
                    return [codeLens];
                } else if (text.startsWith('#!jenkins') || text.startsWith('#! jenkins')) {
                    const command = {
                        title: '⚡️ Execute Script',
                        command: 'utocode.executeQuick',
                        arguments: []
                    };

                    const codeLens = new vscode.CodeLens(range, command);
                    return [codeLens];
                }
            }
        } else if (document.languageId === 'groovy') {
            const text = document.getText();

            if (text) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                if (text.startsWith('#!groovy')) {
                    const command = {
                        title: '⚡️ Execute Script',
                        command: 'utocode.executeQuick',
                        arguments: []
                    };

                    const codeLens = new vscode.CodeLens(range, command);
                    return [codeLens];
                }
            }
        }

        return [];
    }

}