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

    // Query all running ARK servers
    const services = await this.queryRunningServers(ctx);
    if (!services) return;

    // Get the ARK server configurations
    const arkServers: ArkServer[] = [];
    for (const [service] of services) {
      const arkServer = this.config.ark.servers.find((server) => server.docker_service === service);
      if (arkServer) arkServers.push(arkServer);
      else log.warn("ARK server %s not found in config!", service, labels.ark);
    }

    // Query the number of connected players to each running ARK server
    const players = await Promise.all(arkServers.map(listPlayers));
    log.debug("ARK players: %s", players, labels.ark);

    await ctx.editOriginal({
      content: "",
      embeds: [
        {
          description: `**${arkServers.length}** ARKs`,
          fields: arkServers.map((arkServer) => ({
            name: `${arkServer.emoji} ${arkServer.label}`,
            value: `**Players:** ${players[arkServers.indexOf(arkServer)]}
**Uptime:** ${services.find(([service]) => service === arkServer.docker_service)?.[1].replace(" ago", "") ?? "Unknown"}
**Memory:** 10 GB`,
            inline: true,
          })),
        },
      ],
    });
  }

  /**
   * Query running ARK servers.
   *
   * @param ctx The command context.
   * @return An array of running ARK service names, or null if an error was encountered.
   */
  async queryRunningServers(ctx: CommandContext) {
    try {
      log.debug("@%s is querying running ARK servers...", ctx.user.username, labels.ark);
      const proc = spawn([
        "docker",
        "compose",
        "-f",
        "/home/ark/docker-compose.yaml",
        "ps",
        "--format",
        "{{.Name}} / {{.RunningFor}}",
      ]);

      const exitCode = await proc.exited;
      const stdout = (await readableStreamToText(proc.stdout)).trim();
      log.debug("> %s", stdout, labels.ark);

      if (exitCode === 0) {
        const services = stdout.split("\n");
        log.info("found ARKs: %s", services, labels.ark);
        return services.map((service) => service.split(" / "));
      }

      log.error(
        "@%s failed to query running ARK servers with exit code %d",
        ctx.user.username,
        proc.exitCode,
        labels.ark,
      );
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

    return null;
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
      resolve(msg);
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
