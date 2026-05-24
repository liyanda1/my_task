#!/usr/bin/env python3
"""
Skill Guard - 确定性聚合脚本

读取 workspace 目录结构下的 grading.json + eval_metadata.json，
聚合生成 benchmark.json。

用法:
    python3 scripts/aggregate.py <workspace_dir> [--skill-name <name>]

输入文件结构:
    <workspace>/
    ├── eval-0/
    │   ├── eval_metadata.json
    │   ├── current/
    │   │   └── grading.json
    │   └── baseline/
    │       └── grading.json
    ├── eval-1/
    │   └── ...

输出:
    <workspace>/benchmark.json
"""

import json
import math
import os
import re
import sys
import base64
from datetime import datetime, timezone


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def calculate_stats(values):
    """计算 mean / stddev / min / max."""
    if not values:
        return {"mean": 0, "stddev": 0, "min": 0, "max": 0}
    n = len(values)
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1) if n > 1 else 0
    stddev = math.sqrt(variance)
    return {
        "mean": round(mean, 4),
        "stddev": round(stddev, 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
    }


def safe_read_json(filepath):
    """安全读取 JSON，失败返回 None."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def load_output_files(outputs_dir, max_text_chars=5000, max_base64_bytes=1024*1024):
    """读取 outputs 目录下的文件，嵌入到 benchmark.json。

    - 文本文件：读取前 max_text_chars 字符
    - 图片文件（png/jpg/gif/webp）：转 base64 data URI（仅 < 1MB）
    - 其他文件：只记录文件名，type=Binary
    """
    if not os.path.isdir(outputs_dir):
        return []

    results = []
    for fname in sorted(os.listdir(outputs_dir)):
        fpath = os.path.join(outputs_dir, fname)
        if not os.path.isfile(fpath):
            continue
        ext = os.path.splitext(fname)[1].lower()

        # 文本文件
        if ext in (".txt", ".md", ".json", ".py", ".js", ".html", ".css",
                       ".csv", ".tsv", ".xml", ".yaml", ".yml", ".log"):
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read(max_text_chars + 1)
                if len(content) > max_text_chars:
                    content = content[:max_text_chars] + "\n\n[truncated...]"
                results.append({
                    "name": fname,
                    "type": "text",
                    "content": content,
                })
            except Exception:
                results.append({"name": fname, "type": "binary"})
        # 图片文件
        elif ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            try:
                with open(fpath, "rb") as f:
                    raw = f.read()
                if len(raw) <= max_base64_bytes:
                    b64 = base64.b64encode(raw).decode("ascii")
                    mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in (".jpg", ".jpeg") else "image/gif")
                    results.append({
                        "name": fname,
                        "type": "image",
                        "data_uri": f"data:{mime};base64,{b64}",
                    })
                else:
                    results.append({"name": fname, "type": "binary"})
            except Exception:
                results.append({"name": fname, "type": "binary"})
        # PDF
        elif ext == ".pdf":
            try:
                with open(fpath, "rb") as f:
                    raw = f.read()
                if len(raw) <= max_base64_bytes:
                    b64 = base64.b64encode(raw).decode("ascii")
                    results.append({
                        "name": fname,
                        "type": "pdf",
                        "data_uri": f"data:application/pdf;base64,{b64}",
                    })
                else:
                    results.append({"name": fname, "type": "binary"})
            except Exception:
                results.append({"name": fname, "type": "binary"})
        else:
            results.append({"name": fname, "type": "binary"})
    return results


def sorted_eval_dirs(workspace):
    """返回 workspace 下按数字排序的 eval-N 目录列表."""
    dirs = []
    if not os.path.isdir(workspace):
        return dirs
    for name in os.listdir(workspace):
        full = os.path.join(workspace, name)
        if os.path.isdir(full) and re.match(r"^eval-\d+$", name):
            dirs.append(full)
    dirs.sort(key=lambda d: int(re.match(r"eval-(\d+)", os.path.basename(d)).group(1)))
    return dirs


# ---------------------------------------------------------------------------
# 加载所有 run 结果
# ---------------------------------------------------------------------------

def load_runs(workspace):
    """遍历 workspace 下的 eval-N 目录，加载所有 run 结果."""
    eval_dirs = sorted_eval_dirs(workspace)
    runs = []
    eval_ids = []
    notes = []

    if not eval_dirs:
        notes.append("No eval-N directories found in workspace")
        return runs, eval_ids, notes

    for eval_dir in eval_dirs:
        eval_name = os.path.basename(eval_dir)

        # 读取 eval_metadata.json
        metadata = safe_read_json(os.path.join(eval_dir, "eval_metadata.json")) or {}
        eval_id = metadata.get("eval_id", eval_name)
        eval_title = metadata.get("eval_name", f"Eval #{eval_id}")
        prompt = metadata.get("prompt", "")
        expected_output = metadata.get("expected_output", "")
        eval_ids.append(eval_id)

        # 处理 current / baseline
        for config in ("current", "baseline"):
            config_dir = os.path.join(eval_dir, config)
            if not os.path.isdir(config_dir):
                notes.append(f"Warning: {eval_name}/{config} directory not found")
                continue

            grading_file = os.path.join(config_dir, "grading.json")

            grading = safe_read_json(grading_file)
            if grading is None:
                notes.append(f"Warning: grading.json not found for {eval_name}/{config}")
                continue

            summary = grading.get("summary", {})

            # 提取 expectations
            expectations = []
            for exp in grading.get("expectations", []):
                expectations.append({
                    "text": exp.get("text", ""),
                    "passed": exp.get("passed", False),
                    "evidence": exp.get("evidence", ""),
                })

            # 提取 claims / eval_feedback / user_notes_summary
            claims = grading.get("claims", [])
            eval_feedback = grading.get("eval_feedback", {})
            user_notes = grading.get("user_notes_summary", {})

            # 加载 output 文件
            outputs = load_output_files(config_dir)

            runs.append({
                "eval_id": eval_id,
                "eval_name": eval_title,
                "configuration": config,
                "run_number": 1,
                "prompt": prompt,
                "expected_output": expected_output,
                "result": {
                    "pass_rate": summary.get("pass_rate", 0),
                    "passed": summary.get("passed", 0),
                    "failed": summary.get("failed", 0),
                    "total": summary.get("total", 0),
                },
                "expectations": expectations,
                "claims": claims,
                "eval_feedback": eval_feedback if eval_feedback else {},
                "outputs": outputs,
                "notes": [],
            })

    return runs, eval_ids, notes


# ---------------------------------------------------------------------------
# 聚合统计
# ---------------------------------------------------------------------------

def aggregate(runs):
    """按 config 聚合统计 + 计算 delta."""
    configs = {}
    for run in runs:
        cfg = run["configuration"]
        if cfg not in configs:
            configs[cfg] = []
        configs[cfg].append(run)

    run_summary = {}
    for cfg, cfg_runs in configs.items():
        run_summary[cfg] = {
            "pass_rate": calculate_stats([r["result"]["pass_rate"] for r in cfg_runs]),
        }

    # delta: current - baseline
    cfg_keys = list(run_summary.keys())
    primary = run_summary.get(cfg_keys[0], {}) if cfg_keys else {}
    baseline_val = run_summary.get(cfg_keys[1], {}) if len(cfg_keys) >= 2 else {}

    delta_pr = (primary.get("pass_rate", {}).get("mean", 0) -
                baseline_val.get("pass_rate", {}).get("mean", 0))

    run_summary["delta"] = {
        "pass_rate": f"{delta_pr:+.2f}",
    }

    return run_summary


# ---------------------------------------------------------------------------
# 退化检测
# ---------------------------------------------------------------------------

def detect_regressions(runs, eval_ids):
    """检测退化：pass_rate 下降超过 1% 的 eval."""
    regressions = []
    for eid in eval_ids:
        curr = [r for r in runs if r["eval_id"] == eid and r["configuration"] == "current"]
        base = [r for r in runs if r["eval_id"] == eid and r["configuration"] == "baseline"]
        if curr and base:
            c_pr = curr[0]["result"]["pass_rate"]
            b_pr = base[0]["result"]["pass_rate"]
            if c_pr < b_pr - 0.01:
                regressions.append(
                    f"REGRESSION: {curr[0]['eval_name']} (eval-{eid}) "
                    f"pass_rate dropped from {b_pr*100:.1f}% to {c_pr*100:.1f}%"
                )
    return regressions


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 aggregate.py <workspace_dir> [--skill-name <name>]", file=sys.stderr)
        sys.exit(1)

    workspace = os.path.abspath(sys.argv[1])
    skill_name = ""

    # 解析可选参数
    args = sys.argv[2:]
    i = 0
    while i < len(args):
        if args[i] == "--skill-name" and i + 1 < len(args):
            skill_name = args[i + 1]
            i += 2
        else:
            i += 1

    if not os.path.isdir(workspace):
        print(f"ERROR: workspace not found: {workspace}", file=sys.stderr)
        sys.exit(1)

    # 加载数据
    runs, eval_ids, notes = load_runs(workspace)
    if not runs:
        print(f"ERROR: no valid grading results found in {workspace}", file=sys.stderr)
        sys.exit(1)

    # 聚合
    run_summary = aggregate(runs)

    # 退化检测
    regression_notes = detect_regressions(runs, eval_ids)
    notes.extend(regression_notes)

    # 构建 benchmark.json
    benchmark = {
        "metadata": {
            "skill_name": skill_name,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "evals_run": eval_ids,
            "runs_per_configuration": 1,
        },
        "runs": runs,
        "run_summary": run_summary,
        "notes": notes,
    }

    # 写入
    output_path = os.path.join(workspace, "benchmark.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark, f, ensure_ascii=False, indent=2)

    # 摘要输出
    cfg_keys = [k for k in run_summary if k != "delta"]
    print(f"benchmark.json written to {output_path}")
    print(f"  evals: {len(eval_ids)}, configs: {cfg_keys}")
    if regression_notes:
        print(f"  REGRESSIONS: {len(regression_notes)}")
        for n in regression_notes:
            print(f"    - {n}")
    else:
        print("  no regressions detected")
    sys.exit(0)


if __name__ == "__main__":
    main()
