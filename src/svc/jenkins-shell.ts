import { log } from "console";
import _ from "lodash";
import { Executor } from "../api/executor";
import logger from "../utils/logger";

export class JenkinsShell {

    [key: string]: Function | Executor;

    constructor(private readonly executor: Executor) {
    }

    async execute(text: string | string[]) {
        let commands;
        if (Array.isArray(text)) {
            commands = text;
        } else {
            commands = text.split('\n');
        }

        let ignoreErrors = false;
        let results: string[] = [];
        for (const lineCmdOrg of commands) {
            try {
                let lineCmd = lineCmdOrg.trim();
                if (!lineCmd || lineCmd === '' || lineCmd === '\n') {
                    continue;
                } else if (lineCmd.startsWith('#!jenkins')) {
                    if (lineCmd.includes('ignoreErrors=true')) {
                        ignoreErrors = true;
                    }
                    continue;
                } else if (lineCmd.startsWith('#')) {
                    continue;
                }

                let cmdString: string;
                if (lineCmd.indexOf('#') > 0) {
                    cmdString = lineCmd.substring(0, lineCmd.indexOf('#'));
                } else {
                    cmdString = lineCmd;
                }

                for (let part of cmdString.split(';')) {
                    const partResult = await this.executeInternal(part);
                    results = [...results, ...partResult];
                }
            } catch (error: any) {
                logger.error(error.message);
                if (!ignoreErrors) {
                    break;
                }
            }
        }
        return results.join('\n');
    }

    async executeInternal(cmdString: string): Promise<string[]> {
        const results: string[] = [];
        const cmds = cmdString.trim().split(' ').filter(cmd => cmd);
        if (cmds[0].indexOf('-') > 0) {
            cmds[0] = cmds[0].replace(/-/g, '_');
        }
        const cmd = _.camelCase(cmds[0]);
        if (typeof this[cmd] === 'function') {
            log(`execute: ${cmd}`);
            const result: string | string[] = await (this[cmd] as Function)(...cmds.slice(1));
            results.push(`* ${cmds[0].toUpperCase()}`);
            if (Array.isArray(result)) {
                results.push(...result);
            } else {
                results.push(result);
            }
            results.push('\n');
        } else {
            results.push(`Command ${cmd} is not supported`);
            logger.warn(`Command ${cmd} is not supported`);
        }
        return results;
    }

    async createUser(username: string, password: string) {
        logger.info(`Creating user: ${username} with password: ${password}`);
        const result = await this.executor.createUser(username, password);
        return `user <${username}>: ${result ? 'Success' : 'Failed'}`;
    }

    async deleteUser(...users: string[]) {
        logger.info(`delete user: ${users}`);
        const results = [];
        for (const user of users) {
            logger.info(`Creating user: ${user}`);
            const result = await this.executor.deleteUser(user);
            results.push(`user <${user}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async createViews(...views: string[]) {
        const results = [];
        for (const view of views) {
            logger.info(`Creating view: ${view}`);
            const result = await this.executor.createView(view);
            results.push(`view <${view}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async createView(viewname: string, regex: string) {
        const results = [];
        logger.info(`Creating view: ${viewname}`);
        const result = await this.executor.createView(viewname, regex);
        results.push(`view <${viewname}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async deleteView(...views: string[]) {
        const results = [];
        for (const view of views) {
            logger.info(`Deleting view: ${view}`);
            const result = await this.executor.deleteView(view);
            results.push(`view <${view}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async createFolder(...folders: string[]) {
        const results = [];
        for (const folder of folders) {
            logger.info(`Creating folder: ${folder}`);
            const result = await this.executor.createFolder(folder);
            results.push(`folder <${folder}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async renameFolder(jobName: string, newName: string = 'all') {
        const results = [];
        logger.info(`Rename jobName: ${jobName}`);
        const result = await this.executor.renameFolder(jobName, newName);
        results.push(`folder <${jobName}>: ${result === 'true' ? 'Success' : 'Failed'}`);
        return results;
    }

    async createPipeline(jobName: string, viewName: string = 'all') {
        const results = [];
        logger.info(`Creating jobName: ${jobName}`);
        const result = await this.executor.createPipelineJob(jobName, viewName);
        results.push(`pipeline <${jobName}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async createShortcut(shortcutName: string, url: string, viewName: string = 'all') {
        const results = [];
        logger.info(`Creating shortcutName: ${shortcutName}`);
        const result = await this.executor.createShortcut(shortcutName, url, viewName);
        results.push(`shortcut <${shortcutName}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async buildJob(uri: string, ...args: string[]) {
        const results = [];
        logger.info(`Build Job: ${uri}`);
        const formParams = new Map<string, string>();
        if (args && args.length > 0) {
            args.forEach(arg => {
                const param = arg.split('=');
                formParams.set(param[0], param[1]);
            });
        } else {
            formParams.set('_', uri);
        }
        const result = await this.executor.buildJobParam(this.assistUri(uri), formParams);
        results.push(`job <${uri}>: ${result.includes('status code') ? 'Failed' : 'Success'}`);
        return results;
    }

    async renameJob(uri: string, newName: string) {
        const results = [];
        logger.info(`Rename Job: ${uri}`);
        const result = await this.executor.renameJob(this.assistUri(uri), newName);
        results.push(`job <${uri}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async moveJob(uri: string, newName: string) {
        const results = [];
        logger.info(`Move Job: ${uri}`);
        const result = await this.executor.moveJob(this.assistUri(uri), newName);
        results.push(`job <${uri}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async deleteFolder(...folders: string[]) {
        const results = [];
        for (const folder of folders) {
            logger.info(`Deleting folder: ${folder}`);
            const result = await this.executor.deleteJobWithUri(this.assistUri(folder));
            results.push(`folder <${folder}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async deleteJob(...jobs: string[]) {
        const results = [];
        for (const job of jobs) {
            logger.info(`Deleting job: ${job}`);
            const result = await this.executor.deleteJobWithUri(this.assistUri(job));
            results.push(`job <${job}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async createSecretText(username: string, password: string) {
        const results = [];
        logger.info(`Creating SecretText: ${username}`);
        const result = await this.executor.createCredential(username, password, 'SecretText');
        results.push(`createSecretText <${username}>: ${result === '' ? 'Success' : 'Failed'}`);
        return results;
    }

    async createCredUser(username: string, password: string) {
        const results = [];
        logger.info(`Creating Credential User: ${username}`);
        const result = await this.executor.createCredential(username, password, 'CredentialUser');
        results.push(`createSecretText <${username}>: ${result === '' ? 'Success' : 'Failed'}`);
        return results;
    }

    async createCredentialUser(username: string, password: string) {
        return this.createCredUser(username, password);
    }

    async getGlobalVar() {
        const results: string[] = [];
        logger.info('Get Global Var');
        const result = await this.executor.getGlobalVar();
        if (typeof result === 'object') {
            Object.entries<string>(result).forEach(([key, val]) => {
                results.push(`${key}=${val}`);
            });
        }
        logger.info(results.join('\n'));
        return results;
    }

    async createGlobalVar(envKey: string, ...envVal: string[]) {
        const results = [];
        const valStr = envVal.join(' ').trim();
        logger.info(`Creating Global Var: ${valStr}`);
        const result = await this.executor.createGlobalVar(envKey, valStr);
        results.push(`globalVar <${envKey}>: ${result === '' ? 'Success' : 'Failed'}`);
        return results;
    }

    async changeGlobalVar(envKey: string, envVal: string) {
        const results = [];
        logger.info(`changing Global Var: ${envKey}`);
        const result = await this.executor.createGlobalVar(envKey, envVal);
        results.push(`globalVar <${envKey}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async deleteGlobalVar(...envKeys: string[]) {
        const results = [];
        for (const envKey of envKeys) {
            logger.info(`Deleting Global Var: ${envKey}`);
            const result = await this.executor.deleteGlobalVar(envKey);
            results.push(`globalVar <${envKey}>: ${result ? 'Success' : 'Failed'}`);
        }
        return results;
    }

    async getLogRotator(jobName: string) {
        const results: string[] = [];
        logger.info(`Get Log Rotator: ${jobName}`);
        const result = await this.executor.getLogRotator(jobName);
        results.push(`getLogRotator <${jobName}>: ${result ? result : 'Failed'}`);
        return results;
    }

    async setLogRotator(jobName: string, maxCount: string) {
        const results: string[] = [];
        logger.info(`Set Log Rotator: ${jobName}`);
        const result = await this.executor.setLogRotator(jobName, maxCount);
        results.push(`setLogRotator <${jobName}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async deleteLogRotator(jobName: string) {
        const results: string[] = [];
        logger.info(`Delete Log Rotator: ${jobName}`);
        const result = await this.executor.deleteLogRotator(jobName);
        results.push(`deleteLogRotator <${jobName}>: ${result ? 'Success' : 'Failed'}`);
        return results;
    }

    async getRssAll(...args: string[]) {
        const results = [];
        logger.info(`Get Rss All`);
        const result = await this.executor.getRssAll();
        try {
            const entries = result.feed.entry;
            let count = entries.length;
            if (args && args.length > 0 && args.length < entries.length) {
                count = args.length;
            }
            results.push(`* Result: ${count}\n`);
            if (args && args.length > 0) {
                for (let arg of args) {
                    const idx = Number.parseInt(arg);
                    results.push(JSON.stringify(entries[idx], null, 2));
                }
            } else {
                for (let entry of entries) {
                    results.push(JSON.stringify(entry, null, 2));
                }
            }
        } catch (error: any) {
            logger.error(error.message);
        }
        return results;
    }

    async sleep(timeout: string, ...args: string[]) {
        let seconds;
        try {
            seconds = Number.parseInt(timeout) * 1000;
        } catch (error) {
            seconds = 10000;
        }
        return this.lazyFunction(seconds, ...args);
    }

    async lazyFunction(timeout: number, ...args: string[]): Promise<string[]> {
        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    if (args && args.length > 0) {
                        const result = await this.executeInternal(args.join(' '));
                        return resolve(result);
                    }
                    return resolve([]);
                } catch (error: any) {
                    logger.error(error.message);
                }
            }, timeout);
        });
    }

    async nothing(...args: string[]) {
    }

    assistUri(uri: string) {
        let safeUri;
        if (uri.startsWith('job')) {
            safeUri = uri;
        } else {
            safeUri = `job/${uri}`;
        }
        return safeUri;
    }

}
