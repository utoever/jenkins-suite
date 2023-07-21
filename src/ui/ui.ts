import { ProgressLocation, Uri, commands, env, version, window } from 'vscode';
import { Constants } from '../svc/constants';
import { printEditor } from '../utils/editor';

export function showInfoMessageWithTimeout(message: string, timeout: number = 3000) {
    const upTo = timeout / 10;
    window.withProgress({
        location: ProgressLocation.Notification,
        title: message,
        cancellable: true,
    },
        async (progress) => {
            let counter = 0;
            return new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    progress.report({ increment: counter / upTo });
                    if (++counter === upTo) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 10);
            });
        }
    );
}

export async function showDoneableInfo(title: string, callback: () => Promise<void>) {
    await window.withProgress({
        location: ProgressLocation.Notification,
        title,
    },
        async () => callback()
    );
}

export async function showErrorMessageWithMoreInfo(message: string, link: string) {
    const moreInfo = 'More Info';
    const result = await window.showErrorMessage(message, moreInfo);
    if (result === moreInfo) {
        env.openExternal(Uri.parse(link));
    }
}

export function openLinkBrowser(url: string) {
    try {
        env.openExternal(Uri.parse(url));
    } catch (error) {
        console.error('Error opening browser: ', error);
    }
}

export async function notifyUIUserMessage(message: string = 'Processing', showEditor: boolean = true) {
    try {
        showInfoMessageWithTimeout(message, 1500);
        if (showEditor) {
            await printEditor('Waiting', true);
            for (let i = 0; i < 3; i++) {
                setTimeout(async () => {
                    await printEditor('.', false);
                }, 500);
            }
        }
    } catch (error: any) {
        // ignore
    }
}

export async function refreshView(cmd: string, timeout: number = Constants.JENKINS_DEFAULT_GROOVY_DELAY) {
    setTimeout(async () => {
        await commands.executeCommand(cmd);
    }, timeout);
}