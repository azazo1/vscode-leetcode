// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

/**
 * 解析 LeetCode 生成的 Rust 初始代码, 取出 `impl Solution` 里的方法签名.
 *
 * LeetCode 返回的初始代码形如:
 *
 *     impl Solution {
 *         pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {
 *
 *         }
 *     }
 *
 * 方法名, 参数类型, 返回类型都在其中, 因此无需额外请求接口.
 */

/** 参数的借用方式, 决定生成调用时是否取引用. */
export enum RustBorrow {
    None = "none",
    Ref = "ref",
    RefMut = "ref_mut",
}

export enum RustKind {
    Int = "int",
    Long = "long",
    Float = "float",
    Double = "double",
    Bool = "bool",
    Char = "char",
    String = "string",
    /** &str, 读取时按 String 读入, 调用时取引用 */
    Str = "str",
    Vector = "vector",
    ListNode = "listnode",
    TreeNode = "treenode",
    Unit = "unit",
}

export interface IRustType {
    kind: RustKind;
    /** 去掉借用符号与生命周期之后的类型文本, 例如 "Vec<i32>" */
    text: string;
    borrow: RustBorrow;
    /** 是否是切片, 例如 [i32] */
    slice: boolean;
    /** Vec 或切片的元素类型 */
    element?: IRustType;
}

export interface IRustParameter {
    name: string;
    type: IRustType;
}

export interface IRustMethod {
    name: string;
    returnType: IRustType;
    parameters: IRustParameter[];
}

const SCALAR_KINDS: Map<string, RustKind> = new Map([
    ["i8", RustKind.Int],
    ["i16", RustKind.Int],
    ["i32", RustKind.Int],
    ["u8", RustKind.Int],
    ["u16", RustKind.Int],
    ["u32", RustKind.Int],
    ["i64", RustKind.Long],
    ["u64", RustKind.Long],
    ["isize", RustKind.Long],
    ["usize", RustKind.Long],
    ["f32", RustKind.Float],
    ["f64", RustKind.Double],
    ["bool", RustKind.Bool],
    ["char", RustKind.Char],
]);

function unitType(): IRustType {
    return { kind: RustKind.Unit, text: "()", borrow: RustBorrow.None, slice: false };
}

/** 解析一个 Rust 类型; 返回 undefined 表示无法识别的类型. */
export function parseRustType(raw: string): IRustType | undefined {
    let text: string = raw.replace(/\s+/g, " ").trim();
    if (!text) {
        return undefined;
    }

    let borrow: RustBorrow = RustBorrow.None;
    const slice: boolean = false;
    if (text.indexOf("&") === 0) {
        text = text.slice(1).trim();
        // 去掉生命周期标注, 例如 &'a str
        text = text.replace(/^'\w+\s*/, "");
        if (text.indexOf("mut ") === 0) {
            borrow = RustBorrow.RefMut;
            text = text.slice(4).trim();
        } else {
            borrow = RustBorrow.Ref;
        }
    }

    if (text === "()") {
        return unitType();
    }

    if (text === "String") {
        return { kind: RustKind.String, text, borrow, slice };
    }
    if (text === "str") {
        return { kind: RustKind.Str, text, borrow, slice };
    }

    const vectorMatch: RegExpExecArray | null = /^Vec\s*<\s*(.+)\s*>$/.exec(text);
    if (vectorMatch) {
        const element: IRustType | undefined = parseRustType(vectorMatch[1]);
        if (!element) {
            return undefined;
        }
        return { kind: RustKind.Vector, text, borrow, slice, element };
    }

    const sliceMatch: RegExpExecArray | null = /^\[\s*(.+)\s*\]$/.exec(text);
    if (sliceMatch) {
        const element: IRustType | undefined = parseRustType(sliceMatch[1]);
        if (!element) {
            return undefined;
        }
        return { kind: RustKind.Vector, text, borrow, slice: true, element };
    }

    if (/^Option\s*<\s*Box\s*<\s*ListNode\s*>\s*>$/.test(text)) {
        return { kind: RustKind.ListNode, text, borrow, slice };
    }

    if (/^Option\s*<\s*Rc\s*<\s*RefCell\s*<\s*TreeNode\s*>\s*>\s*>$/.test(text)) {
        return { kind: RustKind.TreeNode, text, borrow, slice };
    }

    const scalar: RustKind | undefined = SCALAR_KINDS.get(text);
    if (scalar) {
        return { kind: scalar, text, borrow, slice };
    }

    return undefined;
}

/** 按顶层逗号切分泛型参数与函数参数, 避免切开 Vec<Vec<i32>> 这类嵌套结构. */
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

/**
 * 读取该类型时用的 Rust 类型文本.
 *
 * 整数与浮点沿用模板里写明的类型 (usize, u8, f32 等等都能直接读入),
 * 借用与切片则读成拥有所有权的 Vec 或 String, 调用时再取引用.
 */
export function rustReadType(type: IRustType): string {
    switch (type.kind) {
        case RustKind.Int:
        case RustKind.Long:
        case RustKind.Float:
        case RustKind.Double:
        case RustKind.Bool:
        case RustKind.Char:
            return type.text;
        case RustKind.String:
        case RustKind.Str:
            return "String";
        case RustKind.ListNode:
            return "Option<Box<ListNode>>";
        case RustKind.TreeNode:
            return "Option<Rc<RefCell<TreeNode>>>";
        case RustKind.Vector: {
            const element: string = type.element ? rustReadType(type.element) : "i32";
            return `Vec<${element}>`;
        }
        default:
            return "()";
    }
}

/** 去掉行注释与块注释, 用于判断模板自身到底定义和使用过哪些名字. */
export function stripRustComments(code: string): string {
    const withoutBlockComments: string = code.replace(/\/\*[\s\S]*?\*\//g, " ");
    return withoutBlockComments.replace(/\/\/[^\n]*/g, " ");
}

/** 判断代码里是否定义了某个结构体或枚举. */
export function definesType(codeOnlyComments: string, name: string): boolean {
    return new RegExp(`\\b(?:struct|enum)\\s+${name}\\b`).test(codeOnlyComments);
}

/** 判断代码里是否用到了某个名字. */
export function mentionsName(codeOnlyComments: string, name: string): boolean {
    return new RegExp(`\\b${name}\\b`).test(codeOnlyComments);
}

/** 判断代码里是否已经有 use 语句引入了某个名字, 例如 use std::rc::Rc; */
export function hasUseOf(codeOnlyComments: string, name: string): boolean {
    const statements: RegExpMatchArray | null = codeOnlyComments.match(/use\s[^;]*;/g);
    if (!statements) {
        return false;
    }
    return statements.some((statement: string) => new RegExp(`\\b${name}\\b`).test(statement));
}

/**
 * 取出代码中第一个 impl 块的类型名与块内文本.
 *
 * 先去掉注释: 题目的初始代码把 ListNode / TreeNode 的定义写在注释里,
 * 其中也带着 impl 块, 不排除掉就会误当成解答的 impl.
 */
export function parseFirstImpl(code: string): { className: string; body: string } | undefined {
    const codeOnly: string = stripRustComments(code);
    const match: RegExpExecArray | null = /impl\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\{/.exec(codeOnly);
    if (!match) {
        return undefined;
    }
    return { className: match[1], body: codeOnly.slice(match.index + match[0].length) };
}

const FN_PATTERN: RegExp = /(?:^|\n)\s*(?:pub\s+)?fn\s+([A-Za-z_]\w*)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*(?:->\s*([^{\n]+?))?\s*\{/;

function parseParameters(text: string): IRustParameter[] | undefined {
    const parameters: IRustParameter[] = [];
    for (const rawParameter of splitTopLevel(text)) {
        const separator: number = rawParameter.indexOf(":");
        if (separator < 0) {
            // self, &self, &mut self 不能按关联函数调用
            return undefined;
        }
        const name: string = rawParameter.slice(0, separator).trim().replace(/^mut\s+/, "");
        if (!/^[A-Za-z_]\w*$/.test(name) || name === "_") {
            return undefined;
        }
        const type: IRustType | undefined = parseRustType(rawParameter.slice(separator + 1));
        if (!type) {
            return undefined;
        }
        parameters.push({ name, type });
    }
    return parameters;
}

/**
 * 取出 `impl Solution` 里的第一个方法签名.
 *
 * 设计类题目 (例如 LRU 缓存) 的代码是 impl 自己的结构体, 调用序列无法通用生成,
 * 这里返回 undefined. 带泛型参数的方法同样返回 undefined: 调用点推不出类型实参.
 */
export function parseSolutionMethod(code: string): IRustMethod | undefined {
    const impl = parseFirstImpl(code);
    if (!impl || impl.className !== "Solution") {
        return undefined;
    }
    const match: RegExpExecArray | null = FN_PATTERN.exec(impl.body);
    if (!match || match[2]) {
        return undefined;
    }
    const parameters: IRustParameter[] | undefined = parseParameters(match[3]);
    if (!parameters) {
        return undefined;
    }
    const returnType: IRustType | undefined = match[4] ? parseRustType(match[4]) : unitType();
    if (!returnType) {
        return undefined;
    }
    return { name: match[1], returnType, parameters };
}
