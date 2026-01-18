import React from 'react';
import { Box, useStdout } from 'ink';
import { StatusBar } from './status-bar.js';
import { CommandInput } from './command-input.js';

export interface LayoutProps {
  children: React.ReactNode;
  version: string;
  serverUrl: string;
  connected: boolean;
  onCommand: (command: string) => void;
}

export function Layout({ children, version, serverUrl, connected, onCommand }: LayoutProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;

  // Reserve space for command input (3 lines) and status bar (2 lines)
  const contentHeight = Math.max(terminalHeight - 5, 10);

  return (
    <Box flexDirection="column" height={terminalHeight}>
      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1} height={contentHeight} overflow="hidden">
        {children}
      </Box>

      {/* Command input */}
      <CommandInput onSubmit={onCommand} />

      {/* Status bar */}
      <StatusBar version={version} serverUrl={serverUrl} connected={connected} />
    </Box>
  );
}
