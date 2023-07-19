import * as vscode from 'vscode';
import { Project, isJenkinsPipeline, isJenkinsView, parseXml } from '../utils/xml';

export class XmlCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public constructor(context: vscode.ExtensionContext) {
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
        if (document.languageId === 'xml') {
            const text = document.getText();
            const xmlData = parseXml(text);
            const isJob = this.isProject(xmlData);
            let isPipeline = false;
            if (!isJob) {
                isPipeline = isJenkinsPipeline(xmlData);
            }

            if (isJob || isPipeline) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                const command1 = {
                    title: '▶ Update Job',
                    command: 'utocode.updateConfigJob',
                    arguments: []
                };

                const command2 = {
                    title: '▶ Create Job',
                    command: 'utocode.createJob',
                    arguments: []
                };

                const codelens = [];
                codelens.push(new vscode.CodeLens(range, command1));
                codelens.push(new vscode.CodeLens(range, command2));

                if (isPipeline) {
                    const scriptPosition = text.indexOf('<script');
                    if (scriptPosition !== 0) {
                        const lineStartPosition = document.positionAt(scriptPosition);
                        const lineEndPosition = document.lineAt(lineStartPosition.line).range.end;

                        const range3 = new vscode.Range(lineStartPosition, new vscode.Position(lineStartPosition.line, lineStartPosition.character + 1));
                        const command3 = {
                            title: '▶ Validate Jenkinsfile',
                            command: 'utocode.validateJenkins',
                            arguments: []
                        };
                        codelens.push(new vscode.CodeLens(range3, command3));
                    }
                }
                return codelens;
            } else if (isJenkinsView(xmlData)) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                const command1 = {
                    title: '▶ Update View',
                    command: 'utocode.updateConfigView',
                    arguments: []
                };

                const command2 = {
                    title: '▶ Create View',
                    command: 'utocode.createView',
                    arguments: []
                };

                const codeLens1 = new vscode.CodeLens(range, command1);
                const codeLens2 = new vscode.CodeLens(range, command2);
                return [codeLens1, codeLens2];
            }
        }

        return [];
    }

    isProject(xmlData: any): xmlData is Project {
        return xmlData && typeof xmlData.project === 'object';
    }

}
