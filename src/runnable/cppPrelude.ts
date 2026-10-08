// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

/**
 * C++ 本地运行所需的辅助代码.
 *
 * 这段内容位于 @lc 标记之外, 提交题目时不会被发送给 LeetCode.
 * 使用 String.raw 是为了让反斜杠按字面保留, 避免 TypeScript 提前把 '\0' 之类转义成真实字符.
 */

const INCLUDES: string = String.raw`#include <algorithm>
#include <array>
#include <bitset>
#include <cctype>
#include <chrono>
#include <climits>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <fstream>
#include <functional>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <list>
#include <map>
#include <memory>
#include <numeric>
#include <queue>
#include <random>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <type_traits>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <vector>`;

const LIST_NODE: string = String.raw`struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};`;

const TREE_NODE: string = String.raw`struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};`;

/**
 * 生成 @lc 标记之前的代码: 标准库头文件, 命名空间, 以及题目代码自身没有提供的结构体定义.
 *
 * 链表题与二叉树题的初始代码把 ListNode / TreeNode 的定义放在注释里,
 * 因此需要在这里补上, 否则类中的参数类型无法编译.
 */
export function buildRunnerPrelude(defineListNode: boolean, defineTreeNode: boolean): string {
    const parts: string[] = [INCLUDES, "", "using namespace std;", ""];
    if (defineListNode) {
        parts.push(LIST_NODE, "");
    }
    if (defineTreeNode) {
        parts.push(TREE_NODE, "");
    }
    return parts.join("\n");
}

/**
 * 生成 @lc 标记之后的辅助代码.
 *
 * 放在标记之后而不是之前, 是为了保证 ListNode / TreeNode 已经可见:
 * 结构体的定义要么来自上面的 prelude, 要么来自题目代码自身.
 */
export const RUNNER_SUPPORT: string = String.raw`// ---- 以下为本地编译与运行辅助代码, 位于 @lc 标记之外, 不会提交到 LeetCode ----
namespace lc_local {

// 极简输入解析器, 支持整数, 浮点, 布尔, 字符串以及它们的嵌套数组
struct Reader {
    std::string text;
    size_t pos;

    explicit Reader(const std::string &source) : text(source), pos(0) {}

    void skipSpaces() {
        while (pos < text.size() && static_cast<unsigned char>(text[pos]) <= ' ') {
            pos++;
        }
    }

    char peek() {
        skipSpaces();
        return pos < text.size() ? text[pos] : '\0';
    }

    bool eat(char expected) {
        if (peek() == expected) {
            pos++;
            return true;
        }
        return false;
    }

    // 输入是否为空 (只含空白字符)
    bool empty() {
        return text.find_first_not_of(" \t\r\n") == std::string::npos;
    }

    long long readInteger() {
        skipSpaces();
        size_t start = pos;
        if (pos < text.size() && (text[pos] == '-' || text[pos] == '+')) {
            pos++;
        }
        while (pos < text.size() && std::isdigit(static_cast<unsigned char>(text[pos]))) {
            pos++;
        }
        if (start == pos) {
            return 0;
        }
        return std::stoll(text.substr(start, pos - start));
    }

    double readDouble() {
        skipSpaces();
        size_t start = pos;
        if (pos < text.size() && (text[pos] == '-' || text[pos] == '+')) {
            pos++;
        }
        while (pos < text.size() && (std::isdigit(static_cast<unsigned char>(text[pos])) || text[pos] == '.')) {
            pos++;
        }
        if (pos < text.size() && (text[pos] == 'e' || text[pos] == 'E')) {
            pos++;
            if (pos < text.size() && (text[pos] == '-' || text[pos] == '+')) {
                pos++;
            }
            while (pos < text.size() && std::isdigit(static_cast<unsigned char>(text[pos]))) {
                pos++;
            }
        }
        if (start == pos) {
            return 0.0;
        }
        return std::stod(text.substr(start, pos - start));
    }

    bool readBoolean() {
        skipSpaces();
        if (pos + 4 <= text.size() && text.compare(pos, 4, "true") == 0) {
            pos += 4;
            return true;
        }
        if (pos + 5 <= text.size() && text.compare(pos, 5, "false") == 0) {
            pos += 5;
            return false;
        }
        return readInteger() != 0;
    }

    // 读取一个字符串, 兼容带引号与不带引号两种写法
    std::string readString() {
        skipSpaces();
        if (pos < text.size() && text[pos] == '"') {
            pos++;
            std::string result;
            while (pos < text.size() && text[pos] != '"') {
                if (text[pos] == '\\' && pos + 1 < text.size()) {
                    pos++;
                    char escaped = text[pos++];
                    if (escaped == 'n') {
                        result += '\n';
                    } else if (escaped == 't') {
                        result += '\t';
                    } else {
                        result += escaped;
                    }
                } else {
                    result += text[pos++];
                }
            }
            if (pos < text.size()) {
                pos++;
            }
            return result;
        }
        std::string result;
        while (pos < text.size() && text[pos] != ',' && text[pos] != ']' && text[pos] != '\n') {
            result += text[pos++];
        }
        while (!result.empty() && static_cast<unsigned char>(result.back()) <= ' ') {
            result.pop_back();
        }
        return result;
    }
};

// 按类型读取一个值. 主模板只作声明, 每个受支持的类型都有下面的特化.
template <typename T>
struct Read;

template <> struct Read<int> {
    static int get(Reader &reader) { return static_cast<int>(reader.readInteger()); }
};

template <> struct Read<long long> {
    static long long get(Reader &reader) { return reader.readInteger(); }
};

template <> struct Read<float> {
    static float get(Reader &reader) { return static_cast<float>(reader.readDouble()); }
};

template <> struct Read<double> {
    static double get(Reader &reader) { return reader.readDouble(); }
};

template <> struct Read<bool> {
    static bool get(Reader &reader) { return reader.readBoolean(); }
};

template <> struct Read<char> {
    static char get(Reader &reader) {
        std::string value = reader.readString();
        return value.empty() ? '\0' : value[0];
    }
};

template <> struct Read<std::string> {
    static std::string get(Reader &reader) { return reader.readString(); }
};

template <typename T>
struct Read<std::vector<T> > {
    static std::vector<T> get(Reader &reader) {
        std::vector<T> values;
        if (!reader.eat('[')) {
            return values;
        }
        if (reader.eat(']')) {
            return values;
        }
        while (true) {
            values.push_back(Read<T>::get(reader));
            if (reader.eat(',')) {
                continue;
            }
            reader.eat(']');
            break;
        }
        return values;
    }
};

template <>
struct Read<ListNode *> {
    static ListNode *get(Reader &reader) {
        std::vector<int> values = Read<std::vector<int> >::get(reader);
        ListNode head(0);
        ListNode *tail = &head;
        for (size_t k = 0; k < values.size(); k++) {
            tail->next = new ListNode(values[k]);
            tail = tail->next;
        }
        return head.next;
    }
};

template <>
struct Read<TreeNode *> {
    static TreeNode *get(Reader &reader) {
        std::vector<std::string> tokens;
        if (!reader.eat('[')) {
            return nullptr;
        }
        if (!reader.eat(']')) {
            while (true) {
                tokens.push_back(reader.readString());
                if (reader.eat(',')) {
                    continue;
                }
                reader.eat(']');
                break;
            }
        }
        if (tokens.empty() || tokens[0] == "null") {
            return nullptr;
        }
        TreeNode *root = new TreeNode(std::stoi(tokens[0]));
        std::queue<TreeNode *> pending;
        pending.push(root);
        size_t k = 1;
        while (!pending.empty() && k < tokens.size()) {
            TreeNode *node = pending.front();
            pending.pop();
            if (k < tokens.size()) {
                if (tokens[k] != "null") {
                    node->left = new TreeNode(std::stoi(tokens[k]));
                    pending.push(node->left);
                }
                k++;
            }
            if (k < tokens.size()) {
                if (tokens[k] != "null") {
                    node->right = new TreeNode(std::stoi(tokens[k]));
                    pending.push(node->right);
                }
                k++;
            }
        }
        return root;
    }
};

// 按类型打印一个值, 输出格式与 LeetCode 的示例一致
template <typename T>
struct Show {
    static std::string get(const T &value) {
        std::ostringstream out;
        out << value;
        return out.str();
    }
};

template <> struct Show<int> {
    static std::string get(const int &value) { return std::to_string(value); }
};

template <> struct Show<long long> {
    static std::string get(const long long &value) { return std::to_string(value); }
};

template <> struct Show<bool> {
    static std::string get(const bool &value) { return value ? "true" : "false"; }
};

template <> struct Show<float> {
    static std::string get(const float &value) {
        std::ostringstream out;
        out << value;
        return out.str();
    }
};

template <> struct Show<double> {
    static std::string get(const double &value) {
        std::ostringstream out;
        out << value;
        return out.str();
    }
};

template <> struct Show<char> {
    static std::string get(const char &value) { return std::string("\"") + value + "\""; }
};

template <> struct Show<std::string> {
    static std::string get(const std::string &value) { return "\"" + value + "\""; }
};

template <typename T>
struct Show<std::vector<T> > {
    static std::string get(const std::vector<T> &values) {
        std::string result = "[";
        for (size_t k = 0; k < values.size(); k++) {
            if (k > 0) {
                result += ",";
            }
            result += Show<T>::get(values[k]);
        }
        result += "]";
        return result;
    }
};

template <>
struct Show<ListNode *> {
    static std::string get(ListNode *head) {
        std::string result = "[";
        bool first = true;
        while (head != nullptr) {
            if (!first) {
                result += ",";
            }
            result += std::to_string(head->val);
            first = false;
            head = head->next;
        }
        result += "]";
        return result;
    }
};

template <>
struct Show<TreeNode *> {
    static std::string get(TreeNode *root) {
        if (root == nullptr) {
            return "[]";
        }
        std::vector<std::string> parts;
        std::queue<TreeNode *> pending;
        pending.push(root);
        while (!pending.empty()) {
            TreeNode *node = pending.front();
            pending.pop();
            if (node == nullptr) {
                parts.push_back("null");
                continue;
            }
            parts.push_back(std::to_string(node->val));
            pending.push(node->left);
            pending.push(node->right);
        }
        while (!parts.empty() && parts.back() == "null") {
            parts.pop_back();
        }
        std::string result = "[";
        for (size_t k = 0; k < parts.size(); k++) {
            if (k > 0) {
                result += ",";
            }
            result += parts[k];
        }
        result += "]";
        return result;
    }
};

// 读入标准输入. 没有输入时给出用法提示, 而不是静默地按默认值运行.
inline std::string readStdin(std::istream &in) {
    std::string text;
    std::string line;
    bool firstLine = true;
    while (std::getline(in, line)) {
        // 第一行直接回车表示不提供输入
        if (firstLine && line.empty()) {
            break;
        }
        firstLine = false;
        text += line;
        text += "\n";
    }
    if (text.find_first_not_of(" \t\r\n") == std::string::npos) {
        std::cout << "未提供测试输入. 每行传入一个参数, 顺序与类型见本文件 main 上方的注释." << std::endl;
        std::cout << "  ./a.out < input.txt" << std::endl;
        // 用 printf 而不是 echo, 因为 bash 的 echo 默认不解释 \n
        std::cout << "  printf '[2,7,11,15]\\n9\\n' | ./a.out" << std::endl;
    }
    return text;
}

// 按类型读入下一个参数
template <typename T>
inline T readNext(Reader &reader) {
    return Read<T>::get(reader);
}

// 按类型打印结果, 格式与 LeetCode 的示例输出一致
template <typename T>
inline void print(const T &value) {
    std::cout << Show<T>::get(value) << std::endl;
}

} // namespace lc_local`;

/** 公共头文件的文件名, 与题目文件放在同一目录. */
export const RUNNER_HEADER_NAME: string = "lc_local.h";

/** 头文件内容的版本, 用来判断磁盘上的副本是否需要更新. */
export const RUNNER_HEADER_VERSION: string = "1";

/** 生成的文件都带这一行, 据此判断某个 lc_local.h 是否由本扩展生成. */
export const RUNNER_HEADER_MARKER: string = "azazo1.vscode-leetcode";

/**
 * 公共头文件的完整内容.
 *
 * 把辅助代码集中到一份头文件里, 题目文件就只剩 include 与解答本身.
 * ListNode / TreeNode 的定义用宏保护, 题目自身已定义时可在 include 前定义对应宏跳过.
 */
export function buildRunnerHeader(): string {
    return [
        `// ${RUNNER_HEADER_NAME} - 由 ${RUNNER_HEADER_MARKER} 生成, 供本地编译运行 LeetCode C++ 解答使用.`,
        `// version: ${RUNNER_HEADER_VERSION}`,
        "// 它位于 @lc 标记之外, 提交题目时不会发送给 LeetCode.",
        "// 可以安全删除, 下次打开题目时会重新生成. 手工修改会在版本更新时被覆盖.",
        "",
        "#ifndef LC_LOCAL_H",
        "#define LC_LOCAL_H",
        "",
        INCLUDES,
        "",
        "// 题目的初始代码只把这两个结构体放在注释里, 这里补上真正的定义.",
        "#ifndef LC_LOCAL_NO_LISTNODE",
        LIST_NODE,
        "#endif",
        "",
        "#ifndef LC_LOCAL_NO_TREENODE",
        TREE_NODE,
        "#endif",
        "",
        RUNNER_SUPPORT,
        "",
        "#endif  // LC_LOCAL_H",
        "",
    ].join("\n");
}
