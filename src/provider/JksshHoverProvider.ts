import * as vscode from 'vscode';

export class JksshHoverProvider implements vscode.HoverProvider {

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position, /[\w-]+/);
        if (!wordRange) {
            return;
        }

        const word = document.getText(wordRange);
        const hoverInfo: { [key: string]: KeywordInfo } = {
            'create-user': {
                content: 'create-user: Create a user\n\n---\n```jkssh\ncreate-user {username} {password}```',
                description: 'Creates a new user.',
            },
            'create-view': {
                content: 'create-view: Create a view\n\n---\n```jkssh\ncreate-view {viewname} {regex}```',
                description: 'Creates a new view.',
            },
            // Add more entries for other keywords as needed
        };

        const keywordInfo = hoverInfo[word];
        if (keywordInfo) {
            const hoverContents = new vscode.MarkdownString(keywordInfo.content);
            return new vscode.Hover(hoverContents, wordRange);
        }

        return null;
    }

}

interface KeywordInfo {
    content: string;
    description: string;
}
