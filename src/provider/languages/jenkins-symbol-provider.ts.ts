import * as vscode from 'vscode';

export class JenkinsPipelineSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];

        const text = document.getText();
        const lines = text.split(/\r?\n/);

        const pipelineRegex = /pipeline\s*{/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = pipelineRegex.exec(line);
            if (match) {
                const startLine = i;
                const endLine = this.findClosingBrace(lines, i);

                const range = new vscode.Range(
                    new vscode.Position(startLine, 0),
                    new vscode.Position(endLine, lines[endLine].length)
                );

                const symbol = new vscode.DocumentSymbol(
                    'Jenkins Pipeline',
                    'Pipeline',
                    vscode.SymbolKind.Namespace,
                    range,
                    range
                );

                const pipelineContent = lines.slice(startLine, endLine + 1);
                symbol.children = this.parsePipelineContent(pipelineContent);

                symbols.push(symbol);
            }
        }

        return symbols;
    }

    private findClosingBrace(lines: string[], startLine: number): number {
        let braceCount = 0;

        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i].trim();
            for (let j = 0; j < line.length; j++) {
                if (line[j] === '{') {
                    braceCount++;
                } else if (line[j] === '}') {
                    braceCount--;
                    if (braceCount === 0) {
                        return i;
                    }
                }
            }
        }

        return startLine;
    }

    private parsePipelineContent(lines: string[]): vscode.DocumentSymbol[] {
        const symbols: vscode.DocumentSymbol[] = [];
        const sections = [
            { name: 'agent', regex: /^\s*agent\s*{/i },
            { name: 'parameters', regex: /^\s*parameters\s*{/i },
            { name: 'triggers', regex: /^\s*triggers\s*{/i },
            { name: 'environment', regex: /^\s*environment\s*{/i },
            { name: 'stages', regex: /^\s*stages\s*{/i },
            { name: 'post', regex: /^\s*post\s*{/i }
        ];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const section of sections) {
                const match = section.regex.exec(line);
                if (match) {
                    const nonBlankIndex = line.search(/\S/);
                    const sectionRange = new vscode.Range(
                        new vscode.Position(i, nonBlankIndex),
                        new vscode.Position(i, line.length)
                    );
                    symbols.push(
                        new vscode.DocumentSymbol(
                            section.name,
                            section.name.charAt(0).toUpperCase() + section.name.slice(1), // Capitalize the section name
                            vscode.SymbolKind.Variable,
                            sectionRange,
                            sectionRange
                        )
                    );

                    if (section.name === 'stages') {
                        const stagesContent = lines.slice(i + 1, this.findClosingBrace(lines, i) - 1);
                        const stagesChildren = this.parseStagesContent(stagesContent, i + 1);
                        symbols.push(...stagesChildren);
                    }

                    break;
                }
            }
        }

        return symbols;
    }

    private parseStagesContent(lines: string[], startIndex: number): vscode.DocumentSymbol[] {
        const symbols: vscode.DocumentSymbol[] = [];
        const stageRegex = /^\s*stage\s*\(\s*'(.+)'\s*\)\s*{/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = stageRegex.exec(line);
            if (match) {
                const stageName = match[1];
                const nonBlankIndex = line.search(/\S/);
                const stageRange = new vscode.Range(new vscode.Position(startIndex + i, nonBlankIndex), new vscode.Position(startIndex + i, line.length));
                const stageSymbol = new vscode.DocumentSymbol(
                    stageName,
                    'Stage',
                    vscode.SymbolKind.Field,
                    stageRange,
                    stageRange
                );

                const stepsContent = lines.slice(i + 1, this.findClosingBrace(lines, i + 1) - 1);
                stageSymbol.children = this.parseStepsContent(stageName, stepsContent, startIndex + i + 1);

                symbols.push(stageSymbol);
            }
        }

        return symbols;
    }

    private parseStepsContent(symbolName: string, lines: string[], startIndex: number): vscode.DocumentSymbol[] {
        const symbols: vscode.DocumentSymbol[] = [];
        const stepsRegex = /^\s*steps\s*{/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = stepsRegex.exec(line);
            if (match) {
                const nonBlankIndex = line.search(/\S/);
                const stepsRange = new vscode.Range(new vscode.Position(startIndex + i, nonBlankIndex), new vscode.Position(startIndex + i, line.length));
                const stepsSymbol = new vscode.DocumentSymbol(
                    symbolName + '-steps',
                    'Steps',
                    vscode.SymbolKind.Function,
                    stepsRange,
                    stepsRange
                );

                const stepLines = lines.slice(i + 1, this.findClosingBrace(lines, i) - 1);
                for (const stepLine of stepLines) {
                    const stepSymbol = this.addStep(stepLine, startIndex + i + 1);
                    if (stepSymbol) {
                        stepsSymbol.children.push(stepSymbol);
                    }
                }

                symbols.push(stepsSymbol);
            }
        }

        return symbols;
    }

    private addStep(line: string, lineIndex: number): vscode.DocumentSymbol | null {
        const stepRegex = /^\s*sh\s*"(.+)"\s*$/i;
        const match = stepRegex.exec(line);
        if (match) {
            const stepText = match[1];
            const stepRange = new vscode.Range(
                new vscode.Position(lineIndex, line.indexOf('"')),
                new vscode.Position(lineIndex, line.lastIndexOf('"') + 1)
            );
            return new vscode.DocumentSymbol(stepText, 'Step', vscode.SymbolKind.Function, stepRange, stepRange);
        }

        return null;
    }

    provideDocumentLinks(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentLink[]> {
        const links: vscode.DocumentLink[] = [];
        const text = document.getText();
        const lines = text.split(/\r?\n/);
        const symbols = this.parsePipelineContent(lines);

        for (const symbol of symbols) {
            const symbolStartLine = symbol.range.start.line;
            const lineText = lines[symbolStartLine];
            const openingBraceIndex = lineText.indexOf('{');

            if (openingBraceIndex !== -1) {
                const nonBlankIndex = lineText.slice(openingBraceIndex + 1).search(/\S/);
                if (nonBlankIndex !== -1) {
                    const position = new vscode.Position(symbolStartLine, nonBlankIndex + 1);
                    const range = new vscode.Range(position, position);
                    links.push(new vscode.DocumentLink(range, document.uri));
                }
            }
        }

        return links;
    }

}
