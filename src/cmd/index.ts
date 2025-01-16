/**
 * @file Discord slash command definitions.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import { type SlashCommandOptions, type SlashCreator, SlashCommand as _SlashCommand } from "slash-create";
import type { Config } from "../config";

/**
 * An extended slash command that captures the application config.
 */
export abstract class SlashCommand extends _SlashCommand {
  public config: Config;

  public constructor(creator: SlashCreator, opts: SlashCommandOptions, config: Config) {
    super(creator, opts);
    this.config = config;
  }
}
