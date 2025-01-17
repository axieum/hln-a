import { type CommandContext, CommandOptionType, type SlashCreator } from "slash-create";
import type { Config } from "../../config";
import { SlashCommand } from "../index.ts";
import DinoWipeCommand from "./dinowipe.ts";

/**
 * A Discord command for interacting with an ARK: Survival Ascended cluster.
 */
export default class ArkCommand extends SlashCommand {
  constructor(creator: SlashCreator, config: Config) {
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
    }
  }
}
