import * as vscode from 'vscode';
import { Executor } from '../api/executor';
import { showInfoMessageWithTimeout } from "../ui/ui";
import { getSelectionText } from "../utils/editor";
import logger from '../utils/logger';
import { inferFileExtension } from '../utils/util';
import { parseXml } from '../utils/xml';

export class ScriptProvider {

    constructor(protected context: vscode.ExtensionContext) {
        this.context.subscriptions.push(
        );
    }

}