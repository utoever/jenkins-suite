// import * as React from 'react';
// import * as ReactDOM from 'react-dom';
// import * as vscode from 'vscode';
// import { Executor } from '../api/executor';
// import DataTable from '../components/DataTable';
// import { showInfoMessageWithTimeout } from "../ui/ui";
// import { getSelectionText } from "../utils/editor";
// import logger from '../utils/logger';
// import { inferFileExtension } from '../utils/util';
// import { parseXml } from '../utils/xml';

// export class DashboardProvider {

//     constructor(protected context: vscode.ExtensionContext) {
//         this.context.subscriptions.push(
//             vscode.commands.registerCommand('utocode.runAddMultiReservation', async () => {
//                 const panel = vscode.window.createWebviewPanel(
//                     'reactTable', // Unique ID
//                     'React Table', // Title
//                     vscode.ViewColumn.One, // Panel column to show in (One, Two, Three)
//                     {
//                         enableScripts: true // Allow scripts in the webview
//                     }
//                 );

//                 // Data to be displayed in the table
//                 const data = [
//                     { id: 1, name: 'John Doe', age: 30 },
//                     { id: 2, name: 'Jane Smith', age: 28 },
//                     // Add more data rows here
//                 ];

//                 // Render the React component inside the Webview panel
//                 ReactDOM.render(<DataTable data={ data } />, panel.webview);
//             });
//         );
//     }

// }