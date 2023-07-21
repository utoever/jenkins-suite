import * as vscode from 'vscode';

export class JksshDocumentSymbolProvider implements vscode.DocumentSymbolProvider {

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const symbols: vscode.DocumentSymbol[] = [];
        const lines = document.getText().split('\n');

        const fieldRegex = /[\w-]+/;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim().startsWith('#!jenkins')) {
                const range = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(0, lines[0].length)
                );

                const symbol = new vscode.DocumentSymbol(
                    'Jenkins Shell',
                    'Jenkins Shell',
                    vscode.SymbolKind.Namespace,
                    range,
                    range
                );
                symbols.push(symbol);
                continue;
            } else if (!line.trim() || line.trim().startsWith('#')) {
                continue;
            }

            const match = line.match(fieldRegex);
            if (match) {
                const fieldName = match[0];

                const startPosition = new vscode.Position(i, line.indexOf(fieldName));
                const endPosition = new vscode.Position(i, line.indexOf(fieldName) + fieldName.length);
                // const type = fieldName.split('-')[0];

                const fieldSymbol = new vscode.DocumentSymbol(
                    fieldName,
                    fieldName,
                    vscode.SymbolKind.Function,
                    new vscode.Range(startPosition, endPosition),
                    new vscode.Range(startPosition, endPosition)
                );

                symbols.push(fieldSymbol);
            }
        }

        return symbols;
    }

}
