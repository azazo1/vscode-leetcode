// Copyright (c) azazo1. All rights reserved.
// Licensed under the MIT license.

import { Disposable, Event, EventEmitter, ExtensionContext } from "vscode";
import { leetCodeChannel } from "../leetCodeChannel";
import { Endpoint, IStudyPlan, IStudyPlanGroup } from "../shared";
import { getEndpoint } from "../utils/settingUtils";
import { hot100LikedPlanCn, hot100LikedPlanGlobal } from "./builtinPlans";
import { queryStudyPlan } from "./query-study-plan";

/** 官方 "热题 100" 的 slug. */
export const hot100LikedSlug: string = "top-100-liked";
/** 面板中展示的题单名称. */
export const hot100LikedLabel: string = "Hot 100";

/** 内存缓存有效期, 过期后下一次刷新面板时会重新请求官方接口. */
const CACHE_TTL_MS: number = 10 * 60 * 1000;
const CACHE_KEY_PREFIX: string = "leetcode.studyPlan";

export interface IStudyPlanPosition {
    /** 题单 slug, 也是注释标记中的 plan 值. */
    slug: string;
    /** 官方分组名, 没有分组时为空串. */
    group: string;
    /** 在题单中的全局序号, 从 1 开始. */
    index: number;
    /** 题单的题目总数. */
    total: number;
    /** 题单中的下一题 id, 最后一题没有. */
    nextId?: string;
}

interface IStudyPlanDefinition {
    slug: string;
    builtin: {
        cn: IStudyPlan;
        global: IStudyPlan;
    };
}

/**
 * 已注册的题单.
 *
 * 现在只注册了 "热题 100", 新增题单时在这里补一条, 面板和注释标记会一并生效.
 */
const studyPlanDefinitions: IStudyPlanDefinition[] = [
    {
        slug: hot100LikedSlug,
        builtin: {
            cn: hot100LikedPlanCn,
            global: hot100LikedPlanGlobal,
        },
    },
];

interface ICachedPlan {
    plan: IStudyPlan;
    fetchedAt: number;
}

class StudyPlanManager implements Disposable {
    private context: ExtensionContext | undefined;
    private plans: Map<string, ICachedPlan> = new Map<string, ICachedPlan>();
    private pendingRequests: Map<string, Promise<IStudyPlan>> = new Map<string, Promise<IStudyPlan>>();
    private onDidChangePlanEmitter: EventEmitter<void> = new EventEmitter<void>();

    public readonly onDidChangePlan: Event<void> = this.onDidChangePlanEmitter.event;

    public initialize(context: ExtensionContext): void {
        this.context = context;
    }

    /**
     * 当前端点的 "热题 100".
     *
     * 优先使用内存或持久缓存, 没有缓存时使用内置快照, 因此面板在离线状态下也能展示题单.
     * 返回的顺序始终是官方顺序, 调用方不要重排.
     */
    public getHot100Liked(): IStudyPlan {
        return this.getPlan(getEndpoint(), hot100LikedSlug);
    }

    /**
     * 刷新所有题单数据.
     *
     * 缓存未过期时直接跳过; 请求失败时保留缓存或内置数据, 不会向外抛出异常,
     * 以免网络问题阻塞整个面板的刷新.
     */
    public async refresh(): Promise<void> {
        let changed: boolean = false;
        for (const definition of studyPlanDefinitions) {
            const refreshed: boolean = await this.refreshPlan(definition.slug);
            changed = refreshed || changed;
        }
        if (changed) {
            this.onDidChangePlanEmitter.fire();
        }
    }

    /**
     * 题目在所有已注册题单中的位置, 顺序与题单注册顺序一致.
     *
     * 题目不在任何题单中时返回空数组, 调用方可以据此决定是否写入注释标记.
     */
    public getPositions(problemId: string): IStudyPlanPosition[] {
        const endpoint: Endpoint = getEndpoint();
        const positions: IStudyPlanPosition[] = [];
        for (const definition of studyPlanDefinitions) {
            const position: IStudyPlanPosition | undefined = findPosition(
                this.getPlan(endpoint, definition.slug),
                problemId,
            );
            if (position) {
                positions.push(position);
            }
        }
        return positions;
    }

    /** 题目在 "热题 100" 中的下一题, 不在题单内或已是最后一题时返回 undefined. */
    public getNextHot100LikedProblemId(problemId: string): string | undefined {
        const position: IStudyPlanPosition | undefined = findPosition(this.getHot100Liked(), problemId);
        return position ? position.nextId : undefined;
    }

    public dispose(): void {
        this.plans.clear();
        this.pendingRequests.clear();
        this.onDidChangePlanEmitter.dispose();
    }

    private getPlan(endpoint: Endpoint, slug: string): IStudyPlan {
        const cached: ICachedPlan | undefined = this.getCachedPlan(endpoint, slug);
        if (cached) {
            return cached.plan;
        }
        return this.getBuiltinPlan(endpoint, slug);
    }

    private async refreshPlan(slug: string): Promise<boolean> {
        const endpoint: Endpoint = getEndpoint();
        const cached: ICachedPlan | undefined = this.getCachedPlan(endpoint, slug);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            return false;
        }
        try {
            await this.requestPlan(endpoint, slug);
            return true;
        } catch (error) {
            leetCodeChannel.appendLine(
                `Failed to fetch the study plan "${slug}", using the cached or built-in copy instead. ${error}`,
            );
            return false;
        }
    }

    private requestPlan(endpoint: Endpoint, slug: string): Promise<IStudyPlan> {
        const key: string = buildCacheKey(endpoint, slug);
        const pending: Promise<IStudyPlan> | undefined = this.pendingRequests.get(key);
        if (pending) {
            return pending;
        }
        const request: Promise<IStudyPlan> = this.fetchAndCache(endpoint, slug, key);
        this.pendingRequests.set(key, request);
        request.then(
            () => this.pendingRequests.delete(key),
            () => this.pendingRequests.delete(key),
        );
        return request;
    }

    private async fetchAndCache(endpoint: Endpoint, slug: string, key: string): Promise<IStudyPlan> {
        const plan: IStudyPlan = await queryStudyPlan(endpoint, slug);
        const cached: ICachedPlan = { plan, fetchedAt: Date.now() };
        this.plans.set(key, cached);
        if (this.context) {
            await this.context.globalState.update(key, cached);
        }
        return plan;
    }

    private getCachedPlan(endpoint: Endpoint, slug: string): ICachedPlan | undefined {
        const key: string = buildCacheKey(endpoint, slug);
        const cached: ICachedPlan | undefined = this.plans.get(key);
        if (cached) {
            return cached;
        }
        if (!this.context) {
            return undefined;
        }
        const stored: ICachedPlan | undefined = this.context.globalState.get<ICachedPlan>(key);
        if (!stored || !stored.plan || !stored.plan.groups) {
            return undefined;
        }
        this.plans.set(key, stored);
        return stored;
    }

    private getBuiltinPlan(endpoint: Endpoint, slug: string): IStudyPlan {
        const definition: IStudyPlanDefinition | undefined =
            studyPlanDefinitions.find((item: IStudyPlanDefinition) => item.slug === slug);
        if (!definition) {
            throw new Error(`The study plan "${slug}" is not registered.`);
        }
        return endpoint === Endpoint.LeetCodeCN ? definition.builtin.cn : definition.builtin.global;
    }
}

function buildCacheKey(endpoint: Endpoint, slug: string): string {
    return `${CACHE_KEY_PREFIX}.${endpoint}.${slug}`;
}

/**
 * 计算题目在题单中的位置. 题单的题目顺序由官方数据决定, 这里只按顺序展开.
 */
function findPosition(plan: IStudyPlan, problemId: string): IStudyPlanPosition | undefined {
    const problemIds: string[] = [];
    for (const group of plan.groups) {
        for (const id of group.problemIds) {
            problemIds.push(id);
        }
    }
    const index: number = problemIds.indexOf(problemId);
    if (index < 0) {
        return undefined;
    }
    const ownerGroup: IStudyPlanGroup | undefined =
        plan.groups.find((item: IStudyPlanGroup) => item.problemIds.indexOf(problemId) >= 0);
    return {
        slug: plan.slug,
        group: ownerGroup ? ownerGroup.name : "",
        index: index + 1,
        total: problemIds.length,
        nextId: index + 1 < problemIds.length ? problemIds[index + 1] : undefined,
    };
}

export const studyPlanManager: StudyPlanManager = new StudyPlanManager();
