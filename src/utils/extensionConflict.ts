// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

/**
 * 原插件的扩展 id.
 *
 * 本扩展是它的分支, 两者注册相同的 leetcode.* 命令, 声明同名的资源管理器视图 (leetCodeExplorer),
 * 并共用同一个配置文件与题目目录, 因此不能同时启用.
 */
export const ORIGINAL_EXTENSION_ID: string = "LeetCode.vscode-leetcode";

export interface IExtensionConflict {
    installed: boolean;
    /** 已安装并且当前正在运行 */
    active: boolean;
}

/**
 * 检测原插件.
 *
 * Extension API 只暴露 isActive, 没有查询 "是否被禁用" 的接口,
 * 因此只能区分未安装与已安装, 已安装时再按是否正在运行细化.
 */
export function detectExtensionConflict(): IExtensionConflict {
    const found: vscode.Extension<unknown> | undefined = vscode.extensions.getExtension(ORIGINAL_EXTENSION_ID);
    if (!found) {
        return { installed: false, active: false };
    }
    return { installed: true, active: found.isActive };
}

/**
 * 检查与原插件的冲突并提示用户.
 *
 * 返回 false 表示应当中止激活:
 * 原插件正在运行时双方的命令与视图会互相覆盖, 继续激活只会得到行为不确定的界面.
 */
export async function guardAgainstOriginalExtension(): Promise<boolean> {
    const conflict: IExtensionConflict = detectExtensionConflict();
    if (!conflict.installed) {
        return true;
    }

    if (conflict.active) {
        await vscode.window.showErrorMessage(
            `本扩展与 ${ORIGINAL_EXTENSION_ID} 不兼容. `
            + "两者会注册相同的命令和题目列表视图, 无法同时运行. "
            + `请在本扩展与 ${ORIGINAL_EXTENSION_ID} 之间只保留一个, 然后重新加载窗口.`,
        );
        return false;
    }

    // 已安装但未运行: 无法判断它只是尚未激活, 还是被禁用了, 因此只提示不中止
    await vscode.window.showWarningMessage(
        `检测到已安装 ${ORIGINAL_EXTENSION_ID}, 本扩展与它不兼容. `
        + "同时启用会互相覆盖命令与题目列表, 建议卸载或禁用它再使用本扩展.",
    );
    return true;
}
