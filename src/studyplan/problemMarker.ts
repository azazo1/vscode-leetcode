// Copyright (c) azazo1. All rights reserved.
// Licensed under the MIT license.

import * as fse from "fs-extra";
import { IStudyPlanPosition, studyPlanManager } from "./studyPlanManager";

/**
 * 注释标记的格式, 与具体题单无关:
 *
 *     <comment> @lc plan=<slug> group=<name> pos=<index>/<total> next=<id>
 *
 * - plan 是官方题单的 slug, 换一个题单只会改变这个值
 * - group 是官方分组名, 题单没有分组时省略; 名称含空格时用双引号包裹
 * - pos 是题目在整个题单中的位置, next 是题单中的下一题, 最后一题省略 next
 *
 * 标记写在 `@lc code=start` 之前, 不会被 CLI 当作待提交代码, 也不影响原有的 `@lc` 头注释.
 */
const MARKER_KEY: string = "@lc plan=";

/**
 * 为新生成的题目文件写入题单标记.
 *
 * 只应在文件刚刚由 CLI 生成时调用: 标记是生成时的快照, 之后官方题单变化不会自动改写已有文件.
 * 文件里已经存在标记时不会重复写入.
 */
export async function insertStudyPlanMarkers(filePath: string, language: string, problemId: string): Promise<void> {
    const positions: IStudyPlanPosition[] = studyPlanManager.getPositions(problemId);
    if (positions.length === 0) {
        return;
    }

    const content: string = await fse.readFile(filePath, "utf8");
    if (content.indexOf(MARKER_KEY) >= 0) {
        return;
    }
    const codeStartIndex: number = content.indexOf("@lc code=start");
    if (codeStartIndex < 0) {
        return;
    }

    const eol: string = content.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    const commentPrefix: string = getCommentPrefix(language);
    const markers: string[] = positions.map((position: IStudyPlanPosition) => {
        const parts: string[] = [
            `${commentPrefix} ${MARKER_KEY}${position.slug}`,
        ];
        if (position.group) {
            parts.push(`group=${encodeMarkerValue(position.group)}`);
        }
        parts.push(`pos=${position.index}/${position.total}`);
        if (position.nextId) {
            parts.push(`next=${position.nextId}`);
        }
        return parts.join(" ");
    });

    const lineStart: number = content.lastIndexOf("\n", codeStartIndex) + 1;
    const updated: string = content.slice(0, lineStart)
        + markers.join(eol)
        + eol
        + content.slice(lineStart);
    await fse.writeFile(filePath, updated);
}

function getCommentPrefix(language: string): string {
    switch (language) {
        case "bash":
        case "python":
        case "python3":
        case "ruby":
            return "#";
        case "mysql":
            return "--";
        default:
            return "//";
    }
}

function encodeMarkerValue(value: string): string {
    return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
