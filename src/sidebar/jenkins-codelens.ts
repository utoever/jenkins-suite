import * as vscode from 'vscode';
import { CodeLens, window } from 'vscode';

export class JenkinsCodeLensProvider implements vscode.CodeLensProvider {

    public constructor(context: vscode.ExtensionContext) {
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
        if (document.languageId === 'jenkins') {
            const text = document.getText();

            if (text.includes('pipeline {')) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                const command = {
                    title: '▶ Validate Jenkinsfile',
                    command: 'utocode.validateJenkins',
                    arguments: []
                };

                const codeLens = new vscode.CodeLens(range, command);
                return [codeLens];
            }
        }

        return [];
    }

}