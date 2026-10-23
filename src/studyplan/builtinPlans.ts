// Copyright (c) azazo1. All rights reserved.
// Licensed under the MIT license.

import { IStudyPlan } from "../shared";

/**
 * 官方 "热题 100" 的内置快照.
 *
 * 扩展激活后会从官方题单接口拉取数据并缓存, 这里的内容只在请求失败且没有缓存时使用.
 * 数据取自 2026-10-23 的 leetcode.cn 与 leetcode.com 接口, 分组和题目顺序与官网保持一致.
 * 官方调整题单后, 内置快照可能暂时落后, 但接口数据与缓存仍然是最新的.
 */

export const hot100LikedPlanCn: IStudyPlan = {
    slug: "top-100-liked",
    groups: [
        {
            name: "哈希",
            problemIds: ["1", "49", "128"],
        },
        {
            name: "双指针",
            problemIds: ["283", "11", "15", "42"],
        },
        {
            name: "滑动窗口",
            problemIds: ["3", "438"],
        },
        {
            name: "子串",
            problemIds: ["560", "239", "76"],
        },
        {
            name: "普通数组",
            problemIds: ["53", "56", "189", "238", "41"],
        },
        {
            name: "矩阵",
            problemIds: ["73", "54", "48", "240"],
        },
        {
            name: "链表",
            problemIds: ["160", "206", "234", "141", "142", "21", "2", "19", "24", "25", "138", "148", "23", "146"],
        },
        {
            name: "二叉树",
            problemIds: ["94", "104", "226", "101", "543", "102", "108", "98", "230", "199", "114", "105", "437", "236", "124"],
        },
        {
            name: "图论",
            problemIds: ["200", "994", "207", "208"],
        },
        {
            name: "回溯",
            problemIds: ["46", "78", "17", "39", "22", "79", "131", "51"],
        },
        {
            name: "二分查找",
            problemIds: ["35", "74", "34", "33", "153", "4"],
        },
        {
            name: "栈",
            problemIds: ["20", "155", "394", "739", "84"],
        },
        {
            name: "堆",
            problemIds: ["215", "347", "295"],
        },
        {
            name: "贪心算法",
            problemIds: ["121", "55", "45", "763"],
        },
        {
            name: "动态规划",
            problemIds: ["70", "118", "198", "279", "322", "139", "300", "152", "416", "32"],
        },
        {
            name: "多维动态规划",
            problemIds: ["62", "64", "5", "1143", "72"],
        },
        {
            name: "技巧",
            problemIds: ["136", "169", "75", "31", "287"],
        },
    ],
};

export const hot100LikedPlanGlobal: IStudyPlan = {
    slug: "top-100-liked",
    groups: [
        {
            name: "Backtracking",
            problemIds: ["17", "22", "39", "46", "51", "78", "79", "131"],
        },
        {
            name: "Binary Search",
            problemIds: ["4", "33", "34", "35", "74", "124", "153"],
        },
        {
            name: "Binary Tree",
            problemIds: ["94", "98", "101", "102", "104", "105", "108", "114", "199", "226", "230", "236", "437", "543"],
        },
        {
            name: "Dynamic Programming",
            problemIds: ["5", "32", "62", "64", "70", "72", "118", "139", "152", "198", "279", "300", "322", "416", "1143"],
        },
        {
            name: "Graph",
            problemIds: ["200", "207", "994"],
        },
        {
            name: "Greedy",
            problemIds: ["45", "55", "121", "763"],
        },
        {
            name: "Hashing",
            problemIds: ["1", "49", "128", "560"],
        },
        {
            name: "Heap",
            problemIds: ["215", "295", "347"],
        },
        {
            name: "Linked Lists",
            problemIds: ["2", "19", "21", "23", "24", "25", "138", "141", "142", "146", "148", "160", "206", "234"],
        },
        {
            name: "Matrix",
            problemIds: ["48", "54", "73", "240"],
        },
        {
            name: "Sliding Window",
            problemIds: ["3", "76", "239", "438"],
        },
        {
            name: "Stack",
            problemIds: ["20", "84", "155", "394", "739"],
        },
        {
            name: "Two Pointers",
            problemIds: ["11", "15", "42", "283"],
        },
        {
            name: "Trie",
            problemIds: ["208"],
        },
        {
            name: "Misc",
            problemIds: ["31", "41", "53", "56", "75", "136", "169", "189", "238", "287"],
        },
    ],
};
