// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { RUST_HELPER_MODULE, RUST_HELPER_NAME } from "./rustPrelude";

const START_MARKER: string = "@lc code=start";
const END_MARKER: string = "@lc code=end";

/**
 * 把 LeetCode 生成的初始代码改造成可以直接编译运行的代码.
 *
 * 辅助代码集中在同目录的 lc_local.rs 里, 题目文件只保留 include 与自己的 main:
 *
 *     <题目标注注释>
 *     include!("lc_local.rs");    <- 位于标记之外, 不会提交
 *     use self::lc_local::Solution;
 *     // @lc code=start
 *     impl Solution {...};        <- 提交给 LeetCode 的只有这一段
 *     // @lc code=end
 *     fn main() {...}             <- 运行入口, 位于标记之外
 *
 * 关键约束: 提交与测试时 CLI 只截取两个标记之间的内容, 因此 include, use 与 main
 * 都必须放在标记之外, 否则会随解答一起提交给判题机.
 *
 * 运行入口只留一句提示, 测试用例由使用者自己补充.
 * 另外方法体不动: Rust 里有返回值的空函数体本身编译不过, 解答写好后即可编译运行.
 */
export function generateRunnableRust(code: string, fileName: string): string {
    const lines: string[] = code.split(/\r?\n/);
    const startLine: number = lines.findIndex((line: string) => line.indexOf(START_MARKER) >= 0);
    const endLine: number = lines.findIndex((line: string) => line.indexOf(END_MARKER) >= 0);
    if (startLine < 0 || endLine < 0 || endLine < startLine) {
        // 标记不完整时保持原样, 避免破坏非标准内容
        return code;
    }

    // 只看真正的代码, 模板里被注释掉的 ListNode / TreeNode 定义不算数
    const codeOnly: string = stripRustComments(code);
    const definesListNode: boolean = definesType(codeOnly, "ListNode");
    const definesTreeNode: boolean = definesType(codeOnly, "TreeNode");
    const definesSolution: boolean = definesType(codeOnly, "Solution");

    const helperPrefix: string = `use self::${RUST_HELPER_MODULE}::`;
    const helperNames: string[] = [];
    if (mentionsName(codeOnly, "Solution") && !definesSolution) {
        helperNames.push("Solution");
    }
    if (mentionsName(codeOnly, "ListNode") && !definesListNode) {
        helperNames.push("ListNode");
    }
    if (mentionsName(codeOnly, "TreeNode") && !definesTreeNode) {
        helperNames.push("TreeNode");
    }

    const before: string[] = lines.slice(0, startLine);
    while (before.length > 0 && before[before.length - 1].trim().length === 0) {
        before.pop();
    }

    const result: string[] = [];
    result.push(...before);
    result.push("");
    result.push("// ---- 本地编译与运行辅助代码, 位于 @lc 标记之外, 不会提交到 LeetCode ----");
    result.push(`include!("${RUST_HELPER_NAME}");`);
    if (helperNames.length === 1) {
        result.push(`${helperPrefix}${helperNames[0]};`);
    } else if (helperNames.length > 1) {
        result.push(`${helperPrefix}{${helperNames.join(", ")}};`);
    }
    // 二叉树题目要用到 Rc 与 RefCell, 模板里没写 use 时补上
    if (mentionsName(codeOnly, "Rc") && !hasUseOf(codeOnly, "Rc")) {
        result.push("use std::rc::Rc;");
    }
    if (mentionsName(codeOnly, "RefCell") && !hasUseOf(codeOnly, "RefCell")) {
        result.push("use std::cell::RefCell;");
    }
    result.push("");
    result.push(...lines.slice(startLine, endLine + 1));
    result.push("");
    result.push("// #region 本地运行入口 (位于 @lc 标记之外, 不会提交)");
    result.push(...buildMain(fileName).split("\n"));
    result.push("// #endregion");
    const trailing: string[] = lines.slice(endLine + 1).filter((line: string) => line.trim().length > 0);
    if (trailing.length > 0) {
        result.push("");
        result.push(...trailing);
    }
    return `${result.join("\n").replace(/\n+$/, "")}\n`;
}

/** 去掉行注释与块注释, 用于判断模板自身到底定义和使用过哪些名字. */
function stripRustComments(code: string): string {
    const withoutBlockComments: string = code.replace(/\/\*[\s\S]*?\*\//g, " ");
    return withoutBlockComments.replace(/\/\/[^\n]*/g, " ");
}

/** 判断代码里是否定义了某个结构体或枚举. */
function definesType(codeOnly: string, name: string): boolean {
    return new RegExp(`\\b(?:struct|enum)\\s+${name}\\b`).test(codeOnly);
}

/** 判断代码里是否用到了某个名字. */
function mentionsName(codeOnly: string, name: string): boolean {
    return new RegExp(`\\b${name}\\b`).test(codeOnly);
}

/** 判断代码里是否已经有 use 语句引入了某个名字, 例如 use std::rc::Rc; */
function hasUseOf(codeOnly: string, name: string): boolean {
    const statements: RegExpMatchArray | null = codeOnly.match(/use\s[^;]*;/g);
    if (!statements) {
        return false;
    }
    return statements.some((statement: string) => new RegExp(`\\b${name}\\b`).test(statement));
}

/** 编译运行命令, 文件名不常见时加上引号. */
function commandHint(fileName: string): string {
    const plain: boolean = /^[A-Za-z0-9_.-]+\.rs$/.test(fileName);
    const source: string = plain ? fileName : `"${fileName}"`;
    const binaryName: string = fileName.replace(/\.rs$/, "");
    const binary: string = plain ? binaryName : `"${binaryName}"`;
    return `rustc --edition 2021 ${source} -o ${binary} && ./${binary}`;
}

/**
 * 生成运行入口.
 *
 * 入口里只留一句提示: 自动构造的用例与实际题型容易对不上, 由使用者按题意补充更清楚.
 * 需要从标准输入读用例时可以用 lc_local::read_stdin() 与 lc_local::Reader.
 */
function buildMain(fileName: string): string {
    return [
        "// 这里留空入口, 请补充自己的测试用例.",
        "// 需要从标准输入读取时可以用 lc_local::read_stdin() 与 lc_local::Reader.",
        "// 编译运行:",
        `//   ${commandHint(fileName)}`,
        "fn main() {",
        `    println!("请在上面的 main 中补充自己的测试用例并调用.");`,
        "}",
    ].join("\n");
}
