export type ViewType = 'welcome' | 'connections' | 'help' | 'connection-details' | 'schema';

export interface CommandContext {
  setView: (view: ViewType) => void;
  setSelectedConnection: (id: string | null) => void;
  exit: () => void;
  setError: (message: string | null) => void;
}

export interface CommandResult {
  view?: ViewType;
  selectedConnection?: string | null;
  exit?: boolean;
  error?: string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  execute: (args: string, ctx: CommandContext) => CommandResult | void;
}

// Define all commands inline to avoid circular dependency issues
const commandDefinitions: Command[] = [
  {
    name: 'connections',
    aliases: ['conn', 'c'],
    description: 'List all connections',
    execute: (): CommandResult => ({ view: 'connections' }),
  },
  {
    name: 'help',
    aliases: ['?'],
    description: 'Show available commands',
    execute: (): CommandResult => ({ view: 'help' }),
  },
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit the TUI',
    execute: (): CommandResult => ({ exit: true }),
  },
];

// Build command lookup map
const commands: Map<string, Command> = new Map();
for (const cmd of commandDefinitions) {
  commands.set(cmd.name.toLowerCase(), cmd);
  for (const alias of cmd.aliases) {
    commands.set(alias.toLowerCase(), cmd);
  }
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name.toLowerCase());
}

export function getAllCommands(): Command[] {
  return commandDefinitions;
}

export function parseCommand(input: string): { command: string; args: string } {
  const trimmed = input.trim();

  // Remove leading slash if present
  const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  const spaceIndex = withoutSlash.indexOf(' ');
  if (spaceIndex === -1) {
    return { command: withoutSlash, args: '' };
  }

  return {
    command: withoutSlash.slice(0, spaceIndex),
    args: withoutSlash.slice(spaceIndex + 1).trim(),
  };
}

export function executeCommand(input: string, ctx: CommandContext): void {
  const { command, args } = parseCommand(input);

  if (!command) {
    return;
  }

  const cmd = getCommand(command);
  if (!cmd) {
    ctx.setError(`Unknown command: ${command}. Type /help for available commands.`);
    return;
  }

  ctx.setError(null);
  const result = cmd.execute(args, ctx);

  if (result?.view) {
    ctx.setView(result.view);
  }
  if (result?.selectedConnection !== undefined) {
    ctx.setSelectedConnection(result.selectedConnection);
  }
  if (result?.exit) {
    ctx.exit();
  }
  if (result?.error) {
    ctx.setError(result.error);
  }
}
