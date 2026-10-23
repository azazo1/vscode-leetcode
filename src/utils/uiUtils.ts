// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { getLeetCodeEndpoint } from "../commands/plugin";
import { leetCodeChannel } from "../leetCodeChannel";
import { getWorkspaceConfiguration } from "./settingUtils";

export namespace DialogOptions {
    export const open: vscode.MessageItem = { title: "Open" };
    export const yes: vscode.MessageItem = { title: "Yes" };
    export const no: vscode.MessageItem = { title: "No", isCloseAffordance: true };
    export const never: vscode.MessageItem = { title: "Never" };
    export const singUp: vscode.MessageItem = { title: "Sign up" };
}

export async function promptForOpenOutputChannel(message: string, type: DialogType): Promise<void> {
    let result: vscode.MessageItem | undefined;
    switch (type) {
        case DialogType.info:
            result = await vscode.window.showInformationMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        case DialogType.warning:
            result = await vscode.window.showWarningMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        case DialogType.error:
            result = await vscode.window.showErrorMessage(message, DialogOptions.open, DialogOptions.no);
            break;
        default:
            break;
    }

    if (result === DialogOptions.open) {
        leetCodeChannel.show();
    }
}

export async function promptForSignIn(): Promise<void> {
    const choice: vscode.MessageItem | undefined = await vscode.window.showInformationMessage(
        "Please sign in to LeetCode.",
        DialogOptions.yes,
        DialogOptions.no,
        DialogOptions.singUp,
    );
    switch (choice) {
        case DialogOptions.yes:
            await vscode.commands.executeCommand("leetcode.signin");
            break;
        case DialogOptions.singUp:
            if (getLeetCodeEndpoint()) {
                openUrl("https://leetcode.cn");
            } else {
                openUrl("https://leetcode.com");
            }
            break;
        default:
            break;
    }
}

/**
 * 判断错误是否是 LeetCode 的登录会话过期.
 *
 * CLI 在提交或测试被服务端判定为未登录时, 会在输出里打印 `session expired, please login again` 并以非零码退出,
 * 扩展拿到的错误对象把这段输出放在 result 里, 所以 message 和 result 都要检查.
 */
export function isSessionExpired(error: unknown): boolean {
    const pattern: RegExp = /session expired, please login again/i;
    if (error instanceof Error && pattern.test(error.message)) {
        return true;
    }
    const result: string | undefined = (error as { result?: string } | undefined)?.result;
    return !!result && pattern.test(result);
}

export async function promptForSessionExpired(): Promise<void> {
    const choice: vscode.MessageItem | undefined = await vscode.window.showWarningMessage(
        "Your LeetCode session has expired. Sign in again to continue.",
        DialogOptions.yes,
        DialogOptions.no,
    );
    if (choice === DialogOptions.yes) {
        await vscode.commands.executeCommand("leetcode.signin");
    }
}

export async function promptHintMessage(config: string, message: string, choiceConfirm: string, onConfirm: () => Promise<any>): Promise<void> {
    if (getWorkspaceConfiguration().get<boolean>(config)) {
        const choiceNoShowAgain: string = "Don't show again";
        const choice: string | undefined = await vscode.window.showInformationMessage(
            message, choiceConfirm, choiceNoShowAgain,
        );
        if (choice === choiceConfirm) {
            await onConfirm();
        } else if (choice === choiceNoShowAgain) {
            await getWorkspaceConfiguration().update(config, false, true /* UserSetting */);
        }
    }
}

export async function openSettingsEditor(query?: string): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", query);
}

export async function openKeybindingsEditor(query?: string): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", query);
}

export async function showFileSelectDialog(fsPath?: string): Promise<vscode.Uri[] | undefined> {
    const defaultUri: vscode.Uri | undefined = getBelongingWorkspaceFolderUri(fsPath);
    const options: vscode.OpenDialogOptions = {
        defaultUri,
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Select",
    };
    return await vscode.window.showOpenDialog(options);
}

function getBelongingWorkspaceFolderUri(fsPath: string | undefined): vscode.Uri | undefined {
    let defaultUri: vscode.Uri | undefined;
    if (fsPath) {
        const workspaceFolder: vscode.WorkspaceFolder | undefined = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
        if (workspaceFolder) {
            defaultUri = workspaceFolder.uri;
        }
    }
    return defaultUri;
}

export async function openUrl(url: string): Promise<void> {
    vscode.commands.executeCommand("vscode.open", vscode.Uri.parse(url));
}

export enum DialogType {
    info = "info",
    warning = "warning",
    error = "error",
}
