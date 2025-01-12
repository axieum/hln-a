/**
 * @file Discord slash interaction utilities.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import chalk from "chalk";
import { type Client, GatewayDispatchEvents } from "discord.js";
import { GatewayServer, type SlashCreator } from "slash-create";
import { commands } from "./cmd";
import { labels, log } from "./logging";

/**
 * Registers and syncs all Discord slash commands.
 *
 * @param creator slash-create client
 * @return promise for syncing slash commands
 */
export async function syncSlashCommands(creator: SlashCreator): Promise<void> {
  log.info("Syncing slash commands...", labels.commands);

  // Register commands
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
        chalk.underline(`/${cmd.commandName}`),
        labels.commands,
      ),
    )
    .on("commandError", (cmd, error) =>
      log.error("The %s command failed!\n%s", chalk.underline(`/${cmd.commandName}`), error, labels.commands),
    )
    .registerCommands(commands);

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
