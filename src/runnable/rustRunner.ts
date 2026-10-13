// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { RUST_HELPER_MODULE, RUST_HELPER_NAME } from "./rustPrelude";
import {
    definesType,
    hasUseOf,
    IRustMethod,
    IRustParameter,
    IRustType,
    mentionsName,
    parseFirstImpl,
    parseSolutionMethod,
    RustBorrow,
    RustKind,
    rustReadType,
    stripRustComments,
} from "./rustSignature";

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
 * 另外 Rust 的模板方法体是空的, 有返回值时空函数体本身就编译不过, 这点与 C++ 不同,
 * 这里不做任何填充, 等解答写好后即可直接编译运行.
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
    result.push(...buildMain(code, fileName, !definesListNode, !definesTreeNode).split("\n"));
    result.push("// #endregion");
    const trailing: string[] = lines.slice(endLine + 1).filter((line: string) => line.trim().length > 0);
    if (trailing.length > 0) {
        result.push("");
        result.push(...trailing);
    }
    return `${result.join("\n").replace(/\n+$/, "")}\n`;
}

/** 判断读取该类型所需的 LcRead 是否已经提供. */
function isReadable(type: IRustType, hasListNode: boolean, hasTreeNode: boolean): boolean {
    switch (type.kind) {
        case RustKind.ListNode:
            return hasListNode;
        case RustKind.TreeNode:
            return hasTreeNode;
        case RustKind.Vector:
            // Vec<&str> 这类带借用元素的类型读不成同样形状的数据, 直接放弃
            if (!type.element || type.element.borrow !== RustBorrow.None) {
                return false;
            }
            return isReadable(type.element, hasListNode, hasTreeNode);
        case RustKind.Unit:
            return false;
        default:
            return true;
    }
}

/** 判断打印该类型所需的 LcShow 是否已经提供. */
function isPrintable(type: IRustType, hasListNode: boolean, hasTreeNode: boolean): boolean {
    if (type.kind === RustKind.Str || type.borrow !== RustBorrow.None) {
        return false;
    }
    return isReadable(type, hasListNode, hasTreeNode);
}

/** 给出一个可直接照抄的输入样例. */
function sampleHint(type: IRustType): string {
    switch (type.kind) {
        case RustKind.Int:
        case RustKind.Long:
            return "0";
        case RustKind.Float:
        case RustKind.Double:
            return "0.0";
        case RustKind.Bool:
            return "true";
        case RustKind.Char:
            return "\"a\"";
        case RustKind.String:
        case RustKind.Str:
            return "\"abc\"";
        case RustKind.ListNode:
            return "[1,2,3]";
        case RustKind.TreeNode:
            return "[3,9,20,null,null,15,7]";
        case RustKind.Vector: {
            if (!type.element) {
                return "[1,2,3]";
            }
            if (type.element.kind === RustKind.Vector) {
                return "[[1,2],[3,4]]";
            }
            return `[${sampleHint(type.element)},${sampleHint(type.element)}]`;
        }
        default:
            return "";
    }
}

/** 传入参数时用的实参文本: 按借用方式决定是否取引用. */
function argumentText(parameter: IRustParameter): string {
    switch (parameter.type.borrow) {
        case RustBorrow.Ref:
            return `&${parameter.name}`;
        case RustBorrow.RefMut:
            return `&mut ${parameter.name}`;
        default:
            return parameter.name;
    }
}

/**
 * 生成运行入口.
 *
 * 参数类型无法自动读写时退回占位入口, 保证文件依然能够编译.
 */
function buildMain(code: string, fileName: string, hasListNode: boolean, hasTreeNode: boolean): string {
    const method: IRustMethod | undefined = parseSolutionMethod(code);
    if (!method) {
        const impl = parseFirstImpl(code);
        if (!impl || impl.className === "Solution") {
            return buildPlaceholderMain(undefined, UNKNOWN_SIGNATURE_HINT);
        }
        return buildPlaceholderMain(impl.className, DESIGN_HINT);
    }

    const readable: boolean = method.parameters.every(
        (parameter: IRustParameter) => isReadable(parameter.type, hasListNode, hasTreeNode),
    );
    const printable: boolean = method.returnType.kind === RustKind.Unit
        || isPrintable(method.returnType, hasListNode, hasTreeNode);
    if (!readable || !printable) {
        return buildPlaceholderMain(undefined, MANUAL_TYPES_HINT);
    }

    const names: string[] = method.parameters.map((parameter: IRustParameter) => parameter.name);
    const pickName = (base: string): string => {
        let name: string = `lc_${base}`;
        while (names.indexOf(name) >= 0) {
            name = `${name}_`;
        }
        return name;
    };
    const inputName: string = pickName("input");
    const readerName: string = pickName("reader");
    const resultName: string = pickName("result");

    const hint: string = method.parameters
        .map((parameter: IRustParameter) => `${parameter.name}=${sampleHint(parameter.type)}`)
        .join(", ");
    const command: string = commandHint(fileName);

    const body: string[] = [];
    // 参数的顺序与样例放在注释里, 运行时的提示只指向这里, 避免 main 里堆一大段输出
    body.push(`// 输入顺序 (每行一个): ${hint}`);
    body.push("// 编译运行:");
    body.push(`//   ${command}`);
    body.push("fn main() {");
    body.push(`    let ${inputName} = ${RUST_HELPER_MODULE}::read_stdin();`);
    body.push(`    if ${inputName}.trim().is_empty() {`);
    body.push("        return;");
    body.push("    }");
    body.push(`    let mut ${readerName} = ${RUST_HELPER_MODULE}::Reader::new(&${inputName});`);
    for (const parameter of method.parameters) {
        const mutability: string = parameter.type.borrow === RustBorrow.RefMut ? "mut " : "";
        body.push(`    let ${mutability}${parameter.name}: ${rustReadType(parameter.type)} = ${readerName}.read();`);
    }

    const call: string = `Solution::${method.name}(${method.parameters.map(argumentText).join(", ")})`;
    if (method.returnType.kind === RustKind.Unit) {
        body.push(`    ${call};`);
        const printed: IRustParameter | undefined = method.parameters.find(
            (parameter: IRustParameter) => parameter.type.kind === RustKind.Vector,
        );
        if (printed) {
            // 返回值为 () 时按 LeetCode 的约定打印被就地修改的参数
            body.push(`    ${RUST_HELPER_MODULE}::print(&${printed.name});`);
        } else {
            body.push(`    println!("该题目没有返回值, 也没有可打印的参数.");`);
        }
    } else {
        body.push(`    let ${resultName} = ${call};`);
        body.push(`    ${RUST_HELPER_MODULE}::print(&${resultName});`);
    }
    body.push("}");
    return body.join("\n");
}

/** 编译运行命令, 文件名不常见时加上引号. */
function commandHint(fileName: string): string {
    const plain: boolean = /^[A-Za-z0-9_.-]+\.rs$/.test(fileName);
    const source: string = plain ? fileName : `"${fileName}"`;
    const binaryName: string = fileName.replace(/\.rs$/, "");
    const binary: string = plain ? binaryName : `"${binaryName}"`;
    return `rustc --edition 2021 ${source} -o ${binary} && ./${binary}`;
}

/** 设计类题目的占位入口提示. */
const DESIGN_HINT: string = "// 设计类题目需要按调用序列测试, 这里留空入口, 请自行构造用例:";

/** 参数类型无法自动读写时的占位入口提示. */
const MANUAL_TYPES_HINT: string = "// 参数类型无法自动读写 (例如题目自带了 ListNode / TreeNode 定义), 请自行构造用例:";

/** 认不出方法签名时的占位入口提示. */
const UNKNOWN_SIGNATURE_HINT: string = "// 未能识别出解答的方法签名, 这里留空入口, 请自行构造用例:";

/**
 * 生成占位入口.
 *
 * 设计类题目按调用序列判题, 参数类型超出可自动读写的范围, 或者签名根本认不出来时,
 * 都给一个空入口, 保证文件依然能够编译运行.
 */
function buildPlaceholderMain(className: string | undefined, hint: string): string {
    const lines: string[] = [hint];
    if (className) {
        lines.push(`//   let mut obj = ${className}::new(2);`);
        lines.push("//   println!(\"{}\", obj.get(1));");
    }
    lines.push("fn main() {");
    lines.push(`    println!("请在上面的 main 中手动构造用例并调用.");`);
    lines.push("}");
    return lines.join("\n");
}
