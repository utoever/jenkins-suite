import * as vscode from 'vscode';
import { BuildsProvider } from './provider/builds-provider';
import { ConnectionProvider } from './provider/connection-provider';
import { JobsProvider } from './provider/jobs-provider';
import { JenkinsCodeLensProvider } from './provider/languages/jenkins-codelens';
import { JenkinsHoverProvider } from './provider/languages/jenkins-hover-provider';
import { JenkinsPipelineSymbolProvider } from './provider/languages/jenkins-symbol-provider.ts';
import { JksshHoverProvider } from './provider/languages/jkssh-hover-provider';
import { JksshDocumentSymbolProvider } from './provider/languages/jkssh-symbol-provider';
import { XmlCodeLensProvider } from './provider/languages/xml-codelens';
import { NotifyProvider } from './provider/notify-provider';
import { ProjectProvider } from './provider/project-provider';
import { ReservationProvider } from './provider/reservation-provider';
import { SnippetProvider } from './provider/snippet-provider';
import { ViewsProvider } from './provider/views-provider';
import { getConfigPath } from './utils/file';
import { isRemoteUri } from './utils/remote';
import { vscExtension } from './vsc-ns';

export async function activate(context: vscode.ExtensionContext) {
	vscExtension.context = context;

	const buildsProvider = new BuildsProvider(context);
	const reservationProvider = new ReservationProvider(context);
	const jobsProvider = new JobsProvider(context, buildsProvider, reservationProvider);
	const viewsProvider = new ViewsProvider(context, jobsProvider);
	const notifyProvider = new NotifyProvider(context);
	const connectionProvider = new ConnectionProvider(context, viewsProvider, jobsProvider, buildsProvider, reservationProvider, notifyProvider);
	const projectProvider = new ProjectProvider(context);

	vscode.window.registerTreeDataProvider("utocode.views.views", viewsProvider);
	vscode.window.registerTreeDataProvider("utocode.views.jobs", jobsProvider);
	vscode.window.registerTreeDataProvider("utocode.views.builds", buildsProvider);
	vscode.window.registerTreeDataProvider("utocode.views.notify", notifyProvider);
	vscode.window.registerTreeDataProvider("utocode.views.connection", connectionProvider);

	const snippetProvider = new SnippetProvider(context);
	vscode.window.registerTreeDataProvider("utocode.views.reservation", reservationProvider);
	vscode.window.registerTreeDataProvider("utocode.views.snippets", snippetProvider);

	const jenkinsSymbolProvider = new JenkinsPipelineSymbolProvider();
	const jksSymbolProvider = new JksshDocumentSymbolProvider();
	const symbolProviders = [
		{ language: 'jenkins', scheme: 'file', provider: jenkinsSymbolProvider },
		{ language: 'jkssh', scheme: 'file', provider: jksSymbolProvider },
		{ language: 'jenkins', scheme: 'jkssh', provider: jenkinsSymbolProvider },
		{ language: 'jkssh', scheme: 'jkssh', provider: jksSymbolProvider },
	];

	const jenkinsHoverProvider = new JenkinsHoverProvider();
	const jksshHoverProvider = new JksshHoverProvider();

	const hoverProviders = [
		{ language: 'jenkins', scheme: 'file', provider: jenkinsHoverProvider },
		{ language: 'jkssh', scheme: 'file', provider: jksshHoverProvider },
		{ language: 'jenkins', scheme: 'jkssh', provider: jenkinsHoverProvider },
		{ language: 'jkssh', scheme: 'jkssh', provider: jksshHoverProvider },
	];
	context.subscriptions.push(
		vscode.window.createTreeView('jenkinsProject', {
			treeDataProvider: projectProvider
		}),
		vscode.workspace.onDidChangeWorkspaceFolders(async () => {
			showProjectView(projectProvider);
		}),
		vscode.commands.registerCommand("utocode.welcome", () => {
			vscode.commands.executeCommand(`workbench.action.openWalkthrough`, `utocode.jenkinssuite#utocode.welcome`, false);
		}),
		vscode.languages.registerCodeLensProvider(['jenkins', 'jkssh', 'groovy'], new JenkinsCodeLensProvider(context)),
		vscode.languages.registerCodeLensProvider(['xml'], new XmlCodeLensProvider(context)),
	);

	for (const { language, scheme, provider } of symbolProviders) {
		vscode.languages.registerDocumentSymbolProvider({ language, scheme }, provider);
	}

	for (const { language, scheme, provider } of hoverProviders) {
		vscode.languages.registerHoverProvider({ language, scheme }, provider);
	}

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (vscode.window.activeTextEditor?.document === e.document) {
			}
		})
	);

	// const scriptProvider = new ScriptProvider(context);
	showProjectView(projectProvider);
	function registerCommand(cmd: string, callback: () => void) {
		const command = vscode.commands.registerCommand(cmd, callback);
		context.subscriptions.push(new Command(cmd, command));
	}
}

export function deactivate() {
}

class Command {
	constructor(public cmdId: string, private command: vscode.Disposable) {
	}
	public dispose() {
		return this.command.dispose();
	}
}

async function hasJenkinsProject(): Promise<boolean> {
	if (!vscode.workspace.workspaceFolders) {
		return false;
	}

	let hasAny = false;
	for (const folder of vscode.workspace.workspaceFolders) {
		hasAny = !!await getConfigPath(folder.uri);
		if (hasAny) {
			return hasAny;
		}
	}

	return hasAny;
}

async function showProjectView(projectProvider: ProjectProvider) {
	if (await hasJenkinsProject()) {
		projectProvider.refresh();
	}
}
