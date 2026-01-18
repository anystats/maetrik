import React, { useState, useContext } from 'react';
import { Box, Text, useInput } from 'ink';
import { AppContext } from '../../app.js';
import { useConnections, useApi } from '../../hooks/use-api.js';
import type { HealthResult } from '../../api/client.js';

export interface ConnectionsListProps {
  onSelect: (id: string) => void;
  onViewSchema: (id: string) => void;
  onViewDetails: (id: string) => void;
}

export function ConnectionsList({ onSelect, onViewSchema, onViewDetails }: ConnectionsListProps) {
  const { apiClient } = useContext(AppContext);
  const { data: connections, loading, error, refetch } = useConnections();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [healthStatus, setHealthStatus] = useState<Record<string, HealthResult | 'loading'>>({});

  const checkHealth = async (id: string) => {
    setHealthStatus((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      const result = await apiClient.checkHealth(id);
      setHealthStatus((prev) => ({ ...prev, [id]: result }));
    } catch {
      setHealthStatus((prev) => ({ ...prev, [id]: { healthy: false } }));
    }
  };

  useInput((input, key) => {
    if (!connections || connections.length === 0) return;

    // Navigation
    if (key.upArrow || input === 'k') {
      setHighlightedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow || input === 'j') {
      setHighlightedIndex((prev) => Math.min(connections.length - 1, prev + 1));
    }

    // Actions
    const selected = connections[highlightedIndex];
    if (!selected) return;

    if (input === '1') {
      onSelect(selected.id);
    } else if (input === '2') {
      checkHealth(selected.id);
    } else if (input === '3') {
      onViewSchema(selected.id);
    } else if (input === '4') {
      onViewDetails(selected.id);
    } else if (input === 'r') {
      refetch();
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading connections...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (!connections || connections.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Connections</Text>
        <Box marginTop={1}>
          <Text dimColor>No connections configured.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Connections</Text>
      <Box marginTop={1} flexDirection="column">
        {connections.map((conn, index) => {
          const isHighlighted = index === highlightedIndex;
          const health = healthStatus[conn.id];
          const healthIndicator =
            health === 'loading' ? (
              <Text color="yellow"> ...</Text>
            ) : health ? (
              <Text color={health.healthy ? 'green' : 'red'}>
                {' '}
                {health.healthy ? '[OK]' : '[FAIL]'}
              </Text>
            ) : null;

          return (
            <Box key={conn.id}>
              <Text color={isHighlighted ? 'cyan' : undefined} bold={isHighlighted}>
                {isHighlighted ? '> ' : '  '}
                {conn.id.padEnd(16)}
              </Text>
              <Text dimColor={!isHighlighted}>{conn.type.padEnd(12)}</Text>
              <Text dimColor={!isHighlighted}>
                {conn.name || conn.description || ''}
              </Text>
              {healthIndicator}
              {!conn.enabled && <Text color="yellow"> [disabled]</Text>}
            </Box>
          );
        })}
      </Box>

      {/* Actions bar */}
      <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
        <Text dimColor>
          1. Select  2. Health  3. Schema  4. Details  r. Refresh
        </Text>
      </Box>
    </Box>
  );
}
