import * as vscode from 'vscode';
import JenkinsConfiguration from './config/settings';
import { BuildsProvider } from './sidebar/builds-provider';
import { ConnectionProvider } from './sidebar/connection-provider';
import { JobsProvider } from './sidebar/jobs-provider';
import { NotifyProvider } from './sidebar/notify-provider';
import { ProjectProvider } from './sidebar/project-provider';
import { ReservationProvider } from './sidebar/reservation-provider';
import { SnippetProvider } from './sidebar/snippet-provider';
import { ViewsProvider } from './sidebar/views-provider';
import { ProjectModels } from './types/model';
import { getConfigPath, readFileUriAsProject } from './utils/file';
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
	);

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

async function readSettings1(jenkinsSettingsPath: vscode.Uri): Promise<ProjectModels | string | undefined> {
	if (jenkinsSettingsPath.fsPath.endsWith(".jenkinsrc.json")) {
		if (!vscode.workspace.isTrusted) {
			vscode.window.showInformationMessage(vscode.l10n.t("The current workspace must be Trusted in order to load settings from .jenkinsrc.json files."));
			return undefined;
		}

		if (isRemoteUri(jenkinsSettingsPath)) {
			vscode.window.showInformationMessage(vscode.l10n.t("This workspace contains a `.jenkinsrc.json` file, which requires the Jenkins Status extension to be installed on the remote."));
			return undefined;
		}

		// const r = typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
		// delete r.cache[r.resolve(jenkinsSettingsPath.fsPath)];
		return await jenkinsSettingsPath.fsPath;
	} else {
		const content = await readFileUriAsProject(jenkinsSettingsPath);
		return content;
	}
}

async function showProjectView(projectProvider: ProjectProvider) {
	if (await hasJenkinsProject()) {
		projectProvider.refresh();
	}
}

