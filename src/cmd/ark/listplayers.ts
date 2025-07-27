import { sleep } from "bun";
import { Colors } from "discord.js";
import { type CommandContext, InteractionResponseFlags } from "slash-create";
import Rcon from "ts-rcon";
import type { ArkServer } from "../../config/ark.ts";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";

/**
 * A Discord command to check online players.
 */
export default class ListPlayersCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer(InteractionResponseFlags.EPHEMERAL);

    // Get the chosen ARK server
    const arkServer = this.config.ark.servers.find((server) => server.name === ctx.options.listplayers.server);
    if (!arkServer) {
      await ctx.send({ content: `That ARK server doesn't exist!`, components: [] });
      return;
    }

    // Query the ARK server
    log.info("@%s's is querying online players on %s...", ctx.user.username, arkServer.label, labels.ark);
    await listPlayers(arkServer)
      .then((players) => players.map((player, index) => `${index + 1}. **${player}**`))
      .then(async (players) => {
        await ctx.send({
          embeds: [
            players.length > 0
              ? {
                  description:
                    players.length > 1
                      ? `There are ${players.length} players on **${arkServer.label}** —\n\n${players.join("\n")}`
                      : `There is one player on **${arkServer.label}** —\n\n${players[0]}`,
                  color: Colors.Green,
                }
              : { description: `There are no players on **${arkServer.label}**!` },
          ],
        });
      })
      .catch(async (err) => {
        log.error("Could not list players: %s", err, labels.ark);
        return await ctx.send({
          embeds: [
            { description: `We couldn't reach **${arkServer.label}**, please try again later!`, color: Colors.Red },
          ],
        });
      });
  }
}

/**
 * Executes the `ListPlayers` command on the given ARK server.
 *
 * @param arkServer The ARK server config to list players.
 * @return A list of player names.
 */
export async function listPlayers(arkServer: ArkServer) {
  // Check if this server has RCON configured
  if (!arkServer.rcon_ip || !arkServer.rcon_port || !arkServer.rcon_password) {
    throw new Error(`The ${arkServer.label} ARK server does not have a valid RCON configuration!`);
  }

  // Connect a new RCON client
  const client = new Rcon(arkServer.rcon_ip, arkServer.rcon_port, arkServer.rcon_password);
  Object.defineProperty(client, "rconId", { value: 0, writable: true });
  Object.defineProperty(client, "challenge", { value: false, writable: true });

  return await new Promise((resolve: (value: string[]) => void, reject) => {
    // Execute the commands on the ARK server
    client.on("auth", async () => {
      log.info("(%s) RCON connected", arkServer.name, labels.ark);
      client.send("ListPlayers");
      await sleep(1_000);
      client.disconnect();
    });
    client.on("response", async (msg: string) =>
      resolve([...msg.matchAll(/^(\d+)\. ([^,]+), \w+/gm)].map((entry) => entry[2])),
    );
    client.on("error", async (error) => log.error("(%s) %s", arkServer.name, error, labels.ark));
    client.on("end", async () => log.info("(%s) RCON disconnected", arkServer.name, labels.ark));

    // Connect and exit
    log.info("(%s) RCON connecting...", arkServer.name, labels.ark);
    client.connect();
    setTimeout(() => {
      client.disconnect();
      reject(new Error("Server did not respond in time!"));
    }, 10_000);
  });
}
