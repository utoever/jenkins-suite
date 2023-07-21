import FormData from 'form-data';
import { decode } from 'html-entities';
import { initial } from 'lodash';
import path from 'path';
import * as vscode from 'vscode';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { Constants } from '../svc/constants';
import { SnippetSvc } from '../svc/snippet';
import { ParametersDefinitionProperty } from '../types/jenkins-types';
import { AllViewModel, BaseJobModel, BuildDetailStatus, BuildsModel, JenkinsFeed, JenkinsInfo, JenkinsUsers, JobModelType, JobProperty, JobsModel } from "../types/model";
import { mapToUrlParams } from '../utils/html';
import logger from '../utils/logger';
import { getParameterDefinition } from '../utils/model-utils';
import { parseXml, parseXmlData } from '../utils/xml';
import { Jenkins } from "./jenkins";

export class Executor {

    [key: string]: Function | Jenkins | JenkinsServer | vscode.ExtensionContext | SnippetSvc;

    private _jenkins: Jenkins;

    private snippetSvc: SnippetSvc;

    constructor(private readonly context: vscode.ExtensionContext, private readonly server: JenkinsServer) {
        this._jenkins = new Jenkins(server);
        this.snippetSvc = new SnippetSvc(context);
    }

    public async initialized() {
        return await this._jenkins.initialized();
    }

    public async isConnected() {
        return await this.initialized();
    }

    public disconnect() {
        this._jenkins.expire();
    }

    public get client(): Jenkins {
        return this._jenkins;
    }

    public extractUrl(url: string) {
        const uri = url.replace(this.client.server.url, '');
        return uri.endsWith('/') ? uri.substring(0, uri.length - 1) : uri;
    }

    async getInfo(): Promise<JenkinsInfo> {
        const result = await this._jenkins._get<JenkinsInfo>(
            `api/json`
        );
        return result;
    }

    async getConfigView(name: string): Promise<any> {
        console.log(`job name <${name}>`);
        return await this._jenkins._get<any>(
            `view/${name}/config.xml`
        );
    };

    async getViews(name: string): Promise<AllViewModel> {
        console.log(`view name <${name}>`);

        return await this._jenkins._get<AllViewModel>(
            `view/${name}/api/json`
        );
    };

    async getViewsWithDetail(name: string, detail: boolean = false): Promise<AllViewModel> {
        const allViewModel = await this.getViews(name);
        if (detail && allViewModel) {
            for (let job of allViewModel.jobs) {
                // let jobDetail = await this._jenkins.getJob(job.name);
                job.jobDetail = await this.getJob(job);
            }
        }
        return allViewModel;
    };

    async createView(name: string, regex: string = '[a-zA-Z].*') {
        if (name) {
            const categorizedEnabled = JenkinsConfiguration.categorizedEnabled;
            let createView = categorizedEnabled ? JenkinsConfiguration.createSnippetView : Constants.SNIPPET_DEFAULT_LISTVIEW;
            const snippetItem = await this.snippetSvc.invokeSnippet(createView.toUpperCase());
            let data: string | undefined;
            if (snippetItem && snippetItem.body) {
                data = snippetItem.body.join('\n').replace('__NAME__', name)
                    .replace('__REGEX__', regex);
            }
            console.log(`createView:: name <${name}> data <${data}>`);

            const result = await this._jenkins._create<string>(
                `createView?name=${name}`, data
            );
            if (result === '') {
                return true;
            } else {
                return false;
            }
        } else {
            return 'Cancelled creating view';
        }
    }

    async updateConfigView(name: string, content: any): Promise<string> {
        console.log(`updateConfigView:: name <${name}>`);

        return await this._jenkins._create<string>(
            `view/${name}/config.xml`, content
        );
    }

    async renameView(name: string, newViewName: string): Promise<string> {
        console.log(`renameView:: name <${name}>`);

        const data = `def jenkins = Jenkins.getInstanceOrNull();def view = jenkins.getView('${name}');view.rename('${newViewName}')`;
        const result = await this.executeScript(data);
        return result;
    }

    async deleteView(name: string): Promise<boolean | undefined> {
        console.log(`deleteView:: name <${name}>`);

        const data = `def jenkins = Jenkins.getInstanceOrNull();def view = jenkins.getView('${name}');jenkins.deleteView(view)`;
        const result = await this.executeScript(data);
        if (result === '') {
            return true;
        } else {
            return false;
        }
    }

    async changePrimaryView(name: string) {
        console.log(`changePrimaryView:: name <${name}>`);

        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('grv_changePrimaryView');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace(/__NEW_VIEWNAME__/g, name);
            const result = await this.executeScript(data);
            if (result && result.startsWith('Result:')) {
                return result.split('Result: ').pop();
            } else {
                return false;
            }
        } else {
            return undefined;
        }
    }

    async createUser(username: string, password: string, role: string = 'USER') {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('create_user');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__ROLE__', role)
                .replace('__USERNAME__', username)
                .replace('__PASSWORD__', password);
            console.log(`createUser:: username <${username}> role <${role}>`);
            const result = data && await this.executeScript(data);
            if (result === '') {
                return true;
            } else {
                return false;
            }
        } else {
            return undefined;
        }
    }

    async deleteUser(username: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('delete_user');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__USERNAME__', username);
            console.log(`deleteUser:: username <${username}>`);
            const result = data && await this.executeScript(data);
            if (result && result.startsWith('Result:')) {
                const result1 = result.split('Result: ').pop();
                return result1 ? result1.trim() === 'true' : false;
            } else {
                return false;
            }
        } else {
            return undefined;
        }
    }

    async getUsers(): Promise<JenkinsUsers | undefined> {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('get_users');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n');
            console.log(`getUsers:: execute`);
            const result = await this.executeScript(data);
            let jenkinsUsers: JenkinsUsers | undefined = undefined;
            if (result && result.startsWith('Result:')) {
                const body = result.split('Result: ').pop();
                jenkinsUsers = JSON.parse(body!) as JenkinsUsers;
            }
            return jenkinsUsers;
        } else {
            return undefined;
        }
    }

    async createCredential(username: string, password: string, kind: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('createCredential');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__KIND__', kind)
                .replace('__USERNAME__', username)
                .replace('__PASSWORD__', password);
        }

        console.log(`createCredential:: username <${username}> kind <${kind}>`);
        return data && await this.executeScript(data);
    }

    async getGlobalVar() {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('getGlobalVars');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n');
        }

        console.log(`getGlobalVars`);
        const result = data && await this.executeScript(data);
        return result;
    }

    async createGlobalVar(key: string, val: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('createGlobalVars');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__ENV_KEY__', key)
                .replace('__ENV_VAL__', val);
        }

        console.log(`createGlobalVars:: key <${key}> val <${val}>`);
        const result = data && await this.executeScript(data);
        return result;
    }

    async deleteGlobalVar(key: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('deleteGlobalVars');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__ENV_KEY__', key);
        }

        console.log(`deleteGlobalVars:: key <${key}>`);
        const result = data && await this.executeScript(data);
        return result;
    }

    async getSystemMessage(): Promise<string> {
        const data = 'def jenkins = Jenkins.getInstanceOrNull();jenkins.getSystemMessage()';
        const result = await this.executeScript(data);
        let message = '';
        if (result && result.startsWith('Result')) {
            message = result.split('Result: ').pop() ?? '';
        }
        return message;
    }

    async setSystemMessage(message: string): Promise<string> {
        const data = `def jenkins = Jenkins.getInstanceOrNull();jenkins.getSystemMessage();
        def text = new String('${message}'.getBytes('iso-8859-1'),'utf-8');
        jenkins.setSystemMessage(text);jenkins.save()`;
        const result = await this.executeScript(data);
        return result;
    }

    async getExecutor() {
        const data = 'def jenkins = Jenkins.getInstanceOrNull();jenkins.getNumExecutors()';
        const result = await this.executeScript(data);
        return result ? result.split(':').pop()?.trim() : result;
    }

    async changeExecutor(numExecutors: string) {
        const data = `def jenkins = Jenkins.getInstanceOrNull();jenkins.setNumExecutors(${numExecutors});jenkins.save(); jenkins.getNumExecutors()`;
        const result = await this.executeScript(data);
        return result ? result.split(':').pop()!.trim() : result;
    }

    async isAdmin(username: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('is_admin');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__USERNAME__', username);
        }

        logger.debug(`isAdmin:: username <${username}>`);
        return data && await this.executeScript(data);
    }

    async convertJksshAsJob(jobName: string, shCmd: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('create_jenkins_shell');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__JOB_NAME__', jobName)
                .replace('__SHELL_TEXT__', shCmd);
        }

        logger.debug(`convertJksshAsJob:: jobName <${jobName}>`);
        return data && await this.executeScript(data);
    }

    async deleteJobParam(jobName: string, paramName: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('delete_job_param');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__JOB_NAME__', jobName)
                .replace('__PARAM_NAME__', paramName);
        }

        logger.debug(`deleteJobParam:: jobName <${jobName}>`);
        return data && await this.executeScript(data);
    }

    async getLogRotator(jobName: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('get_log_rotator');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__JOB_NAME__', jobName);
        }

        logger.debug(`getLogRotator:: jobName <${jobName}>`);
        return data && await this.executeScript(data);
    }

    async setLogRotator(jobName: string, maxCount: string) {
        if (maxCount === '0' || maxCount === '') {
            const result = this.deleteLogRotator(jobName);
            return 0;
        } else {
            const snippetItem = await this.snippetSvc.invokeSnippetJenkins('set_log_rotator');
            let data: string | undefined;
            if (snippetItem && snippetItem.body) {
                data = snippetItem.body.join('\n').replace('__JOB_NAME__', jobName)
                    .replace('__MAX_COUNT__', maxCount);
            }

            logger.debug(`setLogRotator:: jobName <${jobName}>`);
            return data && await this.executeScript(data);
        }
    }

    async deleteLogRotator(jobName: string) {
        const snippetItem = await this.snippetSvc.invokeSnippetJenkins('delete_log_rotator');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__JOB_NAME__', jobName);
        }

        logger.debug(`deleteLogRotator:: jobName <${jobName}>`);
        return data && await this.executeScript(data);
    }

    //
    // Job
    //

    async getConfigJob(job: JobsModel): Promise<any> {
        const uri = this.extractUrl(job.url);
        console.log(`uri <${uri}>`);
        return await this._jenkins._get<any>(
            `${uri}/config.xml`
        );
    };

    async getConfigJobUri(uri: string): Promise<any> {
        return await this._jenkins._get<any>(
            `${uri}/config.xml`
        );
    };

    async getJobAsView(job: BaseJobModel): Promise<AllViewModel> {
        const uri = this.extractUrl(job.url);
        console.log(`getJobAsView: uri <${uri}>`);
        return await this._jenkins._get<AllViewModel>(
            `${uri}/api/json`
        );
    };

    async getJobAsViewFromProject(uri: string): Promise<AllViewModel> {
        console.log(`getJobAsView: uri <${uri}>`);
        return await this._jenkins._get<AllViewModel>(
            `${uri}/api/json`
        );
    };

    async checkJobName(name: string): Promise<boolean> {
        const result = await this._jenkins._post<string>(
            `checkJobName?value=${name}`
        );
        console.log(result);
        if (result === '<div/>') {
            return true;
        } else {
            return false;
        }
    }

    async getJob(job: JobsModel): Promise<BuildsModel> {
        const uri = this.extractUrl(job.url);
        console.log(`uri <${uri}>`);
        return await this._jenkins._get<BuildsModel>(
            `${uri}/api/json`
        );
    };

    async getJobFromProject(uri: string): Promise<BuildsModel> {
        console.log(`uri <${uri}>`);
        return await this._jenkins._get<BuildsModel>(
            `${uri}/api/json`
        );
    };

    async getBuild(job: JobsModel, buildNumber: number): Promise<BuildDetailStatus> {
        const uri = this.extractUrl(job.url);
        // console.log(`uri <${uri}>`);
        return await this._jenkins._get<BuildDetailStatus>(
            `${uri}/${buildNumber}/api/json`
        );
    };

    async buildJobParam(uri: string, formData: Map<string, string>, delay: number = 3): Promise<string> {
        try {
            if (delay < 1) {
                delay = 1;
            } else if (delay > 99) {
                delay = 99;
            }

            if (formData && formData.size > 0) {
                return await this._jenkins._postFormEncoded<string>(
                    `${uri}/buildWithParameters?delay=${delay}sec&${mapToUrlParams(formData)}`
                );
            } else {
                return await this._jenkins._post<string>(
                    `${uri}/build?delay=${delay}sec`
                );
            }
        } catch (error: any) {
            logger.error(`build: ${error.message}`);
            throw error;
        }
    }

    async buildJobWithForm(job: JobsModel, formData: Map<string, string>, delay: number = 3): Promise<string> {
        const uri = this.extractUrl(job.url);
        return this.buildJobParam(uri, formData, delay);
    }

    async buildJobWithParameter(job: JobsModel, delay: number = 3): Promise<string> {
        const jobParams = getParameterDefinition(job.jobDetail ?? undefined);
        const uri = this.extractUrl(job.url);
        if (delay < 1) {
            delay = 1;
        } else if (delay > 99) {
            delay = 99;
        }

        let flag: boolean = true;
        const formData = new Map<string, any>();
        if (jobParams && jobParams.length > 0) {
            for (let param of jobParams[0].parameterDefinitions) {
                if (param._class === ParametersDefinitionProperty.wHideParameterDefinition.toString()) {
                    continue;
                }
                const result = await vscode.window.showInputBox({
                    prompt: 'Enter "' + param.description ?? '' + '"',
                    value: param.defaultParameterValue.value
                }).then((val) => {
                    return val;
                });
                if (result) {
                    formData.set(param.name, result);
                } else {
                    flag = false;
                    break;
                }
            }
            if (!flag) {
                return 'Cancelled by user';
            }
            if (formData.size === 0) {
                formData.set('_', uri);
            }
        }
        return await this.buildJobParam(uri, formData, delay);
    }

    async executeScript(text: string): Promise<string> {
        // logger.debug(text);
        const body = {
            script: text
        };
        const result = await this._jenkins._postFormEncoded<string>('scriptText', body);
        return result && typeof result === 'string' ? result.trim() : result;
    }

    async executeScriptObject(text: string): Promise<any> {
        return this.executeScript(text);
    }

    async restart(): Promise<string> {
        return await this._jenkins._post<string>(
            'safeRestart'
        );
    }

    async getJobLog(url: string, buildNumber: number): Promise<string> {
        const uri = this.extractUrl(url);
        return await this._jenkins._post<string>(
            `${uri}/${buildNumber}/consoleText`
        );
    }

    async createJobInput(data: any, viewName: string = 'all') {
        const name = await vscode.window.showInputBox({
            title: 'Job',
            prompt: 'Enter job name'
        }).then((val) => {
            return val;
        });
        if (name) {
            return await this.createJob(data, name, viewName);
        } else {
            return 'Cancelled creating job';
        }
    }

    async createJob(data: any, jobName: string, viewName: string = 'all') {
        if (jobName) {
            console.log(`createJob:: name <${jobName}>`);
            return await this._jenkins._create<string>(
                `view/${viewName}/createItem?name=${jobName}`, data
            );
        } else {
            return 'Cancelled creating job';
        }
    }

    async createPipelineJob(jobName: string, viewName: string = 'all') {
        const snippetItem = await this.snippetSvc.invokeSnippet(Constants.SNIPPET_CREATE_PIPELINE_SCM.toUpperCase());
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace(/__APP_NAME__/g, jobName);
        }
        console.log(`createPipelineJob:: name <${jobName}> data <${data}>`);

        if (data) {
            console.log(`createPipelineJob:: name <${jobName}>`);
            const result = await this._jenkins._create<string>(
                `view/${viewName}/createItem?name=${jobName}`, data
            );
            return result === '' ? true : false;
        } else {
            return 'Cancelled creating job';
        }
    }

    async createFolder(folderName: string | undefined, viewName: string = 'all') {
        if (!folderName) {
            folderName = await vscode.window.showInputBox({
                title: 'Folder name',
                prompt: 'Enter to create Folder name'
            }).then((val) => {
                return val;
            });
        }
        if (folderName) {
            let createFolder = JenkinsConfiguration.createSnippetFolder;
            const snippetItem = await this.snippetSvc.invokeSnippet(createFolder.toUpperCase());
            let data: string | undefined;
            if (snippetItem && snippetItem.body) {
                data = snippetItem.body.join('\n').replace('__NAME__', folderName);
            }
            console.log(`createFolder:: name <${folderName}> data <${data}>`);

            const result = await this._jenkins._create<string>(
                `createItem?name=${folderName}&mode=${JobModelType.folder.toString()}`, data
            );
            return result === '' ? true : false;
        } else {
            return 'Cancelled creating view';
        }
    }

    async createShortcut(shortcutName: string, url: string, viewName: string = 'all') {
        const snippetItem = await this.snippetSvc.invokeSnippet(Constants.SNIPPET_CREATE_SHORTCUT.toUpperCase());
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__URL__', url);
        }
        console.log(`createShortcut:: name <${shortcutName}> data <${data}>`);

        if (data) {
            console.log(`createShortcut:: name <${shortcutName}>`);
            const result = await this._jenkins._create<string>(
                `view/${viewName}/createItem?name=${shortcutName}`, data
            );
            return result === '' ? true : false;
        } else {
            return false;
        }
    }

    async updateJobConfig(name: string, data: any): Promise<string> {
        console.log(`updateJobConfig:: name <${name}> data <${data}>`);
        return await this._jenkins._create<string>(
            `job/${name}/config.xml`, data
        );
    }

    async deleteJob(url: string): Promise<string> {
        const uri = this.extractUrl(url);
        const result = await this._jenkins._post<string>(
            `${uri}/doDelete`
        );
        return result;
    }

    async deleteJobWithUri(uri: string): Promise<string> {
        const result = await this._jenkins._post<string>(
            `${uri}/doDelete`
        );
        return result;
    }

    async copyJob(job: JobsModel, name: string): Promise<boolean> {
        const existed = await this.checkJobName(name);
        if (!existed) {
            throw new Error(vscode.l10n.t('Job <{0}> is exist', name));
        }

        // const uri = this.extractUrl(job.url);
        const mode = 'copy';
        const result = await this._jenkins._post<string>(
            `createItem?name=${name}&mode=${mode}&from=${job.name}`
        );
        return result ? true : false;
    }

    async moveJobUrl(jobUrl: string, newJobName: string): Promise<boolean> {
        const uri = this.extractUrl(jobUrl);
        return this.moveJob(uri, newJobName);
    }

    async moveJob(uri: string, newJobName: string): Promise<boolean> {
        // let destName = path.join(path.dirname(uri), newJobName, `job/${path.basename(uri)}`);
        // destName = destName.replace(/\\/g, '/');
        // if (destName.charAt(0) === '/') {
        //     destName = destName.substring(1);
        // }
        // const existed = await this.checkJobName(destName);
        // if (!existed) {
        //     throw new Error(vscode.l10n.t('Job <{0}> is exist', destName));
        // }

        if (newJobName === '/') {
            newJobName = '';
        }

        const result = await this._jenkins._post<string>(
            `${uri}/move/move?destination=/${newJobName}`
        );
        return result.includes('status code') ? false : true;
    }

    async renameJobUrl(jobUrl: string, newName: string): Promise<boolean> {
        const uri = this.extractUrl(jobUrl);
        return this.renameJob(uri, newName);
    }

    async renameJob(uri: string, newName: string): Promise<boolean> {
        const existed = await this.checkJobName(newName);
        if (!existed) {
            throw new Error(vscode.l10n.t('Job <{0}> is exist', newName));
        }

        const result = await this._jenkins._post<string>(
            `${uri}/doRename?newName=${newName}`
        );
        return result.includes('status code') ? false : true;
    }

    async enabledJob(job: JobsModel, flag: boolean = true): Promise<string> {
        const uri = this.extractUrl(job.url) + '/' + (flag ? 'enable' : 'disable');
        return await this._jenkins._post<string>(
            `${uri}`
        );
    }

    async getRssAll() {
        const result = await this._jenkins._get<string>(
            `rssAll`
        );
        const feed = parseXmlData(result) as JenkinsFeed;
        return feed;
    }

    async validateJenkinsfile(content: string): Promise<string> {
        const formData = new FormData();
        const html = decode(content);
        formData.append('jenkinsfile', html);
        // logger.info(`formData <${formData}>`);

        return await this._jenkins._postForm<string>(
            `pipeline-model-converter/validate`, formData
        );
    }

}
