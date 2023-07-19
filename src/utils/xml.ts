import { xml2js } from 'xml-js';
import { ViewType } from '../types/jenkins-types';

export function parseXml(xmlString: string): any {
    const options = {
        ignoreComment: true,
        alwaysChildren: true,
        compact: true,
        nativeType: true,
    };

    return xml2js(xmlString, options);
}

export function parseXmlData(xmlString: string): any {
    function nativeType(value: any) {
        var nValue = Number(value);
        if (!isNaN(nValue)) {
            return nValue;
        }
        var bValue = value.toLowerCase();
        if (bValue === 'true') {
            return true;
        } else if (bValue === 'false') {
            return false;
        }
        return value;
    }

    const removeJsonTextAttribute = function (value: any, parentElement: any) {
        try {
            var keyNo = Object.keys(parentElement._parent).length;
            var keyName = Object.keys(parentElement._parent)[keyNo - 1];
            parentElement._parent[keyName] = nativeType(value);
        } catch (e) { }
    };
    const options = {
        compact: true,
        textFn: removeJsonTextAttribute
    };

    return xml2js(xmlString, options);
}

export interface JenkinsPipeline {
}

export interface FlowDefinition extends JenkinsPipeline {
    _declaration: any
    'flow-definition': {
        actions: any
        description: string
        keepDependencies: boolean
        properties: any
        definition: CpsFlowDefinition
        triggers: any
        disabled: {
            _text: boolean
        }
    }
}

export interface CpsFlowDefinition {
    _attributes: {
        _class: string
        _plugin: string
    }
    script: {
        _text: string
    }
    sandbox: boolean
}

export interface Project {
    actions: any
    description: string
    keepDependencies: boolean
    properties: [any]
}

export interface JenkinsView {
}

export interface AllView {
    name: string
    filterExecutors: boolean
    filterQueue: boolean
    properties: any
}

export interface ShortcutJob {
    _declaration: {
        _attributes: {
            version: string;
            encoding: string;
        }
    }
    'com.legrig.jenkins.shortcut.ShortcutJob': {
        _attributes: {
            plugin: string;
        }
        targetUrl: {
            _text: string
        }
        enabled: {
            _text: string
        }
    }
}

export function extractViewnameFromText(xmlContent: string) {
    const xmlData = parseXml(xmlContent);

    let viewModel;
    if (xmlData['org.jenkinsci.plugins.categorizedview.CategorizedJobsView']) {
        viewModel = xmlData['org.jenkinsci.plugins.categorizedview.CategorizedJobsView'];
    } else if (xmlData[ViewType.listView.toString()]) {
        viewModel = xmlData[ViewType.listView.toString()];
    } else {
        viewModel = xmlData[ViewType.allView.toString()];
    }
    return viewModel.name._text;
}

export function isJenkinsView(xmlData: any): xmlData is JenkinsView {
    return xmlData && ((typeof xmlData[ViewType.allView.toString()] === 'object') ||
        (typeof xmlData[ViewType.listView.toString()] === 'object') ||
        (typeof xmlData[ViewType.categorizedJobsView.toString()] === 'object') ||
        (typeof xmlData[ViewType.myView.toString()] === 'object'));
}

export function isJenkinsPipeline(xmlData: any): xmlData is JenkinsPipeline {
    return xmlData && (typeof xmlData['flow-definition'] === 'object');
}
