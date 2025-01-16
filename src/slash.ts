/**
 * @file Discord slash interaction utilities.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import chalk from "chalk";
import { type Client, GatewayDispatchEvents } from "discord.js";
import { GatewayServer, type SlashCreator } from "slash-create";
import type { SlashCommand } from "./cmd";
import DinoWipeCommand from "./cmd/dinowipe.ts";
import type { Config } from "./config";
import { labels, log } from "./logging";

/**
 * A collection of all available Discord slash commands.
 */
export const ALL_COMMANDS: (new (creator: SlashCreator, config: Config) => SlashCommand)[] = [DinoWipeCommand];

/**
 * Registers and syncs all Discord slash commands.
 *
 * @param creator slash-create client
 * @param config The application configuration.
 * @return promise for syncing slash commands
 */
export async function syncSlashCommands(creator: SlashCreator, config: Config): Promise<void> {
  log.info("Syncing slash commands...", labels.commands);

  // Create `slash-create` client
  creator
    .withServer(
      new GatewayServer((handler) =>
        (creator.client as Client).ws.on(GatewayDispatchEvents.InteractionCreate, handler),
      ),
    )
    .on("debug", (message) => log.debug(message, labels.commands))
    .on("warn", (warning) => log.warn(warning instanceof Error ? warning.message : warning, labels.commands))
    .on("error", (error) => log.error(error.message, { stack: error }, labels.commands))
    .on("commandRegister", (cmd) =>
      log.verbose("Registering command: %s", chalk.underline(`/${cmd.commandName}`), labels.commands),
    )
    .on("commandRun", (cmd, _, ctx) =>
      log.info(
        "%s ran command %s",
        chalk.bold(`@${ctx.user.username}`),
        chalk.underline(`/${cmd.commandName}${ctx.subcommands.length > 0 ? ` ${ctx.subcommands.join(" ")}` : ""}`),
        labels.commands,
      ),
    )
    .on("commandError", (cmd, error) =>
      log.error("The %s command failed!\n%s", chalk.underline(`/${cmd.commandName}`), error, labels.commands),
    );

  // Register commands
  for (const command of ALL_COMMANDS) {
    creator.registerCommand(new command(creator, config));
  }

  // Sync the commands
  await creator
    .syncCommands()
    .then(() => {
      log.log("success", "Successfully synced slash commands!", labels.commands);
    })
    .catch((error) => {
      log.error("Unable to sync slash commands!\n%s", error, labels.commands);
    });
}
