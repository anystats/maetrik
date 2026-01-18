#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

const DEFAULT_SERVER_URL = 'http://localhost:3000';

function parseArgs(args: string[]): { serverUrl: string; help: boolean; version: boolean } {
  let serverUrl = DEFAULT_SERVER_URL;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (arg === '--server' || arg === '-s') {
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        serverUrl = next;
        i++;
      }
    } else if (arg.startsWith('--server=')) {
      serverUrl = arg.slice('--server='.length);
    }
  }

  return { serverUrl, help, version };
}

function printHelp() {
  console.log(`
maetrik - Interactive TUI for Maetrik

Usage:
  maetrik [options]

Options:
  -s, --server <url>  Server URL (default: http://localhost:3000)
  -h, --help          Show this help message
  -v, --version       Show version

Examples:
  maetrik                              # Connect to localhost:3000
  maetrik --server http://server:3000  # Connect to custom server
`);
}

function printVersion() {
  console.log('maetrik v0.0.1');
}

function main() {
  const args = process.argv.slice(2);
  const { serverUrl, help, version } = parseArgs(args);

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (version) {
    printVersion();
    process.exit(0);
  }

  render(<App serverUrl={serverUrl} />);
}

main();
