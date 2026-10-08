python := if os_family() == "windows" { "python" } else { "python3" }

[private]
default:
    @just --list

# package-lock.json 中 4 个包的 resolved 指向证书过期的 cnpmjs 镜像,
# 这里强制丢弃 lockfile 里的 host, 统一改走官方源.
# 安装 npm 依赖.
install:
    {{python}} scripts/build.py install

# 直接调用 node_modules/.bin/tsc, 跳过 npm 包装层, 省掉一次 node 启动开销.
# 编译 TypeScript 到 out/.
compile:
    {{python}} scripts/build.py compile

# 监听源码变化持续编译.
watch:
    {{python}} scripts/build.py watch

# 运行 tslint 检查.
lint:
    {{python}} scripts/build.py lint

# just vsix --out .tmp/vscode-leetcode.vsix
# 默认输出到项目根目录, vsce 内部会先触发编译.
# 打包 vsix.
vsix *args:
    {{python}} scripts/build.py vsix {{args}}

# 只清 out/ 与根目录下的 vsix, 不动 node_modules.
# 清理编译与打包产物.
clean:
    {{python}} scripts/build.py clean
