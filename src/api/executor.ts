import FormData from 'form-data';
import { decode } from 'html-entities';
import { initial } from 'lodash';
import * as vscode from 'vscode';
import JenkinsConfiguration, { JenkinsServer } from '../config/settings';
import { ParametersDefinitionProperty } from '../types/jenkins-types';
import { AllViewModel, BaseJobModel, BuildDetailStatus, BuildsModel, JenkinsInfo, JobModelType, JobProperty, JobsModel } from "../types/model";
import { mapToUrlParams } from '../utils/html';
import logger from '../utils/logger';
import { getParameterDefinition } from '../utils/model-utils';
import { invokeSnippet, invokeSnippetJenkins } from '../utils/util';
import { Jenkins } from "./jenkins";

export class Executor {

    [key: string]: Function | Jenkins | JenkinsServer | vscode.ExtensionContext;

    private _jenkins: Jenkins;

    constructor(private readonly context: vscode.ExtensionContext, private readonly server: JenkinsServer) {
        this._jenkins = new Jenkins(server);
    }

    public async initialized() {
        return await this._jenkins.initialized();
    }

    public isConnected() {
        return this.initialized();
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

    async createView() {
        const name = await vscode.window.showInputBox({ prompt: 'Enter view name' }).then((val) => {
            return val;
        });
        if (name) {
            const categorizedEnabled = JenkinsConfiguration.categorizedEnabled;
            let createView = categorizedEnabled ? JenkinsConfiguration.createSnippetView : 'c_view_listview';
            const snippetItem = await invokeSnippet(this.context, createView.toUpperCase());
            let data: string | undefined;
            if (snippetItem && snippetItem.body) {
                data = snippetItem.body.join('\n').replace('__NAME__', name);
            }
            console.log(`createView:: name <${name}> data <${data}>`);

            return await this._jenkins._create<string>(
                `createView?name=${name}`, data
            );
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

        const data = `def jenkins = Jenkins.getInstanceOrNull(); def view = jenkins.getView('${name}');view.rename('${newViewName}')`;
        const result = await this.executeScript(data);
        return result;
    }

    async createUser(username: string, password: string, role: string = 'USER') {
        const snippetItem = await invokeSnippetJenkins(this.context, 'create_user');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__ROLE__', role)
                .replace('__USERNAME__', username)
                .replace('__PASSWORD__', password);
        }

        console.log(`createUser:: username <${username}> role <${role}>`);
        return data && await this.executeScript(data);
    }

    async createCredential(username: string, password: string, kind: string) {
        const snippetItem = await invokeSnippetJenkins(this.context, 'createCredential');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__KIND__', kind)
                .replace('__USERNAME__', username)
                .replace('__PASSWORD__', password);
        }

        console.log(`createCredential:: username <${username}> kind <${kind}>`);
        return data && await this.executeScript(data);
    }

    async getExecutor() {
        const data = 'Jenkins jenkins = Jenkins.getInstance();jenkins.getNumExecutors()';
        const result = await this.executeScript(data);
        return result ? result.split(':').pop()?.trim() : result;
    }

    async changeExecutor(numExecutors: string) {
        const data = `Jenkins jenkins = Jenkins.getInstance();jenkins.setNumExecutors(${numExecutors});jenkins.save();jenkins.getNumExecutors()`;
        const result = await this.executeScript(data);
        return result ? result.split(':').pop()!.trim() : result;
    }

    async isAdmin(username: string) {
        const snippetItem = await invokeSnippetJenkins(this.context, 'is_admin');
        let data: string | undefined;
        if (snippetItem && snippetItem.body) {
            data = snippetItem.body.join('\n').replace('__USERNAME__', username);
        }

        console.log(`isAdmin:: username <${username}>`);
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
        // console.log(result);
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
        console.log(`uri <${uri}>`);
        return await this._jenkins._get<BuildDetailStatus>(
            `${uri}/${buildNumber}/api/json`
        );
    };

    async buildJob(name: string, delay: number = 3): Promise<string> {
        if (delay < 1) {
            delay = 1;
        } else if (delay > 99) {
            delay = 99;
        }
        return await this._jenkins._post<string>(
            `job/${name}/build?delay=${delay}sec`
        );
    }

    async buildJobWithForm(job: JobsModel, formData: Map<string, string>, delay: number = 3): Promise<string> {
        // let flag: boolean = true;
        const uri = this.extractUrl(job.url);
        if (delay < 1) {
            delay = 1;
        } else if (delay > 99) {
            delay = 99;
        }

        const jobParams = getParameterDefinition(job.jobDetail ?? undefined);
        if (jobParams && jobParams.length > 0) {
            console.log(formData);
            return await this._jenkins._postFormEncoded<string>(
                `${uri}/buildWithParameters?delay=${delay}sec&${mapToUrlParams(formData)}`
            );
        } else {
            return await this._jenkins._post<string>(
                `${uri}/build?delay=${delay}sec`
            );
        }
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

            return await this._jenkins._postFormEncoded<string>(
                `${uri}/buildWithParameters?delay=${delay}sec&${mapToUrlParams(formData)}`
            );
        } else {
            return await this._jenkins._post<string>(
                `${uri}/build?delay=${delay}sec`
            );
        }
    }

    async executeScript(text: string): Promise<string> {
        const result = await this._jenkins._postFormEncoded<string>(
            'scriptText', {
            script: text
        });
        return result ? result.trim() : result;
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

    async createJob(data: any, viewName: string = 'all') {
        const name = await vscode.window.showInputBox({ prompt: 'Enter job name' }).then((val) => {
            return val;
        });
        if (name) {
            console.log(`createJob:: name <${name}>`);
            return await this._jenkins._create<string>(
                `createItem?name=${name}`, data
            );
        } else {
            return 'Cancelled creating job';
        }
    }

    async createFolder(viewName: string = 'all') {
        const name = await vscode.window.showInputBox({ prompt: 'Enter folder name' }).then((val) => {
            return val;
        });
        if (name) {
            let createFolder = JenkinsConfiguration.createSnippetFolder;
            const snippetItem = await invokeSnippet(this.context, createFolder.toUpperCase());
            let data: string | undefined;
            if (snippetItem && snippetItem.body) {
                data = snippetItem.body.join('\n').replace('__NAME__', name);
            }
            console.log(`createFolder:: name <${name}> data <${data}>`);

            return await this._jenkins._create<string>(
                `createItem?name=${name}&mode=${JobModelType.folder.toString()}`, data
            );
        } else {
            return 'Cancelled creating view';
        }
    }

    async updateJobConfig(name: string, data: any): Promise<string> {
        console.log(`updateJobConfig:: name <${name}> data <${data}>`);
        return await this._jenkins._create<string>(
            `job/${name}/config.xml`, data
        );
    }

    async deleteJob(job: JobsModel): Promise<string> {
        const uri = this.extractUrl(job.url);
        return await this._jenkins._post<string>(
            `${uri}/doDelete`
        );
    }

    async copyJob(job: JobsModel, name: string): Promise<string> {
        const existed = await this.checkJobName(name);
        if (!existed) {
            throw new Error(vscode.l10n.t('Job <{0}> is exist', name));
        }

        const uri = this.extractUrl(job.url);
        const mode = 'copy';
        return await this._jenkins._post<string>(
            `createItem?name=${name}&mode=${mode}&from=${job.name}`
        );
    }

    async moveJob(job: JobsModel, newJob: JobsModel): Promise<string> {
        const name = this.extractUrl(newJob.url);
        const existed = await this.checkJobName(name);
        if (!existed) {
            throw new Error(vscode.l10n.t('Job <{0}> is exist', job.name));
        }

        const uri = this.extractUrl(job.url);
        return await this._jenkins._post<string>(
            `${uri}/move/move?destination=/${newJob.name}`
        );
    }

    async renameJob(job: JobsModel, newName: string): Promise<string> {
        const name = this.extractUrl(newName);
        const existed = await this.checkJobName(name);
        if (!existed) {
            throw new Error(vscode.l10n.t('Job <{0}> is exist', name));
        }

        const uri = this.extractUrl(job.url);
        return await this._jenkins._post<string>(
            `${uri}/doRename?newName=${newName}`
        );
    }

    async enabledJob(job: JobsModel, flag: boolean = true): Promise<string> {
        const uri = this.extractUrl(job.url) + '/' + (flag ? 'enable' : 'disable');
        return await this._jenkins._post<string>(
            `${uri}`
        );
    }

    async validateJenkinsfile(content: string): Promise<string> {
        // console.log(`validateJenkinsfile:: content <${content}>`);
        const formData = new FormData();
        const html = decode(content);
        formData.append('jenkinsfile', html);
        // logger.info(`formData <${formData}>`);

        return await this._jenkins._postForm<string>(
            `pipeline-model-converter/validate`, formData
        );
    }

    notify(mesg: string, type: number = 0) {
        console.log(`notify:: message <${mesg}>`);
        if (mesg === '') {
            mesg = '정상적으로 수행되었습니다';
        } else {
            type = 1;
        }

        if (type === 0 || mesg) {
            vscode.window.showInformationMessage(mesg);
        } else {
            vscode.window.showErrorMessage(mesg);
        }
    }

}
