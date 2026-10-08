// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import * as path from "path";
import { buildRunnerHeader, RUNNER_HEADER_MARKER, RUNNER_HEADER_NAME } from "./cppPrelude";

/**
 * 公共头文件的名字与位置.
 *
 * 头文件与题目文件同目录, 因此题目文件里写 `#include "lc_local.h"` 即可,
 * 不依赖工作区结构, 也不依赖机器相关的绝对路径.
 */
export function getRunnerHeaderPath(problemFilePath: string): string {
    return path.join(path.dirname(problemFilePath), RUNNER_HEADER_NAME);
}

/**
 * 确保题目文件所在目录有一份最新的公共头文件.
 *
 * 需要更新时返回头文件的绝对路径, 无需改动时返回 undefined.
 */
export async function ensureRunnerHeader(problemFilePath: string): Promise<string | undefined> {
    const headerPath: string = getRunnerHeaderPath(problemFilePath);
    const content: string = buildRunnerHeader();

    if (await fse.pathExists(headerPath)) {
        const existing: string = await fse.readFile(headerPath, "utf8");
        if (existing === content) {
            return undefined;
        }
        // 只覆盖由本扩展生成的文件, 避免抹掉用户自己放的同名头文件
        const firstLines: string = existing.split("\n", 4).join("\n");
        if (firstLines.indexOf(RUNNER_HEADER_MARKER) < 0) {
            return undefined;
        }
    }

    await fse.ensureDir(path.dirname(headerPath));
    await fse.writeFile(headerPath, content);
    return headerPath;
}
