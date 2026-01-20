#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline from "readline";
import { execSync } from "child_process";

function printHeader() {
  console.log("SpecAI — Spec-Driven AI Development Framework");
}

function printHelp() {
  console.log(`
Usage:
  specai init [path] [options]
  specai status

Options:
  --here        Initialize in current directory
  --force       Overwrite existing SpecAI setup
  --no-git      Skip git initialization
`);
}

function loadState(projectDir: string) {
  const statePath = path.join(projectDir, "specai", "state.json");
  return JSON.parse(fs.readFileSync(statePath, "utf-8"));
}

function saveState(projectDir: string, state: any) {
  const statePath = path.join(projectDir, "specai", "state.json");
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

async function callQwen(prompt: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "qwen2.5:7b",
      prompt,
      stream: false
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error: ${text}`);
  }

  const data = await res.json();
  return data.response.trim();
}


function loadConfig(projectDir: string) {
  const configPath = path.join(projectDir, ".specai", "config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

async function choose(prompt: string, options: string[]): Promise<number> {
  console.log(prompt);
  options.forEach((o, i) => console.log(`${i + 1}) ${o}`));
  const answer = await ask("> ");
  const idx = parseInt(answer, 10);
  return Number.isNaN(idx) ? -1 : idx - 1;
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function resolveProjectDir(args: string[]): string {
  const pathArg = args.find(a => !a.startsWith("--"));

  return pathArg
    ? path.resolve(process.cwd(), pathArg)
    : process.cwd();
}


/**
 * Create a directory if it does not exist
 */
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write a file only if it does not exist (unless forced)
 */
function writeFileSafe(filePath: string, content: string, force: boolean) {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`File already exists: ${filePath}`);
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

async function handleInit(args: string[]) {
  printHeader();

  const flags = new Set(args.filter(a => a.startsWith("--")));
  const force = flags.has("--force");
  const noGit = flags.has("--no-git");

  const pathArg = args.find(a => !a.startsWith("--"));
  if (!pathArg) {
    console.error("❌ Please specify a target directory or use '.'");
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), pathArg);
  const exists = fs.existsSync(targetDir);

  // Create directory if missing
  if (!exists) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Created project folder: ${path.basename(targetDir)}`);
  }

  const specaiDir = path.join(targetDir, "specai");
  const dotSpecaiDir = path.join(targetDir, ".specai");

  if ((fs.existsSync(specaiDir) || fs.existsSync(dotSpecaiDir)) && !force) {
    console.error("❌ SpecAI already initialized here.");
    console.error("Use --force to overwrite.");
    process.exit(1);
  }

  // Determine project name
  let projectName = exists
    ? await ask("Project name: ")
    : path.basename(targetDir);

  // Ask for description
  const projectDescription = await ask(
    "Brief project description (used as global context): "
  );

  console.log("\nModels configured:");
  console.log("- Qwen (planner / reasoning)");
  console.log("- DeepSeek Coder (code generation)\n");

  // Create directories
  ensureDir(specaiDir);
  ensureDir(dotSpecaiDir);

  // Write config
  writeFileSafe(
    path.join(dotSpecaiDir, "config.json"),
    JSON.stringify(
      {
        project: {
          name: projectName,
          description: projectDescription
        },
        models: {
          planner: "qwen2.5:7b",
          coder: "deepseek-coder:6.7b"
        }
      },
      null,
      2
    ),
    force
  );

  // Write constitution scaffold
  writeFileSafe(
    path.join(specaiDir, "constitution.md"),
    `# Constitution

This document defines the governing assumptions, constraints, and worldview
for the project.

It is expected to evolve before being approved and locked.
`,
    force
  );

  // Write state
  writeFileSafe(
    path.join(specaiDir, "state.json"),
    JSON.stringify(
      {
        phase: "constitution",
        approved: {
          constitution: false,
          spec: false,
          plan: false,
          tasks: false
        }
      },
      null,
      2
    ),
    force
  );

  // Git init
  if (!noGit && !fs.existsSync(path.join(targetDir, ".git"))) {
    try {
      require("child_process").execSync("git init", { cwd: targetDir });
      console.log("📦 Git repository initialized.");
    } catch {
      console.warn("⚠️ Git initialization failed.");
    }
  }

  console.log("\n✅ SpecAI project initialized.");
}

function handleStatus() {
  printHeader();
  const cwd = process.cwd();
  if (
    fs.existsSync(path.join(cwd, "specai")) &&
    fs.existsSync(path.join(cwd, ".specai"))
  ) {
    console.log("SpecAI is initialized in this directory.");
  } else {
    console.log("SpecAI not initialized in this directory.");
  }
}

async function handleConstitution(args: string[]) {
  printHeader();

  const projectDir = resolveProjectDir(args);

  // Safety checks
  if (!fs.existsSync(path.join(projectDir, "specai", "state.json"))) {
    console.error("❌ No SpecAI project found in target directory.");
    process.exit(1);
  }

  const state = loadState(projectDir);
  if (state.approved.constitution) {
    console.error("❌ Constitution is locked.");
    console.error("Use `specai unlock constitution <path>` to modify it.");
    process.exit(1);
  }

  const config = loadConfig(projectDir);
  const constitutionPath = path.join(projectDir, "specai", "constitution.md");
  const currentText = fs.readFileSync(constitutionPath, "utf-8");

  // 1) AI summary
  const summaryPrompt = `
Project: ${config.project.name}
Description: ${config.project.description}

Constitution:
---
${currentText}
---

Summarize the constitution at a high level in 5 bullet points.
If information is missing, say what is missing.
`;

  const summary = await callQwen(summaryPrompt);
  console.log("\n=== Current Constitution Summary ===\n");
  console.log(summary);
  console.log("\n===================================\n");

  // 2) Choose next action
  const choice = await choose(
    "What do you want to do next?",
    [
      "Add or clarify high-level system overview (I explain)",
      "Let AI ask me clarifying questions",
      "Append notes or constraints directly",
      "Exit"
    ]
  );

  if (choice === 0) {
    const input = await ask("\nDescribe the system at a high level:\n");
    const proposalPrompt = `
Convert the following into a clear 'System Overview' section for a constitution.
Write concise markdown.

Input:
${input}
`;
    const section = await callQwen(proposalPrompt);
    console.log("\n--- Proposed Section ---\n");
    console.log(section);
    console.log("\n------------------------\n");

    const ok = (await ask("Apply this section? (y/n): ")).toLowerCase() === "y";
    if (ok) {
      fs.writeFileSync(
        constitutionPath,
        currentText.trim() + "\n\n" + section + "\n",
        "utf-8"
      );
      console.log("✅ Applied.");
    } else {
      console.log("❌ Discarded.");
    }
  }

  if (choice === 1) {
    const questionsPrompt = `
Project: ${config.project.name}
Description: ${config.project.description}

Constitution:
---
${currentText}
---

Ask up to 5 clarifying questions needed to better understand the system.
Questions only.
`;
    const questions = await callQwen(questionsPrompt);
    console.log("\n--- Clarifying Questions ---\n");
    console.log(questions);
    console.log("\n----------------------------\n");
    console.log("Answer these by re-running `specai constitution` and choosing option 1 or 3.");
  }

  if (choice === 2) {
    const notes = await ask("\nEnter notes/constraints to append:\n");
    const ok = (await ask("Append these notes? (y/n): ")).toLowerCase() === "y";
    if (ok) {
      fs.writeFileSync(
        constitutionPath,
        currentText.trim() + "\n\n" + notes + "\n",
        "utf-8"
      );
      console.log("✅ Notes appended.");
    } else {
      console.log("❌ Discarded.");
    }
  }

  if (choice === 3) {
    console.log("Exiting without changes.");
  }
}

function handleApproveConstitution(args: string[]) {
  printHeader();

  const projectDir = resolveProjectDir(args);

  if (!fs.existsSync(path.join(projectDir, "specai", "state.json"))) {
    console.error("❌ No SpecAI project found in target directory.");
    console.error("Run `specai init` first.");
    process.exit(1);
  }

  const state = loadState(projectDir);
  state.approved.constitution = true;
  saveState(projectDir, state);

  console.log("🔒 Constitution approved and locked.");
}

function handleUnlockConstitution(args: string[]) {
  printHeader();

  const projectDir = resolveProjectDir(args);

  if (!fs.existsSync(path.join(projectDir, "specai", "state.json"))) {
    console.error("❌ No SpecAI project found in target directory.");
    console.error("Run `specai init` first.");
    process.exit(1);
  }

  const state = loadState(projectDir);
  state.approved.constitution = false;
  saveState(projectDir, state);

  console.log("🔓 Constitution unlocked.");
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help") {
    printHeader();
    printHelp();
    return;
  }

    switch (command) {
    case "init":
        await handleInit(args.slice(1));
        break;

    case "status":
        handleStatus();
        break;

    case "constitution":
        await handleConstitution(args.slice(1));
        break;

    case "approve":
    if (args[1] === "constitution") {
        handleApproveConstitution(args.slice(2));
    } else {
        console.error("Unknown approve target.");
    }
    break;

    case "unlock":
    if (args[1] === "constitution") {
        handleUnlockConstitution(args.slice(2));
    } else {
        console.error("Unknown unlock target.");
    }
    break;

    default:
        printHeader();
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
}

main();
