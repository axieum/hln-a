import { spawn } from "bun";
import { Colors } from "discord.js";
import { ButtonStyle, type CommandContext, type ComponentContext, ComponentType } from "slash-create";
import type { ArkServer } from "../../config/ark.ts";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";
import { getDockerServices } from "./list.ts";

/**
 * A Discord command to start an ARK server.
 */
export default class StartCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer();

    // Get the chosen ARK server
    const arkServer = this.config.ark.servers.find((server) => server.name === ctx.options.start.server);
    if (!arkServer) {
      await ctx.editOriginal({ content: `That ARK server doesn't exist!`, components: [] });
      return;
    }

    // Check that the ARK is actually running
    const services = await getDockerServices(ctx);
    if (services.find(([service]) => service === arkServer.docker_service)) {
      log.info("@%s tried to start %s but it was already online", ctx.user.username, arkServer.label, labels.ark);
      await ctx.editOriginal({
        content: "",
        embeds: [{ description: `You can't start **${arkServer.label}** as it is already online!`, color: Colors.Red }],
        components: [],
      });
      return;
    }

    // Check that the running ARK limit hasn't been reached
    if (services.length >= this.config.ark.maxServers) {
      log.info(
        "@%s tried to start %s but the server limit has been reached",
        ctx.user.username,
        arkServer.label,
        labels.ark,
      );
      await ctx.editOriginal({
        content: "",
        embeds: [
          {
            description: `You can't start **${arkServer.label}** as there are too many servers running!`,
            color: Colors.Red,
          },
        ],
      });
      return;
    }

    // Prompt for an action
    await ctx.editOriginal({
      content: `Are you sure you want to start **${arkServer.label}**?`,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            // Start the server
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              custom_id: "start_button",
              label: "Start",
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
    ctx.registerComponent("start_button", async (btnCtx) => await startArk(btnCtx, arkServer));
    ctx.registerComponent("cancel_button", async (btnCtx) => await btnCtx.delete());
  }
}

/**
 * Start an ARK server.
 *
 * @param btnCtx Button component context.
 * @param arkServer The chosen ARK server.
 */
export async function startArk(btnCtx: ComponentContext, arkServer: ArkServer) {
  const { user } = btnCtx;
  await btnCtx.acknowledge();
  log.info("@%s is starting %s...", user.username, arkServer.label, labels.ark);

  try {
    const proc = spawn([
      "docker",
      "compose",
      "-f",
      "/home/ark/docker-compose.yaml",
      "up",
      "-d",
      arkServer.docker_service,
    ]);

    if ((await proc.exited) === 0) {
      log.info("@%s started %s", user.username, arkServer.label, labels.ark);
      await btnCtx.editOriginal({
        content: "",
        embeds: [
          {
            description: `You just started **${arkServer.label}**, please wait a few minutes for it to appear.`,
            color: Colors.Green,
          },
        ],
        components: [],
      });
    } else {
      log.error("@%s failed to start %s with exit code", user.username, arkServer.label, proc.exitCode, labels.ark);
      await btnCtx.editOriginal({
        content: "",
        embeds: [
          {
            description: `We tried to start **${arkServer.label}** but failed, please try again later!`,
            color: Colors.Red,
          },
        ],
        components: [],
      });
    }
  } catch (err) {
    log.error("@%s failed to start %s: %s", user.username, arkServer.label, err, labels.ark);
    await btnCtx.editOriginal({
      content: "",
      embeds: [
        {
          description: `We tried to start **${arkServer.label}** but failed, please try again later!`,
          color: Colors.Red,
        },
      ],
      components: [],
    });
  }
}
