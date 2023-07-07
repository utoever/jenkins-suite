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

export interface FlowDefinition {
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
