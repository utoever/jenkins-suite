import * as vscode from 'vscode';

export class JenkinsCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public constructor(context: vscode.ExtensionContext) {
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
        if (document.languageId === 'jenkins' || document.languageId === 'jkssh') {
            const text = document.getText();

            if (text) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                if (text.startsWith('pipeline {')) {
                    const command1 = {
                        title: '$(check-all) Validate Jenkinsfile',
                        command: 'utocode.validateJenkins',
                        tooltip: 'Validate Jenkinsfile',
                        arguments: []
                    };

                    const command2 = {
                        title: '$(server-process) Convert Job',
                        command: 'utocode.convertPipelineJob',
                        tooltip: 'Convert Pipeline to Job',
                        arguments: []
                    };

                    const codeLens1 = new vscode.CodeLens(range, command1);
                    const codeLens2 = new vscode.CodeLens(range, command2);
                    return [codeLens1, codeLens2];
                } else if (text.startsWith('#!jenkins') || text.startsWith('#! jenkins')) {
                    const command1 = {
                        title: '$(run-all) Execute Script',
                        command: 'utocode.executeQuick',
                        tooltip: 'Execute Script',
                        arguments: []
                    };
                    const command2 = {
                        title: '$(server-process) Convert Job',
                        command: 'utocode.convertJksshAsJob',
                        tooltip: 'Convert Jenkins Shell to Job',
                        arguments: []
                    };

                    const codeLens1 = new vscode.CodeLens(range, command1);
                    const codeLens2 = new vscode.CodeLens(range, command2);
                    return [codeLens1, codeLens2];
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
                        tooltip: 'Execute Script',
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
