/**
 * @file HLN-A - a Discord bot for unofficial ARK Survival Ascended clusters.
 * @author Jonathan Hiles <jonathan@hil.es>
 */

import process from "node:process";
import chalk from "chalk";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { pastel } from "gradient-string";
import { SlashCreator } from "slash-create";
import { type Config, getConfig } from "./config";
import { migrateDatabase } from "./db";
import { labels, log } from "./logging.js";
import { syncSlashCommands } from "./slash.js";

await (async () => {
  /**********************************************************************/
  // Print a splash message.
  console.log(
    pastel.multiline(
      atob(
        "ICBfICAgXyBfICAgICBfICAgXyAgICAgICAgIF8gICAgCiB8IHwgfCB8IHwgICB8IFwgfCB8ICAgICAgIC8gXAogfCB8X3wgfCB8ICAgfCAgXHwgfF9fX19fIC8gXyBcCiB8ICBfICB8IHxfX198IHxcICB8X19fX18vIF9fXyBcCiB8X3wgfF98X19fX198X3wgXF98ICAgIC9fLyAgIFxfXCA=",
      ),
    ),
  );
  console.log(`${" ".repeat(22) + chalk.grey("└ by Axieum")}\n`);

  /**********************************************************************/
  // Load the configuration to be used throughout the bot.
  const config: Config | undefined = getConfig();
  if (!config) {
    process.exitCode = 78; // Configuration error
    return;
  }

  /**********************************************************************/
  // Migrate the database.
  await migrateDatabase();

  /**********************************************************************/
  // Spin up a new Discord client.
  const client: Client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, () => {
    log.log("success", pastel(`Ready! Logged in as ${client.user?.tag}`), labels.discord);
  });

  /**********************************************************************/
  // Register and sync Discord slash interactions.
  const slash: SlashCreator = new SlashCreator({
    token: config.client.token,
    publicKey: config.client.publicKey,
    applicationID: config.client.applicationId,
    client,
  });

  await syncSlashCommands(slash);

  /**********************************************************************/
  // Login to Discord.
  await client.login(config.client.token).catch((error) => {
    log.error("Unable to login to Discord!\n%s", error, labels.discord);
    process.exitCode = 1; // Error
    return;
  });
})();
