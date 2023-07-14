import { Uri, ViewColumn, WebviewPanel, window } from "vscode";

export function showPageView() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jenkins</title>
</head>
<body>
    <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
</body>
</html>`;
}

export function showEmbedFrameView(uri: Uri) {
    const panel = window.createWebviewPanel(
        'jenkins',
        'Jenkins',
        ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    panel.webview.onDidReceiveMessage(message => {
        if (message.command === 'enableDevTools') {
            panel.webview.postMessage({ command: 'enabledDevTools' });
        }
    });
    panel.webview.html = `<iframe src="https://google.com/" width="100%" height="100%" sandbox="allow-same-origin allow-scripts"></iframe>`;
    // panel.webview.html = '<h1>Hello World!</h1>';

    panel.onDidDispose(() => {
    });
    return panel;
}
