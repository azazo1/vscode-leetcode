// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import * as path from "path";
import { buildRustHelper, RUST_HELPER_MARKER, RUST_HELPER_NAME } from "./rustPrelude";

/**
 * 辅助文件的名字与位置.
 *
 * 辅助文件与题目文件同目录, 因此题目文件里写 `include!("lc_local.rs")` 即可,
 * 不依赖工作区结构, 也不依赖机器相关的绝对路径.
 */
export function getRustHelperPath(problemFilePath: string): string {
    return path.join(path.dirname(problemFilePath), RUST_HELPER_NAME);
}

/**
 * 确保题目文件所在目录有一份最新的辅助文件.
 *
 * 需要写入时返回辅助文件的绝对路径, 无需改动时返回 undefined.
 */
export async function ensureRustHelper(problemFilePath: string): Promise<string | undefined> {
    const helperPath: string = getRustHelperPath(problemFilePath);
    const content: string = buildRustHelper();

    if (await fse.pathExists(helperPath)) {
        const existing: string = await fse.readFile(helperPath, "utf8");
        if (existing === content) {
            return undefined;
        }
        // 只覆盖由本扩展生成的文件, 避免抹掉用户自己放的同名文件
        const firstLines: string = existing.split("\n", 4).join("\n");
        if (firstLines.indexOf(RUST_HELPER_MARKER) < 0) {
            return undefined;
        }
    }

    await fse.ensureDir(path.dirname(helperPath));
    await fse.writeFile(helperPath, content);
    return helperPath;
}
