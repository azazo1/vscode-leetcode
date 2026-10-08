// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

/**
 * 解析 LeetCode 生成的 C++ 初始代码, 取出类名与方法签名.
 *
 * LeetCode 返回的初始代码形如:
 *
 *     class Solution {
 *     public:
 *         vector<int> twoSum(vector<int>& nums, int target) {
 *
 *         }
 *     };
 *
 * 方法名, 参数类型, 返回类型都在其中, 因此无需额外请求接口.
 */

export enum CppKind {
    Int = "int",
    Long = "long",
    Float = "float",
    Double = "double",
    Bool = "bool",
    Char = "char",
    String = "string",
    Vector = "vector",
    ListNode = "listnode",
    TreeNode = "treenode",
    Void = "void",
}

export interface ICppType {
    kind: CppKind;
    /** 去掉 const 与引用/指针符号之后的类型文本, 例如 "vector<int>" */
    text: string;
    /** 是否是指针类型, 形参声明时需要还原 "*" */
    isPointer: boolean;
    /** vector 的元素类型 */
    element?: ICppType;
}

export interface ICppParameter {
    name: string;
    type: ICppType;
}

export interface ICppMethod {
    className: string;
    name: string;
    returnType: ICppType;
    parameters: ICppParameter[];
    /**
     * 构造函数的参数.
     *
     * 形如 NumArray 的题目, 构造函数需要参数且没有默认构造函数,
     * 生成入口时必须先读入这些参数再构造对象, 否则无法编译.
     * 空数组表示可以直接默认构造.
     */
    constructorParameters: ICppParameter[];
}

const SCALAR_PATTERNS: Array<{ pattern: RegExp; kind: CppKind }> = [
    { pattern: /^(unsigned\s+int|int|short|unsigned\s+short)$/, kind: CppKind.Int },
    { pattern: /^(long\s+long|unsigned\s+long\s+long|long|unsigned\s+long|size_t|int64_t|uint64_t)$/, kind: CppKind.Long },
    { pattern: /^float$/, kind: CppKind.Float },
    { pattern: /^(double|long\s+double)$/, kind: CppKind.Double },
    { pattern: /^bool$/, kind: CppKind.Bool },
    { pattern: /^char$/, kind: CppKind.Char },
    { pattern: /^string$/, kind: CppKind.String },
    { pattern: /^ListNode$/, kind: CppKind.ListNode },
    { pattern: /^TreeNode$/, kind: CppKind.TreeNode },
    { pattern: /^void$/, kind: CppKind.Void },
];

/** 规整类型文本: 去掉 const, 引用与指针符号, 统一 std:: 前缀与模板空格. */
export function normalizeCppTypeText(raw: string): string {
    let text: string = raw.replace(/\s+/g, " ").trim();
    text = text.replace(/\bconst\b/g, " ");
    text = text.replace(/[&*]/g, " ");
    text = text.replace(/\bstd\s*::\s*/g, "");
    // "vector<vector<int> >" 这类写法统一成 "vector<vector<int>>"
    text = text.replace(/>\s+>/g, ">>");
    return text.replace(/\s+/g, " ").trim();
}

export function parseCppType(raw: string): ICppType | undefined {
    const isPointer: boolean = /[*]/.test(raw);
    const text: string = normalizeCppTypeText(raw);
    if (!text) {
        return undefined;
    }

    const vectorMatch: RegExpExecArray | null = /^vector\s*<(.+)>$/.exec(text);
    if (vectorMatch) {
        const element: ICppType | undefined = parseCppType(vectorMatch[1]);
        if (!element) {
            return undefined;
        }
        return { kind: CppKind.Vector, text: `vector<${element.text}${element.isPointer ? " *" : ""}>`, isPointer: false, element };
    }

    for (const { pattern, kind } of SCALAR_PATTERNS) {
        if (pattern.test(text)) {
            const pointer: boolean = kind === CppKind.ListNode || kind === CppKind.TreeNode || isPointer;
            return { kind, text, isPointer: pointer };
        }
    }

    return undefined;
}

/** 按顶层逗号切分模板与函数参数, 避免切开 vector<vector<int>> 这类嵌套结构. */
export function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth: number = 0;
    let current: string = "";
    for (const character of text) {
        if (character === "<" || character === "(" || character === "[") {
            depth++;
        } else if (character === ">" || character === ")" || character === "]") {
            depth--;
        } else if (character === "," && depth === 0) {
            parts.push(current);
            current = "";
            continue;
        }
        current += character;
    }
    parts.push(current);
    return parts.map((part: string) => part.trim()).filter((part: string) => part.length > 0);
}

function parseParameter(raw: string): ICppParameter | undefined {
    const text: string = raw.trim();
    if (!text) {
        return undefined;
    }
    // 参数名是末尾的标识符, 前面必须有空白或者 * & > 之类的分隔符
    const nameMatch: RegExpExecArray | null = /^(.*[\s*&>])([A-Za-z_]\w*)$/.exec(text);
    if (!nameMatch) {
        return undefined;
    }
    const type: ICppType | undefined = parseCppType(nameMatch[1]);
    if (!type) {
        return undefined;
    }
    return { name: nameMatch[2], type };
}

/**
 * 以这些关键字开头的行不是方法声明.
 *
 * 缺少这道过滤时, 方法体里的 "else if (condition) {" 会被当成 "else" 是返回类型,
 * "if" 是方法名, 从而误判成第二个方法.
 */
const CONTROL_KEYWORDS: string[] = [
    "if", "else", "for", "while", "do", "switch", "case", "default",
    "return", "break", "continue", "try", "catch", "throw", "new", "delete",
    "goto", "using", "typedef", "template", "namespace", "public", "private", "protected",
];

/**
 * 从初始代码中取出唯一的成员方法.
 *
 * 设计题 (例如 LRU 缓存) 有多个方法, 调用序列无法通用生成, 这里返回 undefined.
 */
export function parseSolutionMethod(code: string): ICppMethod | undefined {
    const classMatch: RegExpExecArray | null = /class\s+([A-Za-z_]\w*)\s*(?::[^{]*)?\{/.exec(code);
    if (!classMatch) {
        return undefined;
    }
    const className: string = classMatch[1];
    const body: string = code.slice(classMatch.index + classMatch[0].length);
    const endIndex: number = body.lastIndexOf("}");
    const inner: string = endIndex >= 0 ? body.slice(0, endIndex) : body;

    const declarations: Array<{ returnType: ICppType; name: string; paramsText: string }> = [];
    const constructorTexts: string[] = [];
    const constructorPattern: RegExp = new RegExp(`^\\s*${className}\\s*\\(([^)]*)\\)\\s*(?::[^{]*)?\\{`);
    for (const line of inner.split(/\r?\n/)) {
        // 构造函数没有返回类型, 需要单独识别
        const constructorMatch: RegExpExecArray | null = constructorPattern.exec(line);
        if (constructorMatch) {
            constructorTexts.push(constructorMatch[1]);
            continue;
        }
        // 方法声明独占一行, 排除构造函数 (没有返回类型)
        const match: RegExpExecArray | null = /^\s*([A-Za-z_][\w\s:<>,\*&]*?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const\s*)?\{/.exec(line);
        if (!match) {
            continue;
        }
        const firstWord: string = match[1].trim().split(/\s+/)[0];
        if (CONTROL_KEYWORDS.indexOf(firstWord) >= 0) {
            continue;
        }
        // 返回类型必须能识别, 这是区分方法声明与普通语句的关键
        const returnType: ICppType | undefined = parseCppType(match[1]);
        if (!returnType) {
            continue;
        }
        declarations.push({ returnType, name: match[2], paramsText: match[3] });
    }

    if (declarations.length !== 1) {
        return undefined;
    }

    const declaration = declarations[0];
    const parameters: ICppParameter[] | undefined = parseParameters(declaration.paramsText);
    if (!parameters) {
        return undefined;
    }

    // 有多个构造函数时无法判断该用哪一个
    if (constructorTexts.length > 1) {
        return undefined;
    }
    let constructorParameters: ICppParameter[] = [];
    if (constructorTexts.length === 1) {
        const parsed: ICppParameter[] | undefined = parseParameters(constructorTexts[0]);
        if (!parsed) {
            // 构造函数带参数但类型无法识别, 退回占位入口比生成错误代码更安全
            return undefined;
        }
        constructorParameters = parsed;
    }

    return { className, name: declaration.name, returnType: declaration.returnType, parameters, constructorParameters };
}

/** 解析参数列表; 返回 undefined 表示存在无法识别的参数. */
function parseParameters(paramsText: string): ICppParameter[] | undefined {
    const parameters: ICppParameter[] = [];
    for (const rawParam of splitTopLevel(paramsText)) {
        const parameter: ICppParameter | undefined = parseParameter(rawParam);
        if (!parameter) {
            return undefined;
        }
        parameters.push(parameter);
    }
    return parameters;
}

/** 判断类型 (含嵌套元素) 是否用到指定的链表或二叉树结构. */
export function typeUsesKind(type: ICppType, kind: CppKind): boolean {
    if (type.kind === kind) {
        return true;
    }
    return type.element ? typeUsesKind(type.element, kind) : false;
}
