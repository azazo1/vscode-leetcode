// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { buildRunnerPrelude, RUNNER_HEADER_NAME } from "./cppPrelude";
import { CppKind, ICppMethod, ICppParameter, ICppType, parseSolutionMethod } from "./cppSignature";

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
 */
export function generateRunnableCpp(code: string, useSharedHeader: boolean = true): string {
    const lines: string[] = code.split(/\r?\n/);
    const startLine: number = lines.findIndex((line: string) => line.indexOf(START_MARKER) >= 0);
    const endLine: number = lines.findIndex((line: string) => line.indexOf(END_MARKER) >= 0);
    if (startLine < 0 || endLine < 0 || endLine < startLine) {
        // 标记不完整时保持原样, 避免破坏非标准内容
        return code;
    }

    const method: ICppMethod | undefined = parseSolutionMethod(code);
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
    result.push(...(method ? buildMain(method) : buildPlaceholderMain()).split("\n"));
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

/** 判断类型 (含嵌套元素) 是否属于可自动生成读入代码的范围. */
function isSupported(type: ICppType): boolean {
    if (type.kind === CppKind.Vector) {
        return type.element ? isSupported(type.element) : false;
    }
    return true;
}

/** 类型映射成 C++ 声明文本. */
export function cppTypeText(type: ICppType): string {
    switch (type.kind) {
        case CppKind.Int:
            return "int";
        case CppKind.Long:
            return "long long";
        case CppKind.Float:
            return "float";
        case CppKind.Double:
            return "double";
        case CppKind.Bool:
            return "bool";
        case CppKind.Char:
            return "char";
        case CppKind.String:
            return "std::string";
        case CppKind.ListNode:
            return "ListNode*";
        case CppKind.TreeNode:
            return "TreeNode*";
        case CppKind.Vector: {
            const element: string = type.element ? cppTypeText(type.element) : "int";
            // 嵌套模板的 ">>" 在老标准下需要空格分开
            const separator: string = element.endsWith(">") ? " >" : ">";
            return `std::vector<${element}${separator}`;
        }
        default:
            return "void";
    }
}

/** 给出一个可直接照抄的输入样例. */
function sampleHint(type: ICppType): string {
    switch (type.kind) {
        case CppKind.Int:
        case CppKind.Long:
            return "0";
        case CppKind.Float:
        case CppKind.Double:
            return "0.0";
        case CppKind.Bool:
            return "true";
        case CppKind.Char:
            return "\"a\"";
        case CppKind.String:
            return "\"abc\"";
        case CppKind.ListNode:
            return "[1,2,3]";
        case CppKind.TreeNode:
            return "[3,9,20,null,null,15,7]";
        case CppKind.Vector: {
            if (!type.element) {
                return "[1,2,3]";
            }
            if (type.element.kind === CppKind.Vector) {
                return "[[1,2],[3,4]]";
            }
            return `[${sampleHint(type.element)},${sampleHint(type.element)}]`;
        }
        default:
            return "";
    }
}

function buildMain(method: ICppMethod): string {
    for (const parameter of method.constructorParameters.concat(method.parameters)) {
        if (!isSupported(parameter.type)) {
            return buildPlaceholderMain();
        }
    }
    if (method.returnType.kind !== CppKind.Void && !isSupported(method.returnType)) {
        return buildPlaceholderMain();
    }

    // 参数的顺序与样例放在注释里, 运行时的提示只指向这里, 避免 main 里堆一大段输出
    const hint: string = method.constructorParameters.concat(method.parameters)
        .map((parameter: ICppParameter) => `${parameter.name}=${sampleHint(parameter.type)}`)
        .join(", ");
    const body: string[] = [`// 输入顺序 (每行一个): ${hint}`];

    body.push("int main() {");
    body.push("    lc_local::Reader reader(lc_local::readStdin(std::cin));");
    body.push("    if (reader.empty()) {");
    body.push("        return 0;");
    body.push("    }");

    // 构造函数需要参数时, 必须先读入这些参数再构造对象
    // (例如 NumArray 没有默认构造函数, 直接声明对象无法编译)
    for (const parameter of method.constructorParameters) {
        body.push(`    auto ${parameter.name} = lc_local::readNext<${cppTypeText(parameter.type)}>(reader);`);
    }
    if (method.constructorParameters.length > 0) {
        const constructorArguments: string = method.constructorParameters
            .map((parameter: ICppParameter) => parameter.name)
            .join(", ");
        body.push(`    ${method.className} solution(${constructorArguments});`);
    } else {
        body.push(`    ${method.className} solution;`);
    }

    for (const parameter of method.parameters) {
        body.push(`    auto ${parameter.name} = lc_local::readNext<${cppTypeText(parameter.type)}>(reader);`);
    }

    const argumentsText: string = method.parameters.map((parameter: ICppParameter) => parameter.name).join(", ");
    const call: string = `solution.${method.name}(${argumentsText})`;

    if (method.returnType.kind === CppKind.Void) {
        body.push(`    ${call};`);
        const printed: ICppParameter | undefined = method.parameters.find(
            (parameter: ICppParameter) => parameter.type.kind === CppKind.Vector,
        );
        if (printed) {
            // 返回值为 void 时按 LeetCode 的约定打印被就地修改的参数
            body.push(`    lc_local::print(${printed.name});`);
        } else {
            body.push(String.raw`    std::cout << "该题目没有返回值, 也没有可打印的参数." << std::endl;`);
        }
    } else {
        body.push(`    lc_local::print(${call});`);
    }

    body.push("    return 0;");
    body.push("}");
    return body.join("\n");
}

/**
 * 设计类题目 (例如 LRU 缓存) 有多个方法, 需要按调用序列测试, 无法通用生成入口.
 * 这里给出一个空入口, 保证文件依然能够编译和链接.
 */
function buildPlaceholderMain(): string {
    return [
        "// 设计类题目需要按调用序列测试, 这里留空入口, 请自行构造用例:",
        "//   LRUCache cache(2);",
        "//   cache.put(1, 1);",
        "//   std::cout << cache.get(1) << std::endl;",
        "int main() {",
        String.raw`    std::cout << "请在上面的 main 中手动构造用例并调用." << std::endl;`,
        "    return 0;",
        "}",
    ].join("\n");
}
