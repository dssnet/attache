import { inject, provide } from "vue";

export interface SlashCommand {
  description: string;
  run: () => void;
}

const SLASH_COMMANDS_KEY = Symbol("slashCommands");

export function provideSlashCommands(commands: Record<string, SlashCommand>) {
  provide(SLASH_COMMANDS_KEY, commands);
}

export function useSlashCommands(): Record<string, SlashCommand> {
  return inject(SLASH_COMMANDS_KEY, {});
}
