#!/usr/bin/env bun

const command = process.argv[2];

switch (command) {
  case "install":
    await import("./install.ts");
    break;
  case "start":
    await import("./start.ts");
    break;
  case "upgrade":
    await import("./upgrade.ts");
    break;
  default:
    console.log(`
  Attache - A self-hosted AI assistant

  Usage:
    attache install    Set up Attache (configure provider, auth, etc.)
    attache start      Start the Attache server
    attache upgrade    Download the latest frontend build
`);
    if (command) {
      console.log(`  Unknown command: ${command}\n`);
      process.exit(1);
    }
    break;
}
