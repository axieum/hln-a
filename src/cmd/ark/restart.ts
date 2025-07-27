import { readableStreamToText, spawn } from "bun";
import { Colors } from "discord.js";
import { ButtonStyle, type CommandContext, type ComponentContext, ComponentType } from "slash-create";
import type { ArkServer } from "../../config/ark.ts";
import { labels, log } from "../../logging.ts";
import { SlashSubCommand } from "../index.ts";

/**
 * A Discord command to restart an ARK server.
 */
export default class RestartCommand extends SlashSubCommand {
  async run(ctx: CommandContext) {
    await ctx.defer();

    // Get the chosen ARK server
    const arkServer = this.config.ark.servers.find((server) => server.name === ctx.options.restart.server);
    if (!arkServer) {
      await ctx.editOriginal({ content: `That ARK server doesn't exist!`, components: [] });
      return;
    }

    // Prompt for an action
    await ctx.editOriginal({
      content: `Are you sure you want to restart **${arkServer.label}**?`,
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            // Restart the server
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              custom_id: "restart_button",
              label: "Restart",
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
    ctx.registerComponent("restart_button", async (btnCtx) => await restartArk(btnCtx, arkServer));
    ctx.registerComponent("cancel_button", async (btnCtx) => await btnCtx.delete());
  }
}

/**
 * Perform an ARK server restart.
 *
 * @param btnCtx Button component context.
 * @param arkServer The chosen ARK server.
 */
export async function restartArk(btnCtx: ComponentContext, arkServer: ArkServer) {
  const { user } = btnCtx;
  log.info("@%s is restarting %s...", user.username, arkServer.label, labels.ark);

  try {
    const proc = spawn([
      "docker",
      "compose",
      "-f",
      "/home/ark/docker-compose.yaml",
      "restart",
      arkServer.docker_service,
    ]);

    const exitCode = await proc.exited;
    const stdout = (await readableStreamToText(proc.stdout)).trim();
    log.debug("> %s", stdout, labels.ark);

    if (exitCode === 0) {
      // `/docker compose restart` will exit successfully even if the container was never running, so check stdout
      if (stdout.length > 0) {
        log.info("@%s restarted %s", user.username, arkServer.label, labels.ark);
        await btnCtx.editOriginal({
          content: "",
          embeds: [
            {
              description: `You just restarted **${arkServer.label}**, please wait a few minutes for it to appear.`,
              color: Colors.Green,
            },
          ],
          components: [],
        });
      } else {
        log.info("@%s tried to restart %s but it was offline", user.username, arkServer.label, labels.ark);
        await btnCtx.editOriginal({
          content: "",
          embeds: [
            {
              description: `We tried to restart **${arkServer.label}** but it was offline!`,
              color: Colors.Red,
            },
          ],
          components: [],
        });
      }
    } else {
      log.error("@%s failed to restart %s with exit code", user.username, arkServer.label, proc.exitCode, labels.ark);
      await btnCtx.editOriginal({
        content: "",
        embeds: [
          {
            description: `We tried to restart **${arkServer.label}** but failed, please try again later!`,
            color: Colors.Red,
          },
        ],
        components: [],
      });
    }
  } catch (err) {
    log.error("@%s failed to restart %s: %s", user.username, arkServer.label, err, labels.ark);
    await btnCtx.editOriginal({
      content: "",
      embeds: [
        {
          description: `We tried to restart **${arkServer.label}** but failed, please try again later!`,
          color: Colors.Red,
        },
      ],
      components: [],
    });
  }
}
