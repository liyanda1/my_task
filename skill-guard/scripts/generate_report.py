#!/usr/bin/env python3
"""
Skill Guard — 确定性报告生成脚本

读取 benchmark.json + HTML 模板，生成自包含静态 HTML 报告。

用法:
    # 聚合报告（所有 eval 在一个页面）
    python3 scripts/generate_report.py <benchmark.json> <template.html> <output.html>

    # 按用例报告（每个 eval 生成独立 report.html）
    python3 scripts/generate_report.py <benchmark.json> <template.html> <output_dir> --per-eval

    # 同时生成聚合 + 按用例报告
    python3 scripts/generate_report.py <benchmark.json> <agg_template.html> <output.html> --per-eval-template <per_eval_template.html> --per-eval-dir <output_dir>
"""

import json
import os
import sys


def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def generate(template, data):
    """将 JSON 数据嵌入模板的 __BENCHMARK_DATA__ 占位符."""
    if "__BENCHMARK_DATA__" not in template:
        raise ValueError("Template does not contain __BENCHMARK_DATA__ placeholder")
    json_str = json.dumps(data, ensure_ascii=False)
    return template.replace("__BENCHMARK_DATA__", json_str)


def build_per_eval_benchmark(benchmark, eval_id):
    """从完整 benchmark 中提取单个 eval 的数据，构建子 benchmark."""
    runs = [r for r in benchmark.get("runs", []) if r["eval_id"] == eval_id]
    # 过滤 evals_run
    metadata = dict(benchmark.get("metadata", {}))
    metadata["evals_run"] = [eval_id]

    # 只保留该 eval 的 run_summary
    full_summary = benchmark.get("run_summary", {})
    run_summary = {}
    for cfg in full_summary:
        if cfg == "delta":
            # 重新计算该 eval 的 delta
            curr_runs = [r for r in runs if r["configuration"] == "current"]
            base_runs = [r for r in runs if r["configuration"] == "baseline"]
            if curr_runs and base_runs:
                c = curr_runs[0]["result"]
                b = base_runs[0]["result"]
                run_summary["delta"] = {
                    "pass_rate": f"{c['pass_rate'] - b['pass_rate']:+.2f}",
                }
        else:
            cfg_runs = [r for r in runs if r["configuration"] == cfg]
            if cfg_runs:
                prs = [r["result"]["pass_rate"] for r in cfg_runs]
                mean_pr = sum(prs) / len(prs)
                run_summary[cfg] = {
                    "pass_rate": {"mean": round(mean_pr, 4), "stddev": 0, "min": round(min(prs), 4), "max": round(max(prs), 4)},
                }

    # 只保留该 eval 相关的 notes
    notes = []
    for n in benchmark.get("notes", []):
        if str(eval_id) in n or f"eval-{eval_id}" in n:
            notes.append(n)

    return {
        "metadata": metadata,
        "runs": runs,
        "run_summary": run_summary,
        "notes": notes,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]
    if len(args) < 3:
        print(
            "Usage: python3 generate_report.py <benchmark.json> <template.html> <output> [--per-eval] "
            "[--per-eval-template <tpl> --per-eval-dir <dir>]",
            file=sys.stderr,
        )
        sys.exit(1)

    data_path = args[0]
    template_path = args[1]
    output = args[2]

    # 解析可选参数
    flag_per_eval = False
    per_eval_template = None
    per_eval_dir = None

    i = 3
    while i < len(args):
        if args[i] == "--per-eval":
            flag_per_eval = True
            i += 1
        elif args[i] == "--per-eval-template" and i + 1 < len(args):
            per_eval_template = args[i + 1]
            i += 2
        elif args[i] == "--per-eval-dir" and i + 1 < len(args):
            per_eval_dir = args[i + 1]
            i += 2
        else:
            i += 1

    # 读取 benchmark
    benchmark = json.loads(read_file(data_path))

    # --- 聚合报告 ---
    template = read_file(template_path)
    html = generate(template, benchmark)
    write_file(output, html)
    print(f"Aggregate report: {output}")

    # --- 按用例报告 ---
    if flag_per_eval or per_eval_template:
        if per_eval_template:
            pe_tpl = read_file(per_eval_template)
        else:
            # 使用同一个模板
            pe_tpl = template

        if per_eval_dir:
            pe_dir = per_eval_dir
        else:
            pe_dir = os.path.dirname(output)

        eval_ids = benchmark.get("metadata", {}).get("evals_run", [])
        for eid in eval_ids:
            sub_bm = build_per_eval_benchmark(benchmark, eid)
            sub_html = generate(pe_tpl, sub_bm)
            sub_path = os.path.join(pe_dir, f"eval-{eid}", "report.html")
            write_file(sub_path, sub_html)
            print(f"Per-eval report: {sub_path}")

    sys.exit(0)


if __name__ == "__main__":
    main()
