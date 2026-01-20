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

function callQwen(prompt: string): string {
  const response = execSync(
    `curl -s http://127.0.0.1:11434/api/generate \
      -H "Content-Type: application/json" \
      -d '${JSON.stringify({
        model: "qwen2.5:7b",
        prompt,
        stream: false
      })}'`,
    { encoding: "utf-8" }
  );

  const parsed = JSON.parse(response);
  return parsed.response.trim();
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

function handleInit(args: string[]) {
  printHeader();

  const flags = new Set(args.filter(a => a.startsWith("--")));
  const force = flags.has("--force");
  const noGit = flags.has("--no-git");
  const here = flags.has("--here");

  const pathArg = args.find(a => !a.startsWith("--"));

  const targetDir = here || !pathArg || pathArg === "."
    ? process.cwd()
    : path.resolve(process.cwd(), pathArg);

  // Prevent accidental overwrite
  const specaiDir = path.join(targetDir, "specai");
  const dotSpecaiDir = path.join(targetDir, ".specai");

  if ((fs.existsSync(specaiDir) || fs.existsSync(dotSpecaiDir)) && !force) {
    console.error("SpecAI already initialized in this directory.");
    console.error("Use --force to overwrite.");
    process.exit(1);
  }

  // Create directories
  ensureDir(specaiDir);
  ensureDir(dotSpecaiDir);

  // Write constitution
  writeFileSafe(
    path.join(specaiDir, "constitution.md"),
    `# Constitution

## Purpose
Define the governing principles for this project.

## Authority
This document overrides all other instructions.

## AI Usage
AI assists but does not decide.

## Review
All outputs require human approval.
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

  // Write config
  writeFileSafe(
    path.join(dotSpecaiDir, "config.json"),
    JSON.stringify(
      {
        version: "0.1.0"
      },
      null,
      2
    ),
    force
  );

  // Initialize git unless skipped
  if (!noGit && !fs.existsSync(path.join(targetDir, ".git"))) {
    try {
      require("child_process").execSync("git init", { cwd: targetDir });
      console.log("Initialized git repository.");
    } catch {
      console.warn("Git initialization failed or git not available.");
    }
  }

  console.log("SpecAI project initialized successfully.");
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
    if (!fs.existsSync(path.join(projectDir, "specai", "state.json"))) {
    console.error("❌ No SpecAI project found in target directory.");
    console.error("Run `specai init` first.");
    process.exit(1);
    }

  const state = loadState(projectDir);

  if (state.approved.constitution) {
    console.error("❌ Constitution is locked.");
    console.error("Use `specai unlock constitution` to modify it.");
    process.exit(1);
  }

  const constitutionPath = path.join(projectDir, "specai", "constitution.md");
  const currentText = fs.readFileSync(constitutionPath, "utf-8");

  const prompt = `
You are helping refine a project constitution.

Current constitution:
---
${currentText}
---

Propose ONE small improvement or missing rule.
Return only the proposed markdown section.
Do not explain.
`;

  const proposal = callQwen(prompt);

  console.log("\n--- Proposed Change ---\n");
  console.log(proposal);
  console.log("\n-----------------------\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("Apply this change? (y/n): ", answer => {
    if (answer.toLowerCase() === "y") {
      fs.writeFileSync(
        constitutionPath,
        currentText.trim() + "\n\n" + proposal + "\n",
        "utf-8"
      );
      console.log("✅ Change applied.");
    } else {
      console.log("❌ Change discarded.");
    }

    rl.close();
  });
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

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help") {
    printHeader();
    printHelp();
    return;
  }

    switch (command) {
    case "init":
        handleInit(args.slice(1));
        break;

    case "status":
        handleStatus();
        break;

    case "constitution":
        handleConstitution(args.slice(1));
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
