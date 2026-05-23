/**
 * SDD Compaction Plugin for OpenCode
 *
 * When OpenCode triggers session compaction (auto or manual /compact),
 * this plugin injects SDD-domain-aware context into the summary prompt
 * via the experimental.session.compacting hook (append mode).
 *
 * Injected context includes:
 * - Current AR ID, topic, and directory
 * - Detected SDD phase (requirements/design/develop/review/st)
 * - Key file status (srs.md, design.md, tasks.md)
 * - Task progress table (compact: ID + description + status only)
 * - Phase-specific critical context (interface signatures, decisions, etc.)
 * - Key decisions from progress records
 *
 * For non-SDD projects (no specs/changes/ directory), the plugin
 * returns null and is completely transparent.
 */

import path from 'path';
import fs from 'fs';

// ─── AR Detection ────────────────────────────────────────────────────────────────

/**
 * Find the most recently modified AR directory under specs/changes/.
 * Returns the full path to the AR directory, or null if none found.
 */
const findCurrentAR = (changesDir) => {
  try {
    const entries = fs.readdirSync(changesDir, { withFileTypes: true });
    const arDirs = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name: e.name,
        path: path.join(changesDir, e.name),
        mtime: fs.statSync(path.join(changesDir, e.name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return arDirs.length > 0 ? arDirs[0] : null;
  } catch {
    return null;
  }
};

// ─── Phase Detection ─────────────────────────────────────────────────────────────

/**
 * Detect the current SDD phase from AR directory contents.
 * Logic mirrors sdd-router's detection rules (simplified, file-only).
 *
 * Returns: 'requirements' | 'design' | 'develop' | 'review' | 'st' | 'archived'
 */
const detectSddPhase = (arDir) => {
  const hasSrs = fs.existsSync(path.join(arDir, 'srs.md'));
  const hasDesign = fs.existsSync(path.join(arDir, 'design.md'));
  const hasTasks = fs.existsSync(path.join(arDir, 'tasks.md'));

  // No srs.md or tasks.md → still in requirements
  if (!hasSrs || !hasTasks) return 'requirements';

  // srs.md exists but design.md missing → requirements phase (srs done, awaiting design)
  if (!hasDesign) return 'design';

  // All core files exist — check task progress
  const tasksContent = safeRead(path.join(arDir, 'tasks.md'));
  if (!tasksContent) return 'requirements';

  const tasks = parseTaskTable(tasksContent);

  // Has pending or in_progress tasks → develop phase
  if (tasks.some(t => t.status === 'pending' || t.status === 'in_progress')) {
    return 'develop';
  }

  // All tasks passing — check review
  if (!hasRecordOfType(tasksContent, '审查记录', 'PASS')) {
    return 'review';
  }

  // Review passed — check ST
  if (!hasRecordOfType(tasksContent, 'ST', 'PASS') && !hasRecordOfType(tasksContent, 'ST', 'Go')) {
    return 'st';
  }

  return 'archived';
};

// ─── Task Table Parsing ──────────────────────────────────────────────────────────

/**
 * Parse the task table from tasks.md.
 * Expects a Markdown table with columns: ID, Description, Dependency, Status, Notes
 * Returns array of { id, description, status } (dependency and notes trimmed for compactness).
 */
const parseTaskTable = (content) => {
  const tasks = [];
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Detect table start (skip header row and separator)
    if (trimmed.startsWith('|') && trimmed.includes('ID') && trimmed.includes('Status')) {
      inTable = true;
      continue;
    }
    if (inTable && trimmed.startsWith('|') && trimmed.match(/^\|[\s-|]+\|$/)) {
      continue; // Skip separator row
    }
    if (inTable && trimmed.startsWith('|')) {
      const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 4) {
        // Table columns: ID | Description | Dependency | Status | Notes
        const status = cells[3] || '';
        const normalizedStatus = status.toLowerCase().includes('passing') ? 'passing'
          : status.toLowerCase().includes('in_progress') ? 'in_progress'
          : status.toLowerCase().includes('failed') ? 'failed'
          : status.toLowerCase().includes('pending') ? 'pending'
          : status;

        tasks.push({
          id: cells[0],
          description: cells[1],
          status: normalizedStatus,
        });
      }
    } else if (inTable && !trimmed.startsWith('|')) {
      inTable = false; // End of table
    }
  }

  return tasks;
};

/**
 * Extract task progress as compact Markdown table string.
 */
const extractTaskProgress = (arDir) => {
  const content = safeRead(path.join(arDir, 'tasks.md'));
  if (!content) return '(tasks.md not readable)';

  const tasks = parseTaskTable(content);
  if (tasks.length === 0) return '(no tasks found)';

  const rows = tasks.map(t => `| ${t.id} | ${truncate(t.description, 60)} | ${t.status} |`).join('\n');
  return `\n| ID | Description | Status |\n|----|-------------|--------|\n${rows}`;
};

// ─── Phase-Specific Context ─────────────────────────────────────────────────────

/**
 * Extract phase-specific critical context from SDD artifacts.
 * Each phase returns the most important ~10-20 lines of context.
 */
const extractPhaseContext = (arDir, phase) => {
  switch (phase) {
    case 'requirements':
      return extractRequirementsContext(arDir);
    case 'design':
      return extractDesignContext(arDir);
    case 'develop':
      return extractDevelopContext(arDir);
    case 'review':
      return extractReviewContext(arDir);
    case 'st':
      return extractSTContext(arDir);
    case 'archived':
      return '(AR is archived — no active context)';
    default:
      return '';
  }
};

/**
 * Requirements phase: functional requirements list from srs.md
 */
const extractRequirementsContext = (arDir) => {
  const content = safeRead(path.join(arDir, 'srs.md'));
  if (!content) return '(srs.md not readable)';

  const sections = [];
  // Extract §3.x section titles (e.g., "### 3.1 Function Name")
  const regex = /^###\s+(\d+\.\d+)\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    sections.push(`${match[1]} ${match[2]}`);
  }

  if (sections.length === 0) return '(no functional requirement sections found in srs.md)';
  return 'Functional Requirements:\n' + sections.map(s => `- ${s}`).join('\n');
};

/**
 * Design phase: design overview + module impact analysis from design.md
 */
const extractDesignContext = (arDir) => {
  const content = safeRead(path.join(arDir, 'design.md'));
  if (!content) return '(design.md not readable)';

  const parts = [];

  // Extract §1 design overview (first paragraph after ## 1.)
  const overviewMatch = content.match(/^##\s+1\.\s+.+?\n\n([\s\S]*?)(?=\n##\s|\n###\s|$)/m);
  if (overviewMatch) {
    parts.push('Design Overview:\n' + truncate(overviewMatch[1].trim(), 300));
  }

  // Extract §2 module impact table
  const impactMatch = content.match(/^##\s+2\.\s+.+?\n([\s\S]*?)(?=\n##\s|\n###\s+[^#]/m);
  if (impactMatch) {
    const tableLines = impactMatch[1].trim().split('\n').filter(l => l.startsWith('|')).slice(0, 8);
    if (tableLines.length > 0) {
      parts.push('Module Impact:\n' + tableLines.join('\n'));
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : '(no design overview or impact analysis found)';
};

/**
 * Develop phase: interface signatures + current task details from design.md and tasks.md
 */
const extractDevelopContext = (arDir) => {
  const parts = [];

  // Current task from tasks.md
  const tasksContent = safeRead(path.join(arDir, 'tasks.md'));
  if (tasksContent) {
    const tasks = parseTaskTable(tasksContent);
    const currentTask = tasks.find(t => t.status === 'in_progress')
      || tasks.find(t => t.status === 'pending');
    if (currentTask) {
      parts.push(`Current/Next Task: ${currentTask.id} — ${currentTask.description}`);
    }
    const passingTasks = tasks.filter(t => t.status === 'passing');
    if (passingTasks.length > 0) {
      parts.push(`Completed Tasks: ${passingTasks.map(t => t.id).join(', ')}`);
    }
  }

  // Interface signatures from design.md §3
  const designContent = safeRead(path.join(arDir, 'design.md'));
  if (designContent) {
    const interfaceMatch = designContent.match(/^##\s+3\.\s+.+?\n([\s\S]*?)(?=\n##\s[4-9]|\n##\s+\d{2,})/m);
    if (interfaceMatch) {
      // Extract function signatures from code blocks within §3
      const codeBlocks = interfaceMatch[1].match(/```[\s\S]*?```/g) || [];
      if (codeBlocks.length > 0) {
        const signatures = codeBlocks
          .map(b => b.replace(/```\w*\n?/g, '').trim())
          .filter(b => b.length > 0)
          .slice(0, 15);
        if (signatures.length > 0) {
          parts.push('Interface Signatures (from design.md §3):\n```' + signatures.join('\n---\n') + '```');
        }
      }
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : '(no develop context found)';
};

/**
 * Review phase: recent progress records from tasks.md
 */
const extractReviewContext = (arDir) => {
  const content = safeRead(path.join(arDir, 'tasks.md'));
  if (!content) return '(tasks.md not readable)';

  // Extract all progress record sections
  const records = [];
  const recordRegex = /^###\s+(.+会话记录|.+审查记录)/gm;
  let match;
  const positions = [];
  while ((match = recordRegex.exec(content)) !== null) {
    positions.push({ title: match[1], start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const end = i + 1 < positions.length ? positions[i + 1].start : content.length;
    const record = content.slice(positions[i].start, end).trim();
    records.push(truncate(record, 200));
  }

  // Take last 3 records
  const recent = records.slice(-3);
  if (recent.length === 0) return '(no progress records found)';

  return 'Recent Progress Records:\n' + recent.map(r => '---\n' + r).join('\n');
};

/**
 * ST phase: test case summary from st-cases.md
 */
const extractSTContext = (arDir) => {
  const content = safeRead(path.join(arDir, 'st-cases.md'));
  if (!content) return '(st-cases.md not readable)';

  // Extract ST test case IDs
  const caseIds = [];
  const caseRegex = /^###\s+(ST-\d+)/gm;
  let match;
  while ((match = caseRegex.exec(content)) !== null) {
    caseIds.push(match[1]);
  }

  // Extract execution summary table
  const summaryMatch = content.match(/##\s+执行摘要[\s\S]*?\n(\|.+\|)\n(\|[-| ]+\|)\n([\s\S]*?)(?=\n##|\n###|$)/);
  let summaryTable = '';
  if (summaryMatch) {
    const tableLines = summaryMatch[0].split('\n').filter(l => l.startsWith('|')).slice(0, 6);
    summaryTable = '\nExecution Summary:\n' + tableLines.join('\n');
  }

  const caseList = caseIds.length > 0
    ? `Test Cases: ${caseIds.join(', ')}`
    : '(no test cases found)';

  return caseList + summaryTable;
};

// ─── Decision Extraction ─────────────────────────────────────────────────────────

/**
 * Extract key decisions from tasks.md progress records.
 * Looks for lines containing decision-related keywords.
 */
const extractDecisions = (arDir) => {
  const content = safeRead(path.join(arDir, 'tasks.md'));
  if (!content) return '';

  const keywords = ['决策', '选择', '方案', '选定', 'design', 'approach', 'decision'];
  const lines = content.split('\n');
  const decisions = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.slice(2);
      if (keywords.some(kw => text.toLowerCase().includes(kw))) {
        decisions.push(truncate(text, 120));
      }
    }
  }

  return decisions.length > 0
    ? decisions.slice(-5).map(d => `- ${d}`).join('\n')
    : '';
};

// ─── Formatting ──────────────────────────────────────────────────────────────────

/**
 * Build the final SDD context string to inject into compaction prompt.
 */
const formatContext = (arInfo, phase, taskProgress, phaseContext, decisions) => {
  const parts = [
    '## SDD Project State (Auto-extracted, DO NOT modify)',
    '',
    `**AR:** ${arInfo.name} (Directory: specs/changes/${arInfo.name}/)`,
    `**Current Phase:** ${phase}`,
    '',
    '### Key Files Status',
    `- srs.md: ${fs.existsSync(path.join(arInfo.path, 'srs.md')) ? 'exists' : 'not found'}`,
    `- design.md: ${fs.existsSync(path.join(arInfo.path, 'design.md')) ? 'exists' : 'not found'}`,
    `- tasks.md: ${fs.existsSync(path.join(arInfo.path, 'tasks.md')) ? 'exists' : 'not found'}`,
    `- st-cases.md: ${fs.existsSync(path.join(arInfo.path, 'st-cases.md')) ? 'exists' : 'not found'}`,
    '',
    '### Task Progress',
    taskProgress,
  ];

  if (phaseContext) {
    parts.push('', '### Phase-Specific Context', phaseContext);
  }

  if (decisions) {
    parts.push('', '### Critical Decisions', decisions);
  }

  return parts.join('\n');
};

// ─── Utility Functions ───────────────────────────────────────────────────────────

/** Safely read a file, return null on any error. */
const safeRead = (filePath) => {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  } catch {
    return null;
  }
};

/** Truncate string to maxLen characters, appending '...' if needed. */
const truncate = (str, maxLen) => {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + '...';
};

/** Check if tasks.md contains a progress record of a specific type with a specific result. */
const hasRecordOfType = (content, recordType, result) => {
  const regex = new RegExp(`###.*${recordType}.*\\n[\\s\\S]*?${result}`, 'i');
  return regex.test(content);
};

// ─── Main Context Builder ────────────────────────────────────────────────────────

/**
 * Main entry point: build SDD context string for compaction injection.
 * Returns null if this is not an SDD project (no specs/changes/).
 */
const buildSddContext = (directory) => {
  // 1. Check if specs/changes/ exists
  const changesDir = path.join(directory, 'specs', 'changes');
  if (!fs.existsSync(changesDir)) return null;

  // 2. Find current AR directory (most recently modified)
  const arInfo = findCurrentAR(changesDir);
  if (!arInfo) return null;

  // 3. Detect current phase
  const phase = detectSddPhase(arInfo.path);

  // 4. Extract task progress
  const taskProgress = extractTaskProgress(arInfo.path);

  // 5. Extract phase-specific context
  const phaseContext = extractPhaseContext(arInfo.path, phase);

  // 6. Extract key decisions
  const decisions = extractDecisions(arInfo.path);

  // 7. Build and return formatted context
  return formatContext(arInfo, phase, taskProgress, phaseContext, decisions);
};

// ─── Plugin Entry Point ──────────────────────────────────────────────────────────

/**
 * SDD Compaction Plugin for OpenCode.
 *
 * Uses the experimental.session.compacting hook (append mode) to inject
 * SDD-domain-aware context into the compaction summary prompt.
 *
 * The injected context ensures that after compaction, the model still knows:
 * - Which AR is being worked on
 * - What phase the AR is in
 * - What tasks are completed/in-progress/pending
 * - Critical interface signatures and design decisions
 *
 * For non-SDD projects, the plugin is completely transparent (returns null).
 *
 * Deployment: copy to .opencode/plugins/ in the target component project.
 */
export const SddCompactionPlugin = async ({ directory }) => {
  return {
    'experimental.session.compacting': async (_input, output) => {
      try {
        const context = buildSddContext(directory);
        if (context) {
          (output.context ||= []).push(context);
        }
      } catch {
        // Non-fatal: never break compaction due to plugin errors
      }
    },
  };
};
