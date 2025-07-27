import { readableStreamToText, spawn } from "bun";
import { Colors } from "discord.js";
import type { CommandContext } from "slash-create";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";
import { listPlayers } from "./listplayers.ts";

/**
 * A Discord command to list running ARK servers.
 */
export default class ListCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer();
    try {
      // Query all running ARK servers
      const services = await getDockerServices(ctx);
      if (!services) {
        await ctx.editOriginal({
          content: "",
          embeds: [{ description: "We couldn't reach any ARKs, please try again later!", color: Colors.Default }],
          components: [],
        });
        return;
      }

      // Build an embed field for each ARK server
      const fields = await Promise.all(
        services.map(async ([service, uptime]) => {
          // Get the ARK server configuration
          const arkServer = this.config.ark.servers.find((server) => server.docker_service === service);
          if (!arkServer) {
            log.warn("ARK server %s not found in config!", service, labels.ark);
            return null;
          }

          // Query the number of connected players
          const players = await listPlayers(arkServer).then((players) =>
            players.length > 0 ? `\n${players.map((player, index) => `${index + 1}. ${player}`).join("\n")}` : "No players",
          );

          // Build the embed field
          return {
            name: arkServer.label,
            value: `Up for ${uptime}\n**Players:** ${players}`,
            inline: true,
          };
        }),
      ).then((fields) => fields.filter((f) => !!f));

      // Send the final running ARK list
      if (fields.length !== 0) {
        await ctx.editOriginal({ content: "", embeds: [{ description: "", fields }], components: [] });
      } else {
        await ctx.editOriginal({
          content: "",
          embeds: [{ description: "We couldn't reach any ARKs.", color: Colors.Yellow }],
          components: [],
        });
      }
    } catch (err) {
      log.error("@%s failed to query running ARK servers: %s", ctx.user.username, err, labels.ark);
      await ctx.editOriginal({
        content: "",
        embeds: [
          { description: "We tried to query running ARKs but failed, please try again later!", color: Colors.Red },
        ],
        components: [],
      });
    }
  }
}

/**
 * Query running ARK servers.
 *
 * @param ctx The command context.
 * @return An array of running ARK service names.
 */
export async function getDockerServices(ctx: CommandContext) {
  log.debug("@%s is querying running ARK servers...", ctx.user.username, labels.ark);
  const proc = spawn([
    "docker",
    "compose",
    "-f",
    "/home/ark/docker-compose.yaml",
    "ps",
    "--format",
    "{{.Name}} | {{.RunningFor}}", // e.g. ark-ragnarok | 3 days ago
  ]);

  const exitCode = await proc.exited;
  const stdout = (await readableStreamToText(proc.stdout)).trim();
  log.debug("> %s", stdout, labels.ark);
  if (exitCode !== 0) {
    throw new Error(`Failed to query running ARK servers with exit code ${proc.exitCode}!`);
  }

  // Return [['ark-ragnarok', '3 days'], ...]
  return stdout
    .split("\n")
    .map((line) => line.trim().split(" | "))
    .map(([service, uptime]) => [service, uptime.replace(" ago", "").trim()]);
}
