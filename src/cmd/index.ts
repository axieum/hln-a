/**
 * @file Discord slash command definitions.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import type { Client } from "discord.js";
import {
  type CommandContext,
  type SlashCommandOptions,
  type SlashCreator,
  SlashCommand as _SlashCommand,
} from "slash-create";
import type { Config } from "../config";

/**
 * An extended slash command that captures the application config.
 */
export abstract class SlashCommand extends _SlashCommand {
  /** The application configuration. */
  public config: Config;

  /**
   * Constructs a new slash command.
   *
   * @param creator The `slash-create` creator.
   * @param opts Any slash command options.
   * @param config The application configuration.
   */
  public constructor(creator: SlashCreator, opts: SlashCommandOptions, config: Config) {
    super(creator, opts);
    this.config = config;
  }

  /**
   * Returns the Discord client.
   */
  public get client(): Client {
    return super.client as Client;
  }
}

/**
 * A slash sub-command.
 */
export abstract class SlashSubCommand {
  /** The parent slash command. */
  protected parent: SlashCommand;
  /** The slash command execution context. */
  protected ctx: CommandContext;
  /** The application configuration. */
  protected config: Config;

  /**
   * Constructs a new slash sub-command.
   * @param parent The parent slash command.
   * @param ctx The slash command execution context.
   * @param config The application configuration.
   */
  public constructor(parent: SlashCommand, ctx: CommandContext, config: Config) {
    this.parent = parent;
    this.ctx = ctx;
    this.config = config;
  }

  /**
   * Returns the Discord client.
   */
  public get client() {
    return this.parent.client as Client;
  }

  /**
   * Executes the sub-command.
   */
  public abstract run(ctx: CommandContext): Promise<void>;
}
