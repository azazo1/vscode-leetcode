#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vscode-leetcode 本地构建入口.

跨平台相关的处理集中在这里, justfile 只做薄封装.
用法见 `just` 或 `python3 scripts/build.py --help`.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NPM_REGISTRY = "https://registry.npmjs.org"
VSCE_PACKAGE = "@vscode/vsce@latest"

logging.basicConfig(level=logging.INFO, format="[build] %(message)s")
log = logging.getLogger("build")


def run(command: list[str]) -> None:
    """执行外部命令, 失败时以相同退出码结束进程."""
    log.info("运行 %s", " ".join(command))
    result = subprocess.run(command, cwd=ROOT, text=True)
    if result.returncode != 0:
        log.error("命令退出码 %d", result.returncode)
        raise SystemExit(result.returncode)


def tool(name: str) -> str:
    """查找 PATH 中的命令行工具."""
    found = shutil.which(name)
    if found is None:
        log.error("找不到 %s, 请先安装 Node.js (https://nodejs.org)", name)
        raise SystemExit(1)
    return found


def local_bin(name: str) -> str:
    """定位 node_modules/.bin 下的可执行文件, Windows 上优先 .cmd."""
    suffixes = [".cmd", ".bat", ""] if os.name == "nt" else [""]
    for suffix in suffixes:
        candidate = ROOT / "node_modules" / ".bin" / f"{name}{suffix}"
        if candidate.is_file():
            return str(candidate)
    log.error("本地工具 %s 不存在, 请先运行 just install", name)
    raise SystemExit(1)


def require_dependencies() -> None:
    """编译和打包都依赖 node_modules."""
    if not (ROOT / "node_modules").is_dir():
        log.error("node_modules 不存在, 请先运行 just install")
        raise SystemExit(1)


def read_version() -> str:
    """从 package.json 读取扩展版本号."""
    manifest = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    return manifest["version"]


def cmd_install(_: argparse.Namespace) -> None:
    """安装依赖.

    package-lock.json 中 axios, follow-redirects, form-data, proxy-from-env
    的 resolved 指向 r.cnpmjs.org 与 r2.cnpmjs.org, 这两个域名的证书已经过期.
    直接 npm ci 会以 CERT_HAS_EXPIRED 中断, --replace-registry-host=always
    让 npm 丢弃 lockfile 里的 host 并统一走官方源.
    """
    run(
        [
            tool("npm"),
            "ci",
            f"--registry={NPM_REGISTRY}",
            "--replace-registry-host=always",
        ]
    )


def cmd_compile(_: argparse.Namespace) -> None:
    """编译 TypeScript, 直接调用 tsc 跳过 npm 包装层."""
    require_dependencies()
    run([local_bin("tsc"), "-p", "./"])


def cmd_watch(_: argparse.Namespace) -> None:
    """监听模式编译."""
    require_dependencies()
    run([local_bin("tsc"), "--watch", "-p", "./"])


def cmd_lint(_: argparse.Namespace) -> None:
    """复用 package.json 中的 lint 脚本, 参数只有一份来源."""
    require_dependencies()
    run([tool("npm"), "run", "lint"])


def cmd_vsix(args: argparse.Namespace) -> None:
    """打包 vsix, vsce 会自行触发 vscode:prepublish 完成编译."""
    require_dependencies()
    target = Path(args.out) if args.out else ROOT / f"vscode-leetcode-{read_version()}.vsix"
    target = target if target.is_absolute() else ROOT / target
    target.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            tool("npx"),
            "--yes",
            VSCE_PACKAGE,
            "package",
            "--out",
            str(target),
        ]
    )
    size = target.stat().st_size / 1024 / 1024
    log.info("产物 %s (%.1f MB)", target, size)


def cmd_clean(_: argparse.Namespace) -> None:
    """删除编译产物与打包产物, 不动 node_modules."""
    removed: list[str] = []
    out_dir = ROOT / "out"
    if out_dir.is_dir():
        shutil.rmtree(out_dir)
        removed.append("out/")
    for vsix in sorted(ROOT.glob("*.vsix")):
        vsix.unlink()
        removed.append(vsix.name)
    log.info("已清理 %s", ", ".join(removed) if removed else "无")


def main() -> None:
    parser = argparse.ArgumentParser(description="vscode-leetcode 本地构建入口")
    subparsers = parser.add_subparsers(dest="command", required=True)

    commands = {
        "install": (cmd_install, "安装依赖"),
        "compile": (cmd_compile, "编译 TypeScript 到 out/"),
        "watch": (cmd_watch, "监听模式编译"),
        "lint": (cmd_lint, "代码检查"),
        "clean": (cmd_clean, "清理编译与打包产物"),
    }
    for name, (handler, description) in commands.items():
        subparsers.add_parser(name, help=description).set_defaults(handler=handler)

    vsix_parser = subparsers.add_parser("vsix", help="打包 vsix")
    vsix_parser.add_argument("--out", help="输出路径, 默认 vscode-leetcode-<version>.vsix")
    vsix_parser.set_defaults(handler=cmd_vsix)

    args = parser.parse_args()
    args.handler(args)


if __name__ == "__main__":
    main()
