import { copyFile } from 'fs';
import * as vscode from 'vscode';
import { Project, isJenkinsPipeline, isJenkinsView, isProjectJob, parseXml, parseXmlData } from '../../utils/xml';

export class XmlCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public constructor(context: vscode.ExtensionContext) {
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken) {
        if (document.languageId === 'xml') {
            const text = document.getText();
            const xmlData = parseXmlData(text);
            const isJob = this.isProject(xmlData);
            let isPipeline = false;
            if (!isJob) {
                isPipeline = isJenkinsPipeline(xmlData);
            }

            if (isJob || isPipeline) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                const command1 = {
                    title: '$(edit) Update Job',
                    command: 'utocode.updateConfigJob',
                    arguments: []
                };

                const command2 = {
                    title: '$(repo) Create Job',
                    command: 'utocode.createJob',
                    arguments: []
                };

                const codelens = [];
                codelens.push(new vscode.CodeLens(range, command1));
                codelens.push(new vscode.CodeLens(range, command2));

                if (isPipeline) {
                    const scriptPosition = text.indexOf('<script>');
                    if (scriptPosition > 0) {
                        const lineStartPosition = document.positionAt(scriptPosition);
                        const lineEndPosition = document.lineAt(lineStartPosition.line).range.end;

                        const range3 = new vscode.Range(lineStartPosition, new vscode.Position(lineStartPosition.line, lineStartPosition.character + 1));
                        const command3 = {
                            title: '$(check-all) Validate Jenkinsfile',
                            command: 'utocode.validateJenkins',
                            arguments: []
                        };
                        codelens.push(new vscode.CodeLens(range3, command3));
                    }
                } else if (isProjectJob(xmlData)) {
                    const command = xmlData.project.builders?.['hudson.tasks.Shell'].command;
                    let range3: vscode.Range | undefined = undefined;
                    if (command.startsWith('#!groovy')) {
                        const scriptPosition = text.indexOf('#!groovy');
                        if (scriptPosition > 0) {
                            const lineStartPosition = document.positionAt(scriptPosition);
                            // const endPosition = document.positionAt(text.indexOf('</command>'));
                            // const lineEndPosition = document.lineAt(endPosition.line - 1).range.end;

                            range3 = new vscode.Range(lineStartPosition, new vscode.Position(lineStartPosition.line, lineStartPosition.character + 1));
                            const command3 = {
                                title: '$(run-all) Execute Script',
                                command: 'utocode.executeScript',
                                tooltip: 'Execute Script',
                                arguments: [command]
                            };
                            codelens.push(new vscode.CodeLens(range3, command3));
                        }
                    } else {
                        const scriptPosition = text.indexOf('<command>');
                        if (scriptPosition > 0) {
                            const lineStartPosition = document.positionAt(scriptPosition);
                            range3 = new vscode.Range(lineStartPosition, new vscode.Position(lineStartPosition.line, lineStartPosition.character + 1));
                        }
                    }

                    if (range3) {
                        const command4 = {
                            title: '$(copy) Copy Script',
                            command: 'utocode.copyScript',
                            tooltip: 'Copy Script',
                            arguments: [command]
                        };
                        codelens.push(new vscode.CodeLens(range3, command4));

                        const lang = command.split('\n')[0];
                        let languageId = lang.startsWith('#!') ? lang.substring(2) : 'shellscript';
                        if (languageId === 'jenkins') {
                            languageId = 'jkssh';
                        }

                        const command5 = {
                            title: '$(comment-discussion) Copy With New Editor',
                            command: 'utocode.copyWithNewEditor',
                            tooltip: 'Copy & Paste After open new Editor',
                            arguments: [command, languageId]
                        };
                        codelens.push(new vscode.CodeLens(range3, command5));
                    }
                }
                return codelens;
            } else if (isJenkinsView(xmlData)) {
                const position = new vscode.Position(0, 0);
                const range = new vscode.Range(position, position);
                const command1 = {
                    title: '$(replace-all) Update View',
                    command: 'utocode.updateConfigView',
                    arguments: []
                };

                const command2 = {
                    title: '$(repo) Create View',
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
