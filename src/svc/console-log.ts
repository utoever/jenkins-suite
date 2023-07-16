import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as vscode from 'vscode';
import consoleLogApp from './console-log-app';

function showPanel() {
    const panel = vscode.window.createWebviewPanel(
        'yourPanelId',
        'Your Panel Title',
        vscode.ViewColumn.One,
        {}
    );

    const webview = panel.webview;
    ReactDOM.render(<consoleLogApp />, webview);
}
