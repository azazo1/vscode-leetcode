// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import { buildRunnerPrelude, RUNNER_SUPPORT } from "./cppPrelude";
import { CppKind, ICppMethod, ICppParameter, ICppType, parseSolutionMethod } from "./cppSignature";

const START_MARKER: string = "@lc code=start";
const END_MARKER: string = "@lc code=end";

/**
 * 把 LeetCode 生成的初始代码改造成可以直接编译运行的代码.
 *
 * 生成的文件结构:
 *
 *     <题目标注注释>
 *     #include ...          <- 位于标记之外
 *     using namespace std;
 *     struct ListNode {...} <- 题目代码只把它放在注释里时补上
 *     // @lc code=start
 *     class Solution {...}; <- 提交给 LeetCode 的内容只有这一段
 *     // @lc code=end
 *     namespace lc_local {...}  <- 读入与打印辅助
 *     int main() {...}          <- 运行入口
 *
 * 关键约束: 提交与测试时 CLI 只截取两个标记之间的内容, 因此辅助代码必须放在标记之外,
 * 否则会随解答一起提交给判题机.
 */
export function generateRunnableCpp(code: string): string {
    const lines: string[] = code.split(/\r?\n/);
    const startLine: number = lines.findIndex((line: string) => line.indexOf(START_MARKER) >= 0);
    const endLine: number = lines.findIndex((line: string) => line.indexOf(END_MARKER) >= 0);
    if (startLine < 0 || endLine < 0 || endLine < startLine) {
        // 标记不完整时保持原样, 避免破坏非标准内容
        return code;
    }

    const method: ICppMethod | undefined = parseSolutionMethod(code);
    const defineListNode: boolean = !definesType(code, "ListNode");
    const defineTreeNode: boolean = !definesType(code, "TreeNode");

    const result: string[] = [];
    result.push(...lines.slice(0, startLine));
    result.push(...buildRunnerPrelude(defineListNode, defineTreeNode).split("\n"));
    result.push(...lines.slice(startLine, endLine + 1));
    result.push("");
    result.push(...RUNNER_SUPPORT.split("\n"));
    result.push("");
    result.push(...(method ? buildMain(method) : buildPlaceholderMain()).split("\n"));
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

/** 转义成可以放进 C++ 字符串字面量的形式, 提示文本里可能出现引号与反斜杠. */
function escapeCppStringLiteral(text: string): string {
    return text.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
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
    const body: string[] = [];

    for (const parameter of method.parameters) {
        if (!isSupported(parameter.type)) {
            return buildPlaceholderMain();
        }
    }
    if (method.returnType.kind !== CppKind.Void && !isSupported(method.returnType)) {
        return buildPlaceholderMain();
    }

    body.push("int main() {");
    body.push("    std::string text;");
    body.push("    std::string line;");
    body.push("    bool firstLine = true;");
    body.push("    while (std::getline(std::cin, line)) {");
    body.push("        // 直接回车表示不提供输入");
    body.push("        if (firstLine && line.empty()) {");
    body.push("            break;");
    body.push("        }");
    body.push("        firstLine = false;");
    body.push("        text += line;");
    body.push(String.raw`        text += "\n";`);
    body.push("    }");
    body.push("");
    body.push(String.raw`    if (text.find_first_not_of(" \t\r\n") == std::string::npos) {`);
    body.push(String.raw`        std::cout << "未提供测试输入, 请从标准输入传入参数 (每行一个):" << std::endl;`);
    const hintParameters: ICppParameter[] = method.constructorParameters.concat(method.parameters);
    for (const parameter of hintParameters) {
        const hint: string = escapeCppStringLiteral(sampleHint(parameter.type));
        const typeText: string = escapeCppStringLiteral(cppTypeText(parameter.type));
        body.push(`        std::cout << "  ${parameter.name}: ${typeText}, 例如 ${hint}" << std::endl;`);
    }
    body.push(String.raw`        std::cout << "也可以执行 ./a.out < input.txt" << std::endl;`);
    body.push("        return 0;");
    body.push("    }");
    body.push("");
    body.push("    lc_local::Reader reader(text);");

    // 构造函数需要参数时, 必须先读入这些参数再构造对象
    // (例如 NumArray 没有默认构造函数, 直接声明对象无法编译)
    for (const parameter of method.constructorParameters) {
        const type: string = cppTypeText(parameter.type);
        body.push(`    ${type} ${parameter.name} = lc_local::Read<${type}>::get(reader);`);
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
        const type: string = cppTypeText(parameter.type);
        body.push(`    ${type} ${parameter.name} = lc_local::Read<${type}>::get(reader);`);
    }

    const argumentsText: string = method.parameters.map((parameter: ICppParameter) => parameter.name).join(", ");
    const call: string = `solution.${method.name}(${argumentsText})`;

    if (method.returnType.kind === CppKind.Void) {
        body.push(`    ${call};`);
        const printed: ICppParameter | undefined = method.parameters.find(
            (parameter: ICppParameter) => parameter.type.kind === CppKind.Vector,
        );
        if (printed) {
            const type: string = cppTypeText(printed.type);
            body.push(`    // 返回值为 void, 按 LeetCode 的约定打印被就地修改的参数`);
            body.push(`    std::cout << lc_local::Show<${type}>::get(${printed.name}) << std::endl;`);
        } else {
            body.push(String.raw`    std::cout << "该题目没有返回值, 也没有可打印的参数." << std::endl;`);
        }
    } else {
        const type: string = cppTypeText(method.returnType);
        body.push(`    ${type} result = ${call};`);
        body.push(`    std::cout << lc_local::Show<${type}>::get(result) << std::endl;`);
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
        "int main() {",
        String.raw`    std::cout << "该题目无法自动生成运行入口, 请在下面的 main 中手动构造用例并调用." << std::endl;`,
        "    return 0;",
        "}",
    ].join("\n");
}
