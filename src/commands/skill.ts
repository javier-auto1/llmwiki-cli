import { Command } from "commander";

/** Printed by `wiki skill`; canonical agent guide (README points here). Keep aligned with `src/index.ts` and `src/lib/templates.ts` SCHEMA. */
const SKILL_GUIDE = `# llmwiki-cli — LLM Agent Skill Guide

You are operating a wiki CLI that manages markdown knowledge bases. You are the brain (deciding what to create, connect, and update). The CLI is the hands (reading, writing, searching, and managing files). The CLI never calls any LLM API — it is a pure filesystem tool.

## Storage

- **Local files**: Pages are \`.md\` files under the wiki root. \`wiki init\` creates the directory layout and \`.llmwiki.yaml\`; there is no built-in Git or cloud sync.
- **Git / visualization (optional):** Use normal \`git init\` in the wiki root if you want version control. For an interactive link graph on GitHub Pages, copy the workflow and \`scripts/\` from the llmwiki-cli repo (see README: optional viz drop-in).

## Critical Patterns

### \`wiki write\` uses JSON on stdin

Pipe **one JSON object** (not markdown). The CLI validates fields, writes YAML frontmatter + body, and **upserts** \`wiki/index.md\` for paths under \`wiki/\` (except \`wiki/index.md\`).

Allowed keys: \`title\`, \`content\` (required strings); optional \`description\`, \`tags\` (string array), \`source\` (valid URL string), \`created\`, \`updated\` (ISO dates — normalized to YYYY-MM-DD). Unknown keys are rejected.

On **edit**, \`created\` is always taken from the existing file when present; otherwise defaults or your JSON value applies. \`updated\` defaults to today unless you pass it.

\`\`\`bash
wiki write wiki/topics/attention.md <<'EOF'
{
  "title": "Attention",
  "description": "Core mechanism in transformers",
  "tags": ["transformers", "NLP"],
  "source": "https://arxiv.org/abs/1706.03762",
  "content": "# Attention\\n\\nContent and [[wikilinks]] here."
}
EOF
\`\`\`

To **change** a page: \`wiki read <path>\` → edit in your context → \`wiki write\` with the full JSON (there is no \`append\` command).

### \`wiki read\` returns stored markdown

Output is the file on disk (frontmatter + body), not JSON.

### Paths are relative to wiki root

\`\`\`bash
wiki read wiki/topics/attention.md      # correct
wiki read /home/user/my-wiki/wiki/topics/attention.md  # wrong
\`\`\`

### Wikilinks

- \`[[page-name]]\` — resolved by filename across all wiki directories
- \`[[page-name|Display Text]]\` — link with custom display text
- Resolution order: exact path → wiki/ prefix → subdirectories → filename match anywhere

**When writing or updating a page, always add wikilinks to related pages you know exist.** This keeps the knowledge graph connected. If a topic page mentions a project, link it. If a playbook references a topic, link it. After ingesting, check \`wiki orphans\` and connect any isolated pages.

### Page format

The CLI emits YAML frontmatter from JSON; body is your \`content\` string unchanged.

### File naming

- Use kebab-case: \`my-topic-name.md\`
- One topic per file — split large topics into sub-pages

### Directory structure

\`\`\`
raw/                  # Conversation transcripts and raw sources (immutable)
wiki/                 # LLM-curated knowledge pages (all knowledge lives here)
  index.md            # Master index — updated by wiki write / delete
  topics/             # Evergreen knowledge: what we know, how things work, decisions
  projects/           # Time-bounded context per project (archive when done)
  playbooks/          # Prescriptive processes: how we do things (follow this)
\`\`\`

## Workflows

### Ingest a conversation

The wiki is a reference — write each page as if you'll need it in 6 months with no other context. Err toward more detail, not less.

Before writing anything, critically evaluate: does this conversation contain knowledge worth preserving? Skip ingestion entirely if the conversation is exploratory with no conclusions, a one-off question with no reusable answer, or already fully covered by existing wiki pages.

If worth ingesting, ask the user clarifying questions before writing:
- What project is this related to, if any?
- Is there a specific page this should update, or is this a new topic?

Then identify where each piece of knowledge belongs:
- Evergreen knowledge about a subject → \`wiki/topics/<subject>.md\`
- Active project context → \`wiki/projects/<name>.md\`
- Repeatable process → \`wiki/playbooks/<process>.md\`

A focused conversation may only update one page. Multiple pages are a possibility, not a requirement.

For each page to write or update:
1. \`wiki read\` the target page if it exists — merge, don't duplicate
2. \`wiki write\` with:
3. After all writes, commit: \`git -C ~/my-wiki add -A && git -C ~/my-wiki commit -m "ingest: <brief description of what was captured>"\`

\`wiki write\` fields:
   - \`description\`: mandatory 1–2 sentence executive summary
   - body covering all relevant knowledge from the source; **bold key phrases** to help human readers scan
   - always append a collapsed Sources block at the end of the content, listing every source used:
     - local file copied to raw/: \`<span class="raw-link" data-raw-src="raw/filename.md">raw/filename.md</span>\`
     - external URL: \`<a href="https://..." target="_blank" rel="noopener">descriptive title</a>\`
     - format: \`<details>\\n<summary>Sources</summary>\\n<ul>\\n<li>...</li>\\n</ul>\\n</details>\`

\`\`\`bash
# Copy raw file first when source is a local file
cp /path/to/original.md ~/my-wiki/raw/original.md

# Sources block with mixed raw file + URL
wiki write wiki/topics/auth-system.md <<'EOF'
{
  "title": "Auth System",
  "description": "JWT-based auth with Redis session store; rotate keys quarterly.",
  "content": "## How it works\\n\\n**We use JWT tokens with a Redis session store.** Tokens expire after 24h.\\n\\n...\\n\\n<details>\\n<summary>Sources</summary>\\n<ul>\\n<li><span class=\\"raw-link\\" data-raw-src=\\"raw/auth-notes.md\\">raw/auth-notes.md</span></li>\\n<li><a href=\\"https://docs.example.com/auth\\" target=\\"_blank\\" rel=\\"noopener\\">Auth docs</a></li>\\n</ul>\\n</details>"
}
EOF

# Broader conversation → topic + playbook
wiki write wiki/topics/deployment.md <<'EOF'
{"title":"Deployment","description":"Blue/green deploys on ECS; rollback via previous task definition.","content":"..."}
EOF
wiki write wiki/playbooks/rollback.md <<'EOF'
{"title":"Rollback Process","description":"Steps to roll back a failed ECS deployment.","content":"**1. Identify the previous stable task definition.** ..."}
EOF

# Project-specific context
wiki write wiki/projects/q3-migration.md <<'EOF'
{"title":"Q3 DB Migration","description":"Migrating users table to new schema; target: end of Q3.","content":"**Decision: use shadow table approach** to avoid downtime. ..."}
EOF
\`\`\`

### Answer a question using the wiki

\`\`\`bash
wiki search "auth system"
wiki read wiki/topics/auth-system.md
wiki links wiki/topics/auth-system.md
\`\`\`

### Maintain wiki health

\`\`\`bash
wiki lint
wiki orphans
wiki status
\`\`\`

### Multi-wiki operations

\`\`\`bash
wiki registry
wiki use ml
wiki --wiki personal read wiki/index.md
wiki search "neural networks" --all
\`\`\`

## Command Reference

### Wiki Management

| Command | Description |
|---------|-------------|
| \`wiki init [dir] --name <n> --domain <d>\` | Create new wiki (local markdown only) |
| \`wiki registry\` | List all registered wikis |
| \`wiki use [wiki-id]\` | List wikis or set active wiki |

### Reading & Writing

| Command | Description |
|---------|-------------|
| \`wiki read <path>\` | Print page markdown to stdout |
| \`wiki write <path>\` | JSON on stdin → frontmatter + body; upserts index for \`wiki/*\` paths |
| \`wiki delete <path>\` | Delete page file and remove from \`wiki/index.md\` |
| \`wiki list [dir] [--tree] [--json]\` | List pages |
| \`wiki search <query> [-l N] [--all] [--json]\` | Full-text search |

### Health & Links

| Command | Description |
|---------|-------------|
| \`wiki lint [--json]\` | Broken links, orphans, missing frontmatter, index consistency |
| \`wiki links <path>\` | Outbound + inbound links |
| \`wiki backlinks <path>\` | Inbound links only |
| \`wiki orphans\` | Pages with no inbound links |
| \`wiki status [--json]\` | Wiki overview: page counts, link stats |

## Gotchas

1. **\`wiki write\` reads JSON from stdin** — use a heredoc or pipe; passing a path as the only argument will hang waiting for stdin.

2. **Strict JSON** — unknown keys error; \`source\` must be a valid URL when present.

3. **Wiki resolution** — if commands fail with "No wiki found", either \`cd\` into a wiki directory, run \`wiki use <id>\`, or pass \`--wiki <id>\`.

4. **search --all** searches across all registered wikis.

5. **lint** skips structural \`wiki/index.md\` for frontmatter/body checks; it still checks index consistency for other \`wiki/*.md\` pages.

6. **Re-running init** — if \`.llmwiki.yaml\` already exists, \`wiki init\` exits with an error.
`;

export function makeSkillCommand(): Command {
  return new Command("skill")
    .description("Print the LLM agent skill guide")
    .action(() => {
      console.log(SKILL_GUIDE);
    });
}
