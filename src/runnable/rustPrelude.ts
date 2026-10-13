// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

/**
 * Rust 本地编译运行所需的辅助代码.
 *
 * 这段内容放在题目文件旁边的 lc_local.rs 里, 题目文件用 include! 引入它.
 * 它位于 @lc 标记之外, 提交题目时不会被发送给 LeetCode.
 * 使用 String.raw 是为了让反斜杠按字面保留, 避免 TypeScript 提前把 '\n' 之类转义成真实字符.
 */

/** 辅助文件的文件名, 与题目文件放在同一目录. */
export const RUST_HELPER_NAME: string = "lc_local.rs";

/** 辅助代码的版本, 用来判断磁盘上的副本是否需要更新. */
export const RUST_HELPER_VERSION: string = "1";

/** 生成的文件都带这一行, 据此判断某个 lc_local.rs 是否由本扩展生成. */
export const RUST_HELPER_MARKER: string = "azazo1.vscode-leetcode";

/** 辅助代码所在的模块名, 题目文件通过它引用里面的类型与函数. */
export const RUST_HELPER_MODULE: string = "lc_local";

/**
 * 辅助模块的全部内容.
 *
 * 题目的初始代码里只有 impl Solution, 而 Solution / ListNode / TreeNode 由 LeetCode
 * 在判题时自行提供, 因此本地编译必须补上这三个类型.
 *
 * 它们放在模块里而不是直接铺在题目文件中: 题目文件用 `use self::lc_local::...` 按需引入,
 * 万一题目自己定义了同名的结构体, 不引入即可, 不会出现重复定义.
 */
const HELPER_MODULE: string = String.raw`mod lc_local {
    #![allow(dead_code)]

    use std::cell::RefCell;
    use std::collections::VecDeque;
    use std::io::BufRead;
    use std::rc::Rc;

    /// LeetCode 判题时会自行提供这个类型, 本地编译需要自己补上.
    pub struct Solution;

    /// 单链表节点, 与题目注释里给出的定义一致.
    #[derive(PartialEq, Eq, Clone, Debug)]
    pub struct ListNode {
        pub val: i32,
        pub next: Option<Box<ListNode>>,
    }

    impl ListNode {
        #[inline]
        pub fn new(val: i32) -> Self {
            ListNode { val, next: None }
        }
    }

    /// 二叉树节点, 与题目注释里给出的定义一致.
    #[derive(Debug, PartialEq, Eq)]
    pub struct TreeNode {
        pub val: i32,
        pub left: Option<Rc<RefCell<TreeNode>>>,
        pub right: Option<Rc<RefCell<TreeNode>>>,
    }

    impl TreeNode {
        #[inline]
        pub fn new(val: i32) -> Self {
            TreeNode { val, left: None, right: None }
        }
    }

    /// 从输入里读出一个值.
    pub trait LcRead: Sized {
        fn lc_read(reader: &mut Reader) -> Self;
    }

    /// 按 LeetCode 示例的格式输出一个值.
    pub trait LcShow {
        fn lc_show(&self) -> String;
    }

    /// 极简输入解析器, 支持整数, 浮点, 布尔, 字符串以及它们的嵌套数组.
    pub struct Reader {
        chars: Vec<char>,
        pos: usize,
    }

    impl Reader {
        pub fn new(text: &str) -> Reader {
            Reader { chars: text.chars().collect(), pos: 0 }
        }

        fn current(&self) -> Option<char> {
            self.chars.get(self.pos).copied()
        }

        fn skip_spaces(&mut self) {
            while self.current().map_or(false, |character| character.is_whitespace()) {
                self.pos += 1;
            }
        }

        fn current_after_spaces(&mut self) -> Option<char> {
            self.skip_spaces();
            self.current()
        }

        fn starts_with(&self, word: &str) -> bool {
            let expected: Vec<char> = word.chars().collect();
            let end: usize = self.pos + expected.len();
            end <= self.chars.len() && self.chars[self.pos..end] == expected[..]
        }

        /// 输入是否为空 (只含空白字符).
        pub fn empty(&self) -> bool {
            self.chars.iter().all(|character| character.is_whitespace())
        }

        /// 下一个非空白字符恰好是 expected 时消耗掉它.
        pub fn eat(&mut self, expected: char) -> bool {
            if self.current_after_spaces() == Some(expected) {
                self.pos += 1;
                true
            } else {
                false
            }
        }

        pub fn read_integer(&mut self) -> i64 {
            self.skip_spaces();
            let start: usize = self.pos;
            if self.current() == Some('-') || self.current() == Some('+') {
                self.pos += 1;
            }
            while self.current().map_or(false, |character| character.is_ascii_digit()) {
                self.pos += 1;
            }
            if start == self.pos {
                return 0;
            }
            let text: String = self.chars[start..self.pos].iter().collect();
            text.parse::<i64>().unwrap_or(0)
        }

        pub fn read_double(&mut self) -> f64 {
            self.skip_spaces();
            let start: usize = self.pos;
            if self.current() == Some('-') || self.current() == Some('+') {
                self.pos += 1;
            }
            while self.current().map_or(false, |character| character.is_ascii_digit() || character == '.') {
                self.pos += 1;
            }
            if self.current() == Some('e') || self.current() == Some('E') {
                self.pos += 1;
                if self.current() == Some('-') || self.current() == Some('+') {
                    self.pos += 1;
                }
                while self.current().map_or(false, |character| character.is_ascii_digit()) {
                    self.pos += 1;
                }
            }
            if start == self.pos {
                return 0.0;
            }
            let text: String = self.chars[start..self.pos].iter().collect();
            text.parse::<f64>().unwrap_or(0.0)
        }

        pub fn read_bool(&mut self) -> bool {
            self.skip_spaces();
            if self.starts_with("true") {
                self.pos += 4;
                return true;
            }
            if self.starts_with("false") {
                self.pos += 5;
                return false;
            }
            self.read_integer() != 0
        }

        /// 读取一个字符串, 兼容带引号与不带引号两种写法.
        pub fn read_string(&mut self) -> String {
            self.skip_spaces();
            if self.current() == Some('"') {
                self.pos += 1;
                let mut result: String = String::new();
                while let Some(character) = self.current() {
                    if character == '"' {
                        self.pos += 1;
                        break;
                    }
                    if character == '\\' {
                        self.pos += 1;
                        match self.current() {
                            Some('n') => result.push('\n'),
                            Some('t') => result.push('\t'),
                            Some('r') => result.push('\r'),
                            Some(other) => result.push(other),
                            None => break,
                        }
                        self.pos += 1;
                        continue;
                    }
                    result.push(character);
                    self.pos += 1;
                }
                return result;
            }
            let mut result: String = String::new();
            while let Some(character) = self.current() {
                if character == ',' || character == ']' || character == '\n' {
                    break;
                }
                result.push(character);
                self.pos += 1;
            }
            result.trim_end().to_string()
        }

        /// 按目标类型读入一个值.
        pub fn read<T: LcRead>(&mut self) -> T {
            T::lc_read(self)
        }
    }

    macro_rules! lc_read_impl_integer {
        ($($target:ty),*) => {
            $(
                impl LcRead for $target {
                    fn lc_read(reader: &mut Reader) -> Self {
                        reader.read_integer() as $target
                    }
                }
            )*
        };
    }

    macro_rules! lc_read_impl_double {
        ($($target:ty),*) => {
            $(
                impl LcRead for $target {
                    fn lc_read(reader: &mut Reader) -> Self {
                        reader.read_double() as $target
                    }
                }
            )*
        };
    }

    macro_rules! lc_show_impl_display {
        ($($target:ty),*) => {
            $(
                impl LcShow for $target {
                    fn lc_show(&self) -> String {
                        self.to_string()
                    }
                }
            )*
        };
    }

    lc_read_impl_integer!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize);
    lc_read_impl_double!(f32, f64);
    lc_show_impl_display!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize, f32, f64);

    impl LcRead for bool {
        fn lc_read(reader: &mut Reader) -> Self {
            reader.read_bool()
        }
    }

    impl LcRead for char {
        fn lc_read(reader: &mut Reader) -> Self {
            reader.read_string().chars().next().unwrap_or('\0')
        }
    }

    impl LcRead for String {
        fn lc_read(reader: &mut Reader) -> Self {
            reader.read_string()
        }
    }

    impl<T: LcRead> LcRead for Vec<T> {
        fn lc_read(reader: &mut Reader) -> Self {
            let mut values: Vec<T> = Vec::new();
            if !reader.eat('[') {
                return values;
            }
            if reader.eat(']') {
                return values;
            }
            loop {
                values.push(reader.read::<T>());
                if reader.eat(',') {
                    continue;
                }
                reader.eat(']');
                break;
            }
            values
        }
    }

    impl LcRead for Option<Box<ListNode>> {
        fn lc_read(reader: &mut Reader) -> Self {
            let values: Vec<i32> = reader.read();
            let mut head: Option<Box<ListNode>> = None;
            for value in values.into_iter().rev() {
                head = Some(Box::new(ListNode { val: value, next: head }));
            }
            head
        }
    }

    impl LcRead for Option<Rc<RefCell<TreeNode>>> {
        fn lc_read(reader: &mut Reader) -> Self {
            let tokens: Vec<String> = reader.read();
            if tokens.is_empty() || tokens[0] == "null" {
                return None;
            }
            let root: Rc<RefCell<TreeNode>> =
                Rc::new(RefCell::new(TreeNode::new(tokens[0].parse::<i32>().unwrap_or(0))));
            let mut pending: VecDeque<Rc<RefCell<TreeNode>>> = VecDeque::new();
            pending.push_back(root.clone());
            let mut index: usize = 1;
            while index < tokens.len() {
                let node: Rc<RefCell<TreeNode>> = match pending.pop_front() {
                    Some(node) => node,
                    None => break,
                };
                for side in 0..2 {
                    if index >= tokens.len() {
                        break;
                    }
                    if tokens[index] != "null" {
                        let value: i32 = tokens[index].parse::<i32>().unwrap_or(0);
                        let child: Rc<RefCell<TreeNode>> = Rc::new(RefCell::new(TreeNode::new(value)));
                        if side == 0 {
                            node.borrow_mut().left = Some(child.clone());
                        } else {
                            node.borrow_mut().right = Some(child.clone());
                        }
                        pending.push_back(child);
                    }
                    index += 1;
                }
            }
            Some(root)
        }
    }

    impl LcShow for bool {
        fn lc_show(&self) -> String {
            if *self {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
    }

    impl LcShow for char {
        fn lc_show(&self) -> String {
            format!("\"{}\"", self)
        }
    }

    impl LcShow for String {
        fn lc_show(&self) -> String {
            format!("\"{}\"", self)
        }
    }

    impl<T: LcShow> LcShow for Vec<T> {
        fn lc_show(&self) -> String {
            let parts: Vec<String> = self.iter().map(|value| value.lc_show()).collect();
            format!("[{}]", parts.join(","))
        }
    }

    impl LcShow for Option<Box<ListNode>> {
        fn lc_show(&self) -> String {
            let mut parts: Vec<String> = Vec::new();
            let mut current: Option<&Box<ListNode>> = self.as_ref();
            while let Some(node) = current {
                parts.push(node.val.to_string());
                current = node.next.as_ref();
            }
            format!("[{}]", parts.join(","))
        }
    }

    impl LcShow for Option<Rc<RefCell<TreeNode>>> {
        fn lc_show(&self) -> String {
            let mut parts: Vec<String> = Vec::new();
            let mut pending: VecDeque<Option<Rc<RefCell<TreeNode>>>> = VecDeque::new();
            pending.push_back(self.clone());
            while let Some(item) = pending.pop_front() {
                match item {
                    None => parts.push("null".to_string()),
                    Some(node) => {
                        parts.push(node.borrow().val.to_string());
                        let left: Option<Rc<RefCell<TreeNode>>> = node.borrow().left.clone();
                        let right: Option<Rc<RefCell<TreeNode>>> = node.borrow().right.clone();
                        pending.push_back(left);
                        pending.push_back(right);
                    }
                }
            }
            while parts.last().map_or(false, |part| part.as_str() == "null") {
                parts.pop();
            }
            format!("[{}]", parts.join(","))
        }
    }

    /// 按 LeetCode 示例的格式打印结果.
    pub fn print<T: LcShow>(value: &T) {
        println!("{}", value.lc_show());
    }

    /// 读入标准输入. 没有输入时给出用法提示, 而不是静默地按默认值运行.
    pub fn read_stdin() -> String {
        let stdin = std::io::stdin();
        let mut text: String = String::new();
        let mut first_line: bool = true;
        for line in stdin.lock().lines() {
            let line: String = line.unwrap_or_default();
            // 第一行直接回车表示不提供输入
            if first_line && line.is_empty() {
                break;
            }
            first_line = false;
            text.push_str(&line);
            text.push('\n');
        }
        if text.trim().is_empty() {
            println!("未提供测试输入. 每行传入一个参数, 顺序与类型见本文件 main 上方的注释.");
            println!("  ./<可执行文件> < input.txt");
            println!("  printf '[2,7,11,15]\\n9\\n' | ./<可执行文件>");
        }
        text
    }
}`;

/** 生成 lc_local.rs 的完整内容. */
export function buildRustHelper(): string {
    return [
        `// ${RUST_HELPER_NAME} - 由 ${RUST_HELPER_MARKER} 生成, 供本地编译运行 LeetCode Rust 解答使用.`,
        `// version: ${RUST_HELPER_VERSION}`,
        "// 它位于 @lc 标记之外, 提交题目时不会发送给 LeetCode.",
        "// 可以安全删除, 下次打开题目时会重新生成. 手工修改会在版本更新时被覆盖.",
        "",
        HELPER_MODULE,
        "",
    ].join("\n");
}
