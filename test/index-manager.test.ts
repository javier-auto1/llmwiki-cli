import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { IndexManager } from "../src/lib/index-manager.ts";
import { WikiManager } from "../src/lib/wiki.ts";

let testDir: string;
let indexPath: string;
let wiki: WikiManager;
let mgr: IndexManager;

const INITIAL_INDEX = `# Index

## Topics

## Projects

## Playbooks
`;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "llmwiki-idx-"));
  indexPath = join(testDir, "index.md");
  await writeFile(indexPath, INITIAL_INDEX, "utf-8");
  wiki = new WikiManager(testDir);
  mgr = new IndexManager(wiki, "index.md");
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("IndexManager", () => {
  it("read returns index content", async () => {
    const content = await mgr.read();
    expect(content).toContain("## Topics");
  });

  it("addEntry inserts under correct section from path", async () => {
    await mgr.addEntry("topics/auth.md", "Auth system overview");
    const content = await mgr.read();
    expect(content).toContain("- [[topics/auth.md]] — Auth system overview");
    const topicsIdx = content.indexOf("## Topics");
    const entryIdx = content.indexOf("[[topics/auth.md]]");
    const projectsIdx = content.indexOf("## Projects");
    expect(entryIdx).toBeGreaterThan(topicsIdx);
    expect(entryIdx).toBeLessThan(projectsIdx);
  });

  it("addEntry puts projects under Projects section", async () => {
    await mgr.addEntry("projects/q3-migration.md", "Q3 DB migration");
    const content = await mgr.read();
    const projectsIdx = content.indexOf("## Projects");
    const entryIdx = content.indexOf("[[projects/q3-migration.md]]");
    const playbooksIdx = content.indexOf("## Playbooks");
    expect(entryIdx).toBeGreaterThan(projectsIdx);
    expect(entryIdx).toBeLessThan(playbooksIdx);
  });

  it("addEntry defaults to Topics for unknown paths", async () => {
    await mgr.addEntry("misc/note.md", "A random note");
    const content = await mgr.read();
    const topicsIdx = content.indexOf("## Topics");
    const entryIdx = content.indexOf("[[misc/note.md]]");
    expect(entryIdx).toBeGreaterThan(topicsIdx);
  });

  it("multiple entries in same section", async () => {
    await mgr.addEntry("topics/auth.md", "Auth system");
    await mgr.addEntry("topics/deployment.md", "Deployment process");
    const content = await mgr.read();
    expect(content).toContain("[[topics/auth.md]]");
    expect(content).toContain("[[topics/deployment.md]]");
  });

  it("removeEntry removes the correct line", async () => {
    await mgr.addEntry("topics/foo.md", "Foo topic");
    await mgr.addEntry("topics/bar.md", "Bar topic");
    const removed = await mgr.removeEntry("topics/foo.md");
    expect(removed).toBe(true);
    const content = await mgr.read();
    expect(content).not.toContain("[[topics/foo.md]]");
    expect(content).toContain("[[topics/bar.md]]");
  });

  it("removeEntry returns false for missing entry", async () => {
    const removed = await mgr.removeEntry("nonexistent.md");
    expect(removed).toBe(false);
  });

  it("hasEntry returns true for existing entry", async () => {
    await mgr.addEntry("topics/test.md", "Test");
    expect(await mgr.hasEntry("topics/test.md")).toBe(true);
  });

  it("hasEntry returns false for missing entry", async () => {
    expect(await mgr.hasEntry("nope.md")).toBe(false);
  });

  it("creates section if it does not exist", async () => {
    await writeFile(indexPath, "# Index\n", "utf-8");
    mgr = new IndexManager(wiki, "index.md");
    await mgr.addEntry("topics/new.md", "New topic");
    const content = await mgr.read();
    expect(content).toContain("## Topics");
    expect(content).toContain("[[topics/new.md]]");
  });

  it("addEntry routes playbooks paths correctly", async () => {
    await mgr.addEntry("playbooks/deploy.md", "Deploy process");
    const content = await mgr.read();
    const playbooksIdx = content.indexOf("## Playbooks");
    const entryIdx = content.indexOf("[[playbooks/deploy.md]]");
    expect(entryIdx).toBeGreaterThan(playbooksIdx);
  });

  it("addEntry handles duplicate paths", async () => {
    await mgr.addEntry("topics/dup.md", "First add");
    await mgr.addEntry("topics/dup.md", "Second add");
    const content = await mgr.read();
    const matches = content.match(/\[\[topics\/dup\.md\]\]/g);
    expect(matches).toHaveLength(2);
  });

  it("upsertEntry replaces existing line for same path", async () => {
    await mgr.addEntry("topics/dup.md", "Old summary");
    await mgr.upsertEntry("topics/dup.md", "New summary");
    const content = await mgr.read();
    expect(content).toContain("— New summary");
    expect(content).not.toContain("— Old summary");
    const matches = content.match(/\[\[topics\/dup\.md\]\]/g);
    expect(matches).toHaveLength(1);
  });

  it("upsertEntry inserts when path absent", async () => {
    await mgr.upsertEntry("topics/new-up.md", "Fresh");
    const content = await mgr.read();
    expect(content).toContain("[[topics/new-up.md]]");
    expect(content).toContain("— Fresh");
  });

  it("read returns empty string for missing file", async () => {
    const missingMgr = new IndexManager(wiki, "nonexistent.md");
    const content = await missingMgr.read();
    expect(content).toBe("");
  });

  it("hasEntry is false after removeEntry", async () => {
    await mgr.addEntry("topics/temp.md", "Temporary");
    expect(await mgr.hasEntry("topics/temp.md")).toBe(true);
    await mgr.removeEntry("topics/temp.md");
    expect(await mgr.hasEntry("topics/temp.md")).toBe(false);
  });

  it("removeEntry preserves other entries in same section", async () => {
    await mgr.addEntry("topics/keep.md", "Keep this");
    await mgr.addEntry("topics/remove.md", "Remove this");
    await mgr.addEntry("topics/also-keep.md", "Also keep");
    await mgr.removeEntry("topics/remove.md");
    const content = await mgr.read();
    expect(content).toContain("[[topics/keep.md]]");
    expect(content).toContain("[[topics/also-keep.md]]");
    expect(content).not.toContain("[[topics/remove.md]]");
  });

  it("categoryFromPath matches case-insensitively", async () => {
    await mgr.addEntry("Topics/auth.md", "Auth");
    const content = await mgr.read();
    const topicsIdx = content.indexOf("## Topics");
    const entryIdx = content.indexOf("[[Topics/auth.md]]");
    const projectsIdx = content.indexOf("## Projects");
    expect(entryIdx).toBeGreaterThan(topicsIdx);
    expect(entryIdx).toBeLessThan(projectsIdx);
  });
});
