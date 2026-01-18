import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  version: string;
  serverUrl?: string;
  connected?: boolean;
}

export function StatusBar({ version, serverUrl, connected }: StatusBarProps) {
  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text dimColor>
        maetrik v{version}
        {serverUrl && (
          <>
            {' | '}
            {serverUrl}
            {connected !== undefined && (
              <Text color={connected ? 'green' : 'red'}>
                {connected ? ' (connected)' : ' (disconnected)'}
              </Text>
            )}
          </>
        )}
      </Text>
    </Box>
  );
}
