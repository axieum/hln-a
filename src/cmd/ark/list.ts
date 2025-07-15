import { readableStreamToText, sleep, spawn } from "bun";
import { Colors } from "discord.js";
import { ButtonStyle, type CommandContext, type ComponentContext, ComponentType } from "slash-create";
import Rcon from "ts-rcon";
import type { ArkServer } from "../../config/ark.ts";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";

/**
 * A Discord command to list running ARK servers.
 */
export default class ListCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer();
    try {
      // Query all running ARK servers
      const services = await this.getDockerServices(ctx);
      if (!services) {
        await ctx.editOriginal({
          content: "",
          embeds: [
            {
              description: "We couldn't reach any ARKs, please try again later!",
              color: Colors.Default,
            },
          ],
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
          const players = await listPlayers(arkServer);

          // Build the embed field
          return {
            name: arkServer.label,
            value: `**Players:** ${players}\n**Uptime:** ${uptime}`,
            inline: true,
          };
        }),
      );

      await ctx.editOriginal({
        content: "",
        embeds: [
          {
            description: "",
            fields: fields.filter((f) => !!f),
            color: Colors.Default,
          },
        ],
        components: [],
      });
    } catch (err) {
      log.error("@%s failed to query running ARK servers: %s", ctx.user.username, err, labels.ark);
      await ctx.editOriginal({
        content: "",
        embeds: [
          {
            description: "We tried to query running ARKs but failed, please try again later!",
            color: Colors.Red,
          },
        ],
        components: [],
      });
    }
  }

  /**
   * Query running ARK servers.
   *
   * @param ctx The command context.
   * @return An array of running ARK service names, or null if an error was encountered.
   */
  async getDockerServices(ctx: CommandContext) {
    log.debug("@%s is querying running ARK servers...", ctx.user.username, labels.ark);
    const proc = spawn([
      "docker",
      "compose",
      "-f",
      "/home/ark/docker-compose.yaml",
      "ps",
      "--format",
      "{{.Name}} | {{.RunningFor}}",
    ]);

    const exitCode = await proc.exited;
    const stdout = (await readableStreamToText(proc.stdout)).trim();
    log.debug("> %s", stdout, labels.ark);
    if (exitCode !== 0) {
      throw new Error(`Failed to query running ARK servers with exit code ${proc.exitCode}!`);
    }

    // Return [['ark-ragnarok', '3 days'], ...]
    const arks = stdout
      .split("\n")
      .map((line) => line.trim().split(" | "))
      .map(([service, uptime]) => [service, uptime.replace(" ago", "").trim()]);
    log.info("found ARKs: %s", arks, labels.ark);
    return arks;
  }
}

/**
 * Executes the `ListPlayers` command on the given ARK server.
 *
 * @param arkServer The ARK server config to list players.
 */
export async function listPlayers(arkServer: ArkServer): Promise<string> {
  // Check if this server has RCON configured
  if (!arkServer.rcon_ip || !arkServer.rcon_port || !arkServer.rcon_password) {
    throw new Error(`The ${arkServer.label} ARK server does not have a valid RCON configuration!`);
  }

  // Connect a new RCON client
  const client = new Rcon(arkServer.rcon_ip, arkServer.rcon_port, arkServer.rcon_password);
  Object.defineProperty(client, "rconId", { value: 0, writable: true });
  Object.defineProperty(client, "challenge", { value: false, writable: true });

  // Execute the commands on the ARK server
  return await new Promise((resolve, reject) => {
    client.on("auth", async () => {
      log.info("(%s) RCON connected", arkServer.name, labels.ark);
      // List players
      client.send("ListPlayers");
      // Disconnect shortly after
      await sleep(3_000);
      client.disconnect();
    });
    client.on("response", async (msg: string) => {
      log.debug("(%s) %s", arkServer.name, msg, labels.ark);
      resolve(
        msg
          .trim()
          .toLowerCase()
          .replace(/^./, (c) => c.toUpperCase()),
      );
    });
    client.on("error", async (error) => log.error("(%s) %s", arkServer.name, error, labels.ark));
    client.on("end", async () => log.info("(%s) RCON disconnected", arkServer.name, labels.ark));

    // Connect and exit
    log.info("(%s) RCON connecting...", arkServer.name, labels.ark);
    client.connect();
    setTimeout(() => {
      client.disconnect();
      reject(new Error("Server did not respond in time!"));
    }, 15_000);
  });
}
