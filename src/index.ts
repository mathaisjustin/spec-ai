#!/usr/bin/env node

function printHeader() {
  console.log("SpecAI — Spec-Driven AI Development Framework");
}

function printHelp() {
  console.log(`
Usage:
  specai <command>

Commands:
  init        Initialize a SpecAI project
  status      Show current project status
  help        Show this help message
`);
}

function handleInit() {
  printHeader();
  console.log("specai init: not implemented yet");
}

function handleStatus() {
  printHeader();
  console.log("SpecAI not initialized in this directory.");
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHeader();
    printHelp();
    return;
  }

  switch (command) {
    case "init":
      handleInit();
      break;

    case "status":
      handleStatus();
      break;

    default:
      printHeader();
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
