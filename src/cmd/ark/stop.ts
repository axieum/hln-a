import { spawn } from "bun";
import { Colors } from "discord.js";
import { ButtonStyle, type CommandContext, type ComponentContext, ComponentType } from "slash-create";
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
  log.info("@%s is stopping %s...", user.username, arkServer.label, labels.ark);

  try {
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
