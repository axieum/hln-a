import { type CommandContext, CommandOptionType, type SlashCreator } from "slash-create";
import type { Config } from "../../config";
import { SlashCommand } from "../index.ts";
import DinoWipeCommand from "./dinowipe.ts";
import ListPlayersCommand from "./listplayers.ts";

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
          },
          // `/ark listplayers` - List online players on an ARK.
          {
            type: CommandOptionType.SUB_COMMAND,
            name: "listplayers",
            description: "List online players on an ARK.",
            options: [
              {
                type: CommandOptionType.STRING,
                name: "server",
                description: "The ARK server to list online players.",
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
      case "listplayers":
        await new ListPlayersCommand(this, ctx, this.config).run(ctx);
        break;
    }
  }
}
