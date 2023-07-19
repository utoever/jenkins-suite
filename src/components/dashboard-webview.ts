// import * as vscode from 'vscode';
// import { escapeAttribute, getNonce } from '../utils/html';

// export default class DashboardWebView implements vscode.WebviewPanelSerializer {

//     private readonly uri: vscode.Uri;

//     public onDidRecentsUpdated: () => void = () => { };
//     public onDidBookmarksUpdated: () => void = () => { };

//     constructor(private readonly context: vscode.ExtensionContext) {
//         this.uri = this.context.extensionUri;
//     }

//     public async createOrShow(id: string) {
//         const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

//         try {
//             const data = await vscode.window.withProgress<NotionData>(
//                 {
//                     title: 'Jenkins Dashboard',
//                     location: vscode.ProgressLocation.Notification,
//                 },
//                 async (progress, _) => {
//                     progress.report({ message: 'Loading...' });
//                     return fetchData({
//                         id,
//                         api: this.config.api,
//                         accessToken: this.config.accessToken,
//                     });
//                 }
//             );

//             const panel = vscode.window.createWebviewPanel(
//                 NotionPanel.viewType,
//                 'VSCode Notion',
//                 column || vscode.ViewColumn.One,
//                 {
//                     enableScripts: true,
//                     retainContextWhenHidden: true,
//                     localResourceRoots: [vscode.Uri.joinPath(this.uri, 'resources')],
//                 }
//             );
//             panel.iconPath = this.iconPath;
//         } catch (e: any) {
//             if (e instanceof Error) {
//                 vscode.window.showErrorMessage(e.message);
//             } else {
//                 vscode.window.showErrorMessage(e);
//             }
//         }
//     }

//     public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: { id: string; data: NotionData }) {
//     }

//     public dispose(id: string) {
//     }

//     private getMetaTags(webview: vscode.Webview, nonce: string): string {
//         const trustedSources = this.config.allowEmbeds
//             ? sources.join(' ')
//             : "'none'";

//         return `
//     <meta charset="UTF-8">
//     <meta name="viewport"
//             content="width=device-width, initial-scale=1.0">
//     <meta http-equiv="Content-Security-Policy"
//             content="frame-src ${trustedSources};
//                     default-src 'none';
//                     style-src ${webview.cspSource} 'nonce-${nonce}';
//                     img-src ${webview.cspSource} https:;
//                     script-src 'nonce-${nonce}';">`;
//     }

//     private getStyles(webview: vscode.Webview, uri: vscode.Uri): string {
//         return ['reset.css', 'vscode.css', 'notion.css', 'prism.css']
//             .map((x) =>
//                 webview.asWebviewUri(vscode.Uri.joinPath(uri, 'resources', 'styles', x))
//             )
//             .map((x) => `<link href="${x}" rel="stylesheet" />`)
//             .join('');
//     }

//     private getScripts(
//         webview: vscode.Webview,
//         uri: vscode.Uri,
//         nonce: string,
//         state: NotionState
//     ): string {
//         const reactWebviewUri = webview.asWebviewUri(
//             vscode.Uri.joinPath(uri, 'resources', 'webview', 'index.js')
//         );

//         return `
//     <script nonce=${nonce}>
//       const vscode = acquireVsCodeApi();
//       vscode.setState(${JSON.stringify(state)});
//       window.vscode = vscode;
//     </script>
//     <script nonce="${nonce}" src="${reactWebviewUri}"></script>`;
//     }

//     public get iconPath() {
//         const root = vscode.Uri.joinPath(this.uri, 'resources', 'icons');
//         return {
//             light: vscode.Uri.joinPath(root, 'light', 'notion.svg'),
//             dark: vscode.Uri.joinPath(root, 'dark', 'notion.svg'),
//         };
//     }

//     public getHTML(webview: vscode.Webview, state: NotionState) {
//         const nonce = getNonce();

//         return `
//     <!DOCTYPE html>
//     <html lang="en"
//           style="${escapeAttribute(this.getSettingsOverrideStyles())}">
//     <head>
//         ${this.getMetaTags(webview, nonce)}
//         ${this.getStyles(webview, this.uri)}
//     </head>
//     <body>
//         <div id="root"></div>
//         ${this.getScripts(webview, this.uri, nonce, state)}
//     </body>
//     </html>`;
//     }

//     private getStyles(webview: vscode.Webview, uri: vscode.Uri): string {
//         return ['reset.css', 'vscode.css', 'notion.css', 'prism.css']
//             .map((x) =>
//                 webview.asWebviewUri(vscode.Uri.joinPath(uri, 'resources', 'styles', x))
//             )
//             .map((x) => `<link href="${x}" rel="stylesheet" />`)
//             .join('');
//     }

// }
