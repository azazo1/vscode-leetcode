// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { buildRunnerPrelude, RUNNER_HEADER_NAME } from "./cppPrelude";

const START_MARKER: string = "@lc code=start";
const END_MARKER: string = "@lc code=end";

/**
 * 把 LeetCode 生成的初始代码改造成可以直接编译运行的代码.
 *
 * useSharedHeader 为 true 时 (默认), 辅助代码放在同目录的 lc_local.h 里,
 * 题目文件只保留 include 与自己的 main:
 *
 *     <题目标注注释>
 *     #include "lc_local.h"    <- 位于标记之外, 不会提交
 *     using namespace std;
 *     // @lc code=start
 *     class Solution {...};    <- 提交给 LeetCode 的只有这一段
 *     // @lc code=end
 *     int main() {...}         <- 运行入口, 位于标记之外
 *
 * 为 false 时退回把辅助代码整段内联进题目文件.
 *
 * 关键约束: 提交与测试时 CLI 只截取两个标记之间的内容, 因此 include 与 main
 * 都必须放在标记之外, 否则会随解答一起提交给判题机.
 *
 * 运行入口只留一句提示, 测试用例由使用者自己补充, 不做自动构造与调用.
 */
export function generateRunnableCpp(code: string, useSharedHeader: boolean = true): string {
    const lines: string[] = code.split(/\r?\n/);
    const startLine: number = lines.findIndex((line: string) => line.indexOf(START_MARKER) >= 0);
    const endLine: number = lines.findIndex((line: string) => line.indexOf(END_MARKER) >= 0);
    if (startLine < 0 || endLine < 0 || endLine < startLine) {
        // 标记不完整时保持原样, 避免破坏非标准内容
        return code;
    }

    const selfDefinesListNode: boolean = definesType(code, "ListNode");
    const selfDefinesTreeNode: boolean = definesType(code, "TreeNode");

    const result: string[] = [];
    result.push(...lines.slice(0, startLine));
    if (useSharedHeader) {
        // 题目自身有定义时, 让头文件跳过它那份, 避免重复定义
        if (selfDefinesListNode) {
            result.push("#define LC_LOCAL_NO_LISTNODE");
        }
        if (selfDefinesTreeNode) {
            result.push("#define LC_LOCAL_NO_TREENODE");
        }
        result.push(`#include "${RUNNER_HEADER_NAME}"`);
        result.push("");
        result.push("using namespace std;");
        result.push("");
    } else {
        result.push(...buildRunnerPrelude(!selfDefinesListNode, !selfDefinesTreeNode).split("\n"));
    }
    result.push(...lines.slice(startLine, endLine + 1));
    result.push("");
    result.push("// #region 本地运行入口 (位于 @lc 标记之外, 不会提交)");
    result.push(...buildMain().split("\n"));
    result.push("// #endregion");
    const trailing: string[] = lines.slice(endLine + 1).filter((line: string) => line.trim().length > 0);
    if (trailing.length > 0) {
        result.push("");
        result.push(...trailing);
    }
    return `${result.join("\n").replace(/\n+$/, "")}\n`;
}

/** 判断题目代码自身是否已经定义了某个结构体 (注释里的定义不算). */
function definesType(code: string, name: string): boolean {
    const withoutBlockComments: string = code.replace(/\/\*[\s\S]*?\*\//g, " ");
    const withoutLineComments: string = withoutBlockComments.replace(/\/\/[^\n]*/g, " ");
    return new RegExp(`\\b(?:struct|class)\\s+${name}\\b`).test(withoutLineComments);
}

/**
 * 生成运行入口.
 *
 * 入口里只留一句提示: 自动构造的用例与实际题型容易对不上, 由使用者按题意补充更清楚.
 * 需要从标准输入读用例时可以用 lc_local::readStdin() 与 lc_local::readNext<T>().
 */
function buildMain(): string {
    return [
        "// 这里留空入口, 请补充自己的测试用例.",
        "// 需要从标准输入读取时可以用 lc_local::readStdin() 与 lc_local::readNext<T>().",
        "int main() {",
        String.raw`    std::cout << "请在上面的 main 中补充自己的测试用例并调用." << std::endl;`,
        "    return 0;",
        "}",
    ].join("\n");
}
