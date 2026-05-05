# llmwiki-cli — Team Setup Guide

A CLI tool that lets your AI assistant (Claude Code, Copilot, etc.) build and maintain a personal knowledge base in plain markdown files on disk.

## Install

```bash
npm install -g llmwiki-cli
```

Requires Node.js 18+. Gives you the `wiki` command (and `llmwiki` as fallback).

## Create your wiki

```bash
wiki init ~/my-wiki --name "My Notes" --domain "your team/domain"
```

This creates the wiki folder, scaffolds the directory structure, and runs `git init` + an initial commit automatically. Use `~/my-wiki` as your path so the agent config below works as-is.

## Configure your AI assistant

Add the following to your `CLAUDE.md` (or equivalent config for your agent) so it automatically uses your wiki:

```markdown
# Personal Work Wiki

A personal knowledge base lives at `~/my-wiki`. Use it as follows:

**Before answering** any technical question about work (architecture, processes, decisions, systems): run `wiki search "<relevant terms>"` and read any promising results before responding. If the wiki has relevant context, use it and say so.

**During conversations**: if the discussion surfaces knowledge worth preserving (a decision, how something works, a process), flag it at the end: "This seems worth saving to the wiki — want me to ingest it?"

**When asked to ingest**: run `wiki skill` first to load the current guide, then follow it.
```

## How ingestion works

When your agent ingests a conversation, it writes pages under `wiki/topics/`, `wiki/projects/`, or `wiki/playbooks/` and then commits:

```bash
git -C ~/my-wiki add -A && git -C ~/my-wiki commit -m "ingest: <description>"
```

This keeps your wiki versioned automatically. You never need to run git manually.

## Optional: link graph visualization

You can get an interactive d3-force graph. Simply ask Claude to create it, or manually from this repo, run:
```bash
bun scripts/generate-viz-scripts.ts ~/my-wiki/scripts
```
Then from your wiki folder:
```bash
node scripts/build-graph.cjs && node scripts/build-site.cjs
```
(`build-graph` parses your wiki into a graph, `build-site` renders it as HTML — both needed.)
The visualization is generated at `~/my-wiki/dist/index.html` — open it directly in your browser.


## Useful commands

```bash
wiki search "topic"          # search your wiki
wiki skill                   # print the full agent guide
wiki status                  # overview stats
wiki lint                    # health check
wiki list                    # list all pages
```

## Development

```bash
bun install                    # install deps
bun test                       # run tests
bun run build && npm install -g .   # build and install locally
```

If you get `bun: command not found`, install it via the public npm registry (our `.npmrc` points to internal Artifactory which doesn't have bun):

```bash
npm install -g bun --registry https://registry.npmjs.org
```

**Note:** Tests must run from `/tmp` (already configured). The resolver walks up from `cwd` and will find a real `~/my-wiki` if tests run from inside the repo — causing false failures. Don't change test `cwd` to the project root.

## Full documentation

See [README.original.md](README.original.md) for the complete reference (all commands, wiki structure, multi-wiki support, GitHub Pages viz, etc.).
