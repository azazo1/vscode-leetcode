// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";

export interface IQuickItemEx<T> extends vscode.QuickPickItem {
    value: T;
}

export enum UserStatus {
    SignedIn = 1,
    SignedOut = 2,
}

export const loginArgsMapping: Map<string, string> = new Map([
    ["LeetCode", "-l"],
    ["Cookie", "-c"],
    ["GitHub", "-g"],
    ["LinkedIn", "-i"],
]);

export const languages: string[] = [
    "bash",
    "c",
    "cpp",
    "csharp",
    "golang",
    "java",
    "javascript",
    "kotlin",
    "mysql",
    "php",
    "python",
    "python3",
    "ruby",
    "rust",
    "scala",
    "swift",
    "typescript",
];

export const langExt: Map<string, string> = new Map([
    ["bash", "sh"],
    ["c", "c"],
    ["cpp", "cpp"],
    ["csharp", "cs"],
    ["golang", "go"],
    ["java", "java"],
    ["javascript", "js"],
    ["kotlin", "kt"],
    ["mysql", "sql"],
    ["php", "php"],
    ["python", "py"],
    ["python3", "py"],
    ["ruby", "rb"],
    ["rust", "rs"],
    ["scala", "scala"],
    ["swift", "swift"],
    ["typescript", "ts"],
]);

export enum ProblemState {
    AC = 1,
    NotAC = 2,
    Unknown = 3,
    Locked = 4,
}

export enum Endpoint {
    LeetCode = "leetcode",
    LeetCodeCN = "leetcode-cn",
}

export interface IProblem {
    isFavorite: boolean;
    locked: boolean;
    state: ProblemState;
    id: string;
    name: string;
    difficulty: string;
    passRate: string;
    companies: string[];
    tags: string[];
}

export const defaultProblem: IProblem = {
    isFavorite: false,
    locked: false,
    state: ProblemState.Unknown,
    id: "",
    name: "",
    difficulty: "",
    passRate: "",
    companies: [] as string[],
    tags: [] as string[],
};

export enum Category {
    Hot100 = "Hot100",
    All = "All",
    Difficulty = "Difficulty",
    Tag = "Tag",
    Company = "Company",
    Favorite = "Favorite",
}

/**
 * 题单 (study plan) 中的一组题目. 分组的名称和顺序都来自 LeetCode 官方数据.
 */
export interface IStudyPlanGroup {
    name: string;
    /** 题目 id, 与问题列表中的 id 一致, 顺序即官方顺序. */
    problemIds: string[];
}

/**
 * 一个题单, 例如官方的 "热题 100".
 *
 * 目前只用于 "热题 100", 但数据结构不假定题单类型, 后续可以用同样的方式接入其他题单.
 */
export interface IStudyPlan {
    /** 官方题单的 slug, 也是题单在注释标记中的标识. */
    slug: string;
    groups: IStudyPlanGroup[];
}

export const supportedPlugins: string[] = ["company", "solution.discuss", "leetcode.cn"];

export enum DescriptionConfiguration {
    InWebView = "In Webview",
    InFileComment = "In File Comment",
    Both = "Both",
    None = "None",
}

export const leetcodeHasInited: string = "leetcode.hasInited";

export enum SortingStrategy {
    None = "None",
    AcceptanceRateAsc = "Acceptance Rate (Ascending)",
    AcceptanceRateDesc = "Acceptance Rate (Descending)",
    FrequencyAsc = "Frequency (Ascending)",
    FrequencyDesc = "Frequency (Descending)",
}

export const PREMIUM_URL_CN = "https://leetcode.cn/premium-payment/?source=vscode";
export const PREMIUM_URL_GLOBAL = "https://leetcode.com/subscribe/?ref=lp_pl&source=vscode";

/**
 * 本扩展自身的 id, 在激活时从 ExtensionContext 读取.
 *
 * 网页登录的回调地址形如 `vscode://<扩展 id>/`, VS Code 按其中的 id 决定把回调交给哪个扩展.
 * 这里不能沿用原插件的 id, 否则浏览器跳回时 VS Code 会认为回调属于原插件, 转而提示安装它.
 * 也不写死本扩展 id, 以免 publisher 或 name 变更后再次失配.
 */
let selfExtensionId: string | undefined;

export function setSelfExtensionId(id: string): void {
    selfExtensionId = id;
}

/**
 * 网页登录的授权地址.
 *
 * 用户在浏览器完成授权后, 网站按其中的 path 参数跳回本扩展注册的 uri handler.
 */
export function getWebAuthLoginUrl(endpoint: string): string {
    if (!selfExtensionId) {
        throw new Error("Extension id is not initialized, cannot build the login callback url.");
    }
    const base: string = endpoint === Endpoint.LeetCodeCN ? "https://leetcode.cn" : "https://leetcode.com";
    return `${base}/authorize-login/${vscode.env.uriScheme}/?path=${selfExtensionId}`;
}

export const urls = {
    // base urls
    base: "https://leetcode.com",
    graphql: "https://leetcode.com/graphql",
    userGraphql: "https://leetcode.com/graphql",
    login: "https://leetcode.com/accounts/login/",
};

export const urlsCn = {
    // base urls
    base: "https://leetcode.cn",
    graphql: "https://leetcode.cn/graphql",
    userGraphql: "https://leetcode.cn/graphql/",
    login: "https://leetcode.cn/accounts/login/",
};

export const getUrl = (key: string) => {
    const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
    const point = leetCodeConfig.get<string>("endpoint", Endpoint.LeetCode);
    switch (point) {
        case Endpoint.LeetCodeCN:
            return urlsCn[key];
        case Endpoint.LeetCode:
        default:
            return urls[key];
    }
};
