import { type CommandContext, CommandOptionType, type SlashCreator } from "slash-create";
import type { Config } from "../../config";
import { SlashCommand } from "../index.ts";
import DinoWipeCommand from "./dinowipe.ts";
import ListCommand from "./list.ts";
import RestartCommand from "./restart.ts";
import StopCommand from "./stop.ts";

/**
 * A Discord command for interacting with an ARK: Survival Ascended cluster.
 */
export default class ArkCommand extends SlashCommand {
  constructor(creator: SlashCreator, config: Config) {
    const serverChoices = config.ark.servers.map((server) => ({
      name: server.name,
      value: server.name,
      emoji: { name: server.emoji },
    }));
    super(
      creator,
      {
        name: "ark",
        description: "Interact with an ARK: Survival Ascended cluster.",
        options: [
          // `/ark dinowipe` - Start a poll for an ARK dinosaur wipe.
          {
            type: CommandOptionType.SUB_COMMAND,
            name: "dinowipe",
            description: "Start a poll for an ARK dinosaur wipe.",
            options: [
              {
                type: CommandOptionType.STRING,
                name: "server",
                description: "The ARK server to dino wipe.",
                required: true,
                choices: serverChoices,
              },
            ],
          },
          // `/ark list` - List running ARK servers.
          {
            type: CommandOptionType.SUB_COMMAND,
            name: "list",
            description: "List running ARK servers.",
          },
          // `/ark restart` - Restart an ARK server.
          {
            type: CommandOptionType.SUB_COMMAND,
            name: "restart",
            description: "Restart an ARK server.",
            options: [
              {
                type: CommandOptionType.STRING,
                name: "server",
                description: "The ARK server to restart.",
                required: true,
                choices: serverChoices,
              },
            ],
          },
          // `/ark stop` - Stop an ARK server.
          {
            type: CommandOptionType.SUB_COMMAND,
            name: "stop",
            description: "Stop an ARK server.",
            options: [
              {
                type: CommandOptionType.STRING,
                name: "server",
                description: "The ARK server to stop.",
                required: true,
                choices: serverChoices,
              },
            ],
          },
        ],
      },
      config,
    );
  }

  async run(ctx: CommandContext) {
    switch (ctx.subcommands[0]!) {
      case "dinowipe":
        await new DinoWipeCommand(this, ctx, this.config).run(ctx);
        break;
      case "list":
        await new ListCommand(this, ctx, this.config).run(ctx);
        break;
      case "restart":
        await new RestartCommand(this, ctx, this.config).run(ctx);
        break;
      case "stop":
        await new StopCommand(this, ctx, this.config).run(ctx);
        break;
    }
  }
}
