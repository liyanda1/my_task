# Skill Benchmark: sdd-task-design

**Model**: glm-4.7
**Date**: 2026-04-22T14:07:15Z
**Evals**: 0, 1, 2, 3, 4, 5 (1 run each)

## Summary

| Metric | With Skill |
|--------|------------|
| Pass Rate | 92% ± 12% |
| Time | 42.2s ± 5.9s |
| Tokens | 4000 ± 0 |

## Detailed Results

| Eval ID | Name | Passed | Total | Pass Rate | Time (s) |
|---------|------|--------|-------|-----------|----------|
| 0 | 0 | 5/5 | 5 | 100% | 45.2 |
| 1 | 1 | 4/5 | 5 | 80% | 38.5 |
| 2 | 2 | 5/5 | 5 | 100% | 52.3 |
| 3 | 3 | 5/5 | 5 | 100% | 41.7 |
| 4 | 4 | 3/4 | 4 | 75% | 39.8 |
| 5 | 5 | 5/5 | 5 | 100% | 35.6 |

## Failed Assertions

### Eval 1: 1

- **没有完全跳过 Step 3**
  Evidence: Step 3 被跳过，直接进入设计

### Eval 4: 4

- **没有保留与设计矛盾的任务描述**
  Evidence: 部分矛盾的任务描述未更新
