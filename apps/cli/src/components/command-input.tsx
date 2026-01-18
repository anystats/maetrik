import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface CommandInputProps {
  onSubmit: (command: string) => void;
  placeholder?: string;
}

export function CommandInput({ onSubmit, placeholder = 'Type a command...' }: CommandInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (input: string) => {
    if (input.trim()) {
      onSubmit(input.trim());
      setValue('');
    }
  };

  return (
    <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text color="cyan">&gt; </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
