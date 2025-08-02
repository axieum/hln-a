import { sleep, spawn } from "bun";
import { Colors } from "discord.js";
import { ButtonStyle, type CommandContext, type ComponentContext, ComponentType } from "slash-create";
import Rcon from "ts-rcon";
import type { ArkServer } from "../../config/ark.ts";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";
import { getDockerServices } from "./list.ts";

/**
 * A Discord command to stop an ARK server.
 */
export default class StopCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer();

    // Get the chosen ARK server
    const arkServer = this.config.ark.servers.find((server) => server.name === ctx.options.stop.server);
    if (!arkServer) {
      await ctx.editOriginal({ content: `That ARK server doesn't exist!`, components: [] });
      return;
    }

    // Check that the ARK is actually running
    if (!(await getDockerServices(ctx)).find(([service]) => service === arkServer.docker_service)) {
      log.info("@%s tried to stop %s but it was offline", ctx.user.username, arkServer.label, labels.ark);
      await ctx.editOriginal({
        content: "",
        embeds: [{ description: `You can't stop **${arkServer.label}** as it is already offline!`, color: Colors.Red }],
        components: [],
      });
      return;
    }

    // Prompt for an action
    await ctx.editOriginal({
      content: `Are you sure you want to stop **${arkServer.label}**?`,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            // Stop the server
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              custom_id: "stop_button",
              label: "Stop",
              emoji: { name: "✅" },
            },
            // Cancel
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.DANGER,
              custom_id: "cancel_button",
              label: "Cancel",
            },
          ],
        },
      ],
    });
    ctx.registerComponent("stop_button", async (btnCtx) => await stopArk(btnCtx, arkServer));
    ctx.registerComponent("cancel_button", async (btnCtx) => await btnCtx.delete());
  }
}

/**
 * Stop an ARK server.
 *
 * @param btnCtx Button component context.
 * @param arkServer The chosen ARK server.
 */
export async function stopArk(btnCtx: ComponentContext, arkServer: ArkServer) {
  const { user } = btnCtx;
  await btnCtx.acknowledge();

  // Save the ARK world
  try {
    log.info("@%s is saving %s...", user.username, arkServer.label, labels.ark);
    await btnCtx.editOriginal({ content: `Saving **${arkServer.label}** ...`, embeds: [], components: [] });
    await saveArk(arkServer);
  } catch (err) {
    log.error("@%s failed to save %s: %s", user.username, arkServer.label, err, labels.ark);
    await btnCtx.editOriginal({
      content: "",
      embeds: [
        {
          description: `We tried to save **${arkServer.label}** before stopping but failed, please try again later!`,
          color: Colors.Red,
        },
      ],
      components: [],
    });
    return;
  }

  // Stop the ARK server
  try {
    log.info("@%s is stopping %s...", user.username, arkServer.label, labels.ark);
    await btnCtx.editOriginal({ content: `Stopping **${arkServer.label}** ...`, embeds: [], components: [] });
    const proc = spawn(["docker", "compose", "-f", "/home/ark/docker-compose.yaml", "down", arkServer.docker_service]);

    if ((await proc.exited) === 0) {
      log.info("@%s stopped %s", user.username, arkServer.label, labels.ark);
      await btnCtx.editOriginal({
        content: "",
        embeds: [
          {
            description: `You just took **${arkServer.label}** offline.`,
            color: Colors.Green,
          },
        ],
        components: [],
      });
    } else {
      log.error("@%s failed to stop %s with exit code", user.username, arkServer.label, proc.exitCode, labels.ark);
      await btnCtx.editOriginal({
        content: "",
        embeds: [
          {
            description: `We tried to stop **${arkServer.label}** but failed, please try again later!`,
            color: Colors.Red,
          },
        ],
        components: [],
      });
    }
  } catch (err) {
    log.error("@%s failed to stop %s: %s", user.username, arkServer.label, err, labels.ark);
    await btnCtx.editOriginal({
      content: "",
      embeds: [
        {
          description: `We tried to stop **${arkServer.label}** but failed, please try again later!`,
          color: Colors.Red,
        },
      ],
      components: [],
    });
  }
}

/**
 * Executes the `SaveWorld` command on the given ARK server.
 *
 * @param arkServer The ARK server config to save.
 */
export async function saveArk(arkServer: ArkServer): Promise<void> {
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
      // Save the world
      client.send("SaveWorld");
      // Disconnect shortly after
      await sleep(10_000);
      client.disconnect();
      resolve();
    });
    client.on("response", async (msg: string) => log.debug("(%s) %s", arkServer.name, msg, labels.ark));
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
