// Copyright (c) azazo1. All rights reserved.
// Licensed under the MIT license.

import axios, { AxiosResponse } from "axios";
import { Endpoint, IStudyPlan, IStudyPlanGroup, urls, urlsCn } from "../shared";

const graphqlQuery: string = `
    query studyPlanV2Detail($planSlug: String!) {
        studyPlanV2Detail(planSlug: $planSlug) {
            planSubGroups {
                name
                questions {
                    questionFrontendId
                }
            }
        }
    }
`;

interface IStudyPlanDetail {
    planSubGroups: Array<{
        name: string;
        questions: Array<{ questionFrontendId: string }>;
    }>;
}

interface IStudyPlanResponse {
    data?: {
        studyPlanV2Detail?: IStudyPlanDetail;
    };
}

/**
 * 读取官方题单的分组和题目顺序.
 *
 * 这个接口不需要登录凭据, 所以不经过 LcAxios. 返回的分组顺序和组内题目顺序
 * 就是 leetcode.cn / leetcode.com 题单页面上的展示顺序, 调用方不要重排.
 */
export async function queryStudyPlan(endpoint: Endpoint, slug: string): Promise<IStudyPlan> {
    const isCn: boolean = endpoint === Endpoint.LeetCodeCN;
    const graphqlUrl: string = isCn ? urlsCn.graphql : urls.graphql;
    const referer: string = `${isCn ? urlsCn.base : urls.base}/studyplan/${slug}/`;

    const response: AxiosResponse<IStudyPlanResponse> = await axios(graphqlUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            referer,
        },
        data: {
            query: graphqlQuery,
            variables: { planSlug: slug },
        },
        timeout: 10000,
    });

    const detail: IStudyPlanDetail | undefined = response.data && response.data.data
        ? response.data.data.studyPlanV2Detail
        : undefined;
    if (!detail || !detail.planSubGroups || detail.planSubGroups.length === 0) {
        throw new Error(`Unexpected response when fetching the study plan "${slug}".`);
    }

    const groups: IStudyPlanGroup[] = detail.planSubGroups.map((group) => ({
        name: group.name,
        problemIds: group.questions.map((question) => question.questionFrontendId),
    }));
    return { slug, groups };
}
