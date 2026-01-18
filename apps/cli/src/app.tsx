import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Layout } from './components/layout.js';
import { ConnectionsList } from './components/connections/list.js';
import { ApiClient, createApiClient, type ConnectionDetails } from './api/client.js';
import { executeCommand, getAllCommands, type ViewType, type CommandContext } from './commands/index.js';

const VERSION = '0.0.1';

export interface AppContextValue {
  serverUrl: string;
  apiClient: ApiClient;
  selectedConnection: string | null;
  setSelectedConnection: (id: string | null) => void;
}

export const AppContext = createContext<AppContextValue>({
  serverUrl: '',
  apiClient: null as unknown as ApiClient,
  selectedConnection: null,
  setSelectedConnection: () => {},
});

export interface AppProps {
  serverUrl: string;
}

function WelcomeView({ connected }: { connected: boolean }) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Welcome to Maetrik</Text>
      <Box marginTop={1}>
        {connected ? (
          <Text color="green">Connected to server.</Text>
        ) : (
          <Text color="yellow">Connecting to server...</Text>
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>Quick start:</Text>
        <Text dimColor>  /connections - List all connections</Text>
        <Text dimColor>  /help        - Show available commands</Text>
        <Text dimColor>  /exit        - Exit the TUI</Text>
      </Box>
    </Box>
  );
}

function HelpView() {
  const commands = getAllCommands();

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Available Commands</Text>
      <Box marginTop={1} flexDirection="column">
        {commands.map((cmd) => (
          <Box key={cmd.name}>
            <Text color="cyan">/{cmd.name.padEnd(14)}</Text>
            <Text dimColor>
              {cmd.aliases.length > 0 && `(${cmd.aliases.map(a => '/' + a).join(', ')}) `}
            </Text>
            <Text>{cmd.description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Commands are case-insensitive. The leading slash is optional.</Text>
      </Box>
    </Box>
  );
}

function ConnectionDetailsView({ connectionId }: { connectionId: string }) {
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { apiClient } = React.useContext(AppContext);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiClient.getConnection(connectionId);
        setDetails(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load details');
        setLoading(false);
      }
    };
    fetch();
  }, [connectionId, apiClient]);

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading connection details...</Text>
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

  if (!details) return null;

  // Mask sensitive credential fields
  const maskedCredentials = { ...details.credentials as Record<string, unknown> };
  if ('password' in maskedCredentials) {
    maskedCredentials.password = '********';
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Connection: {connectionId}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Type: {details.type}</Text>
        {details.name ? <Text>Name: {details.name}</Text> : null}
        {details.description ? <Text>Description: {details.description}</Text> : null}
        <Text>Enabled: {details.enabled ? 'Yes' : 'No'}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Credentials:</Text>
        {Object.entries(maskedCredentials).map(([key, value]) => (
          <Text key={key} dimColor>  {key}: {String(value)}</Text>
        ))}
      </Box>
    </Box>
  );
}

function SchemaView({ connectionId }: { connectionId: string }) {
  const [schema, setSchema] = useState<{ tables: Array<{ name: string; schema: string; columns: Array<{ name: string; type: string }> }> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { apiClient } = React.useContext(AppContext);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await apiClient.getSchema(connectionId);
        setSchema(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schema');
        setLoading(false);
      }
    };
    fetch();
  }, [connectionId, apiClient]);

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading schema...</Text>
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

  if (!schema) return null;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Schema: {connectionId}</Text>
      <Box marginTop={1} flexDirection="column">
        {schema.tables.length === 0 ? (
          <Text dimColor>No tables found.</Text>
        ) : (
          schema.tables.map((table) => (
            <Box key={`${table.schema}.${table.name}`} flexDirection="column" marginBottom={1}>
              <Text color="cyan">{table.schema}.{table.name}</Text>
              {table.columns.map((col) => (
                <Text key={col.name} dimColor>  {col.name}: {col.type}</Text>
              ))}
            </Box>
          ))
        )}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Esc or /connections to go back</Text>
      </Box>
    </Box>
  );
}

export function App({ serverUrl }: AppProps) {
  const { exit } = useApp();
  const [connected, setConnected] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('welcome');
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewConnectionId, setViewConnectionId] = useState<string | null>(null);

  const apiClient = React.useMemo(() => createApiClient(serverUrl), [serverUrl]);

  // Check server connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      const isConnected = await apiClient.ping();
      setConnected(isConnected);
      if (!isConnected) {
        setError(`Cannot connect to server at ${serverUrl}`);
      }
    };
    checkConnection();
  }, [apiClient, serverUrl]);

  const handleCommand = useCallback((input: string) => {
    const ctx: CommandContext = {
      setView: setCurrentView,
      setSelectedConnection,
      exit,
      setError,
    };
    executeCommand(input, ctx);
  }, [exit]);

  const handleSelectConnection = useCallback((id: string) => {
    setSelectedConnection(id);
    // For now, just show a message. Future: enable queries against this connection
  }, []);

  const handleViewSchema = useCallback((id: string) => {
    setViewConnectionId(id);
    setCurrentView('schema');
  }, []);

  const handleViewDetails = useCallback((id: string) => {
    setViewConnectionId(id);
    setCurrentView('connection-details');
  }, []);

  const contextValue: AppContextValue = {
    serverUrl,
    apiClient,
    selectedConnection,
    setSelectedConnection,
  };

  const renderContent = () => {
    switch (currentView) {
      case 'welcome':
        return <WelcomeView connected={connected} />;
      case 'connections':
        return (
          <ConnectionsList
            onSelect={handleSelectConnection}
            onViewSchema={handleViewSchema}
            onViewDetails={handleViewDetails}
          />
        );
      case 'help':
        return <HelpView />;
      case 'connection-details':
        return viewConnectionId ? <ConnectionDetailsView connectionId={viewConnectionId} /> : <WelcomeView connected={connected} />;
      case 'schema':
        return viewConnectionId ? <SchemaView connectionId={viewConnectionId} /> : <WelcomeView connected={connected} />;
      default:
        return <WelcomeView connected={connected} />;
    }
  };

  return (
    <AppContext.Provider value={contextValue}>
      <Layout
        version={VERSION}
        serverUrl={serverUrl}
        connected={connected}
        onCommand={handleCommand}
      >
        {error && currentView === 'welcome' && (
          <Box paddingX={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
        {renderContent()}
      </Layout>
    </AppContext.Provider>
  );
}
