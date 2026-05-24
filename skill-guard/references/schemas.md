# JSON Schemas

This document defines the JSON schemas used by skill-guard.

---

## evals.json

Defines the regression test cases for a skill. Located at `evals/evals.json` within the skill directory.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "name": "core-feature-smoke-test",
      "prompt": "User's example prompt that exercises the core workflow",
      "expected_output": "Description of expected result",
      "files": ["evals/files/sample1.pdf"],
      "expectations": [
        "Output contains expected keyword X",
        "Tool call count is <= 5 (no loop)",
        "A result file with .json extension is generated"
      ]
    }
  ]
}
```

**Fields:**
- `skill_name`: Name matching the skill's SKILL.md frontmatter `name` field
- `evals[].id`: Unique integer identifier
- `evals[].name`: Short descriptive name for this eval case (used as section header in report)
- `evals[].prompt`: The task prompt to execute
- `evals[].expected_output`: Human-readable description of success
- `evals[].files`: Optional list of input file paths (relative to skill root)
- `evals[].expectations`: List of objectively verifiable statements

**Good vs Bad Expectations:**

| Good | Bad |
|------|-----|
| "Output contains the word DONE" | "Output looks good" |
| "Generated file has .py extension" | "Code quality is high" |
| "Tool call count <= 8" | "No problems found" |
| "Response mentions 'Red' or 'RED' phase" | "The agent did a great job" |

---

## eval_metadata.json

Per-eval metadata. Located at `<workspace>/eval-<i>/eval_metadata.json`.

```json
{
  "eval_id": 0,
  "eval_name": "core-feature-smoke-test",
  "prompt": "User's task prompt",
  "expected_output": "Description of expected result",
  "expectations": [
    "Output contains expected keyword X",
    "Tool call count is <= 5"
  ]
}
```

---

## grading.json

Output from grader agent. Located at `<workspace>/eval-<i>/<config>/grading.json`.

```json
{
  "expectations": [
    {
      "text": "Output contains expected keyword X",
      "passed": true,
      "evidence": "Found in outputs/result.txt: 'The result is X, confirmed.'"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  },
  "claims": [
    {
      "claim": "The form has 12 fillable fields",
      "type": "factual",
      "verified": true,
      "evidence": "Counted 12 fields in field_info.json"
    },
    {
      "claim": "All required fields were populated",
      "type": "quality",
      "verified": false,
      "evidence": "Reference section was left blank despite data being available"
    }
  ],
  "user_notes_summary": {
    "uncertainties": [],
    "needs_review": [],
    "workarounds": []
  },
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "Output contains keyword X",
        "reason": "A wrong output that happens to contain X would also pass"
      }
    ],
    "overall": "Assertions check presence but not correctness."
  }
}
```

**Fields:**

- **expectations[]**: Graded expectations with evidence
  - **text**: The original expectation text
  - **passed**: Boolean - true if expectation passes
  - **evidence**: Specific quote or description supporting the verdict
- **summary**: Aggregate statistics
  - **passed**: Count of passed expectations
  - **failed**: Count of failed expectations
  - **total**: Total expectations evaluated
  - **pass_rate**: Fraction passed (0.0 to 1.0)
- **claims[]**: (Optional) Extracted and verified claims from the output — catches issues that predefined expectations might miss
  - **claim**: The statement being verified
  - **type**: `"factual"` (can check against outputs), `"process"` (can verify from transcript), or `"quality"` (evaluate whether justified)
  - **verified**: Boolean - whether the claim holds
  - **evidence**: Supporting or contradicting evidence
- **user_notes_summary**: (Optional) Issues flagged by the executor — only present if `user_notes.md` exists in outputs_dir
  - **uncertainties**: Things the executor wasn't sure about
  - **needs_review**: Items requiring human attention
  - **workarounds**: Places where the skill didn't work as expected
- **eval_feedback**: (Optional) Improvement suggestions for the evals — only present when the grader identifies issues worth raising
  - **suggestions[]**: List of concrete suggestions, each with a `reason` and optionally an `assertion` it relates to
  - **overall**: Brief assessment — can be `"No suggestions, evals look solid"` if nothing to flag

---

## benchmark.json

Aggregated benchmark output. Located at `<workspace>/benchmark.json`.

Key difference from skill-creator: `configuration` uses `current` and `baseline` instead of `with_skill` / `without_skill`.

```json
{
  "metadata": {
    "skill_name": "sdd-task-develop",
    "timestamp": "2026-05-23T12:00:00Z",
    "evals_run": [1, 2, 3],
    "runs_per_configuration": 1
  },
  "runs": [
    {
      "eval_id": 1,
      "eval_name": "core-feature-smoke-test",
      "configuration": "current",
      "run_number": 1,
      "prompt": "User's task prompt for this eval",
      "expected_output": "Description of expected result",
      "result": {
        "pass_rate": 0.83,
        "passed": 5,
        "failed": 1,
        "total": 6
      },
      "expectations": [
        {"text": "Output contains keyword X", "passed": true, "evidence": "..."}
      ],
      "claims": [
        {"claim": "The form has 12 fields", "type": "factual", "verified": true, "evidence": "..."}
      ],
      "eval_feedback": {
        "suggestions": [{"reason": "Assertion would pass for wrong output"}],
        "overall": "Assertions need content verification"
      },
      "notes": []
    },
    {
      "eval_id": 1,
      "eval_name": "core-feature-smoke-test",
      "configuration": "baseline",
      "run_number": 1,
      "prompt": "User's task prompt for this eval",
      "expected_output": "Description of expected result",
      "result": {
        "pass_rate": 1.0,
        "passed": 6,
        "failed": 0,
        "total": 6
      },
      "expectations": [
        {"text": "Output contains keyword X", "passed": true, "evidence": "..."}
      ],
      "claims": [
        {"claim": "The form has 12 fields", "type": "factual", "verified": true, "evidence": "..."}
      ],
      "eval_feedback": {
        "suggestions": [],
        "overall": "No suggestions, evals look solid"
      },
      "notes": []
    }
  ],
  "run_summary": {
    "current": {
      "pass_rate": {"mean": 0.83, "stddev": 0.0, "min": 0.83, "max": 0.83}
    },
    "baseline": {
      "pass_rate": {"mean": 1.0, "stddev": 0.0, "min": 1.0, "max": 1.0}
    },
    "delta": {
      "pass_rate": "-0.17"
    }
  },
  "notes": [
    "REGRESSION: eval-1 pass_rate dropped from 1.0 to 0.83",
    "Expectation 'Tool call count <= 8' failed - current version made 12 calls"
  ]
}
```

**Fields:**

- `metadata`: Run metadata (skill name, timestamp, eval IDs)
- `runs[]`: Individual run results. Each eval has 2 runs: one `current`, one `baseline`
  - `configuration`: MUST be `"current"` or `"baseline"` (the HTML viewer uses these exact strings)
  - `prompt`: The eval's input prompt (from `eval_metadata.json`) — displayed in the report for context
  - `expected_output`: Human-readable description of expected result (from `evals.json` or `eval_metadata.json`)
  - `result`: Nested object with `pass_rate`, `passed`, `failed`, `total`
  - `expectations[]`: Graded expectations with `text`, `passed`, `evidence`
  - `claims[]`: (Optional) Extracted claims from output, for detecting untested behaviors
  - `eval_feedback`: (Optional) Suggestions for improving the evals themselves
- `run_summary`: Statistical aggregates per configuration
  - `current` / `baseline`: Each with `pass_rate` stats (mean/stddev/min/max)
  - `delta`: Difference strings like `"-0.17"`
- `notes`: Freeform observations about regressions or improvements
