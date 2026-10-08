// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import * as path from "path";
import * as vscode from "vscode";
import { IQuickItemEx } from "../shared";
import { getWorkspaceFolder } from "./settingUtils";
import * as wsl from "./wslUtils";

export async function selectWorkspaceFolder(): Promise<string> {
    let workspaceFolderSetting: string = getWorkspaceFolder();
    if (workspaceFolderSetting.trim() === "") {
        // 未显式配置保存位置时, 默认使用当前打开的工作区, 而不是所有项目共用一个固定目录
        const currentWorkspaceFolder: string | undefined = await resolveCurrentWorkspaceFolder();
        if (!currentWorkspaceFolder) {
            // 用户取消了选择, 或者当前没有打开工作区 (此时 resolveCurrentWorkspaceFolder 已经给出提示)
            return "";
        }
        workspaceFolderSetting = currentWorkspaceFolder;
    }

    let needAsk: boolean = true;
    await fse.ensureDir(workspaceFolderSetting);
    for (const folder of vscode.workspace.workspaceFolders || []) {
        if (isSubFolder(folder.uri.fsPath, workspaceFolderSetting)) {
            needAsk = false;
        }
    }

    if (needAsk) {
        const choice: string | undefined = await vscode.window.showQuickPick(
            [
                OpenOption.justOpenFile,
                OpenOption.openInCurrentWindow,
                OpenOption.openInNewWindow,
                OpenOption.addToWorkspace,
            ],
            { placeHolder: "The LeetCode workspace folder is not opened in VS Code, would you like to open it?" },
        );

        // Todo: generate file first
        switch (choice) {
            case OpenOption.justOpenFile:
                return workspaceFolderSetting;
            case OpenOption.openInCurrentWindow:
                await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolderSetting), false);
                return "";
            case OpenOption.openInNewWindow:
                await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFolderSetting), true);
                return "";
            case OpenOption.addToWorkspace:
                vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, { uri: vscode.Uri.file(workspaceFolderSetting) });
                break;
            default:
                return "";
        }
    }

    return wsl.useWsl() ? wsl.toWslPath(workspaceFolderSetting) : workspaceFolderSetting;
}

/**
 * 解析保存题目文件所用的当前工作区目录.
 *
 * 返回 undefined 表示无法确定保存位置, 可能是用户取消了选择,
 * 也可能是当前没有打开任何工作区 (这种情况会弹出提示).
 */
async function resolveCurrentWorkspaceFolder(): Promise<string | undefined> {
    const folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showWarningMessage(
            "No folder is opened in VS Code, so the problem file cannot be saved. "
            + "Please open a folder first, or set 'leetcode.workspaceFolder' to specify the location.",
        );
        return undefined;
    }

    if (folders.length === 1) {
        return folders[0].uri.fsPath;
    }

    // 多根工作区无法确定唯一目标, 交给用户选择
    const picks: Array<IQuickItemEx<string>> = folders.map((folder: vscode.WorkspaceFolder) => ({
        label: folder.name,
        detail: folder.uri.fsPath,
        value: folder.uri.fsPath,
    }));
    const choice: IQuickItemEx<string> | undefined = await vscode.window.showQuickPick(picks, {
        placeHolder: "Select a workspace folder to store the problem files",
        ignoreFocusOut: true,
    });
    return choice ? choice.value : undefined;
}

export async function getActiveFilePath(uri?: vscode.Uri): Promise<string | undefined> {
    let textEditor: vscode.TextEditor | undefined;
    if (uri) {
        textEditor = await vscode.window.showTextDocument(uri, { preview: false });
    } else {
        textEditor = vscode.window.activeTextEditor;
    }

    if (!textEditor) {
        return undefined;
    }
    if (textEditor.document.isDirty && !await textEditor.document.save()) {
        vscode.window.showWarningMessage("Please save the solution file first.");
        return undefined;
    }
    return wsl.useWsl() ? wsl.toWslPath(textEditor.document.uri.fsPath) : textEditor.document.uri.fsPath;
}

function isSubFolder(from: string, to: string): boolean {
    const relative: string = path.relative(from, to);
    if (relative === "") {
        return true;
    }
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

enum OpenOption {
    justOpenFile = "Just open the problem file",
    openInCurrentWindow = "Open in current window",
    openInNewWindow = "Open in new window",
    addToWorkspace = "Add to workspace",
}
