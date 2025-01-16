import { sleep } from "bun";
import type { Client, TextChannel } from "discord.js";
import { and, desc, eq } from "drizzle-orm";
import {
  ButtonStyle,
  type CommandContext,
  type ComponentContext,
  ComponentType,
  type SlashCreator,
} from "slash-create";
import Rcon from "ts-rcon";
import type { Config } from "../config";
import type { ArkServer } from "../config/ark.ts";
import { db } from "../db";
import { arkDinoWipeBlocks, arkDinoWipes } from "../db/schema.ts";
import { labels, log } from "../logging.ts";
import { SlashCommand } from "./index.ts";

/**
 * A Discord command to poll for a dinosaur wipe.
 */
export default class DinoWipeCommand extends SlashCommand {
  constructor(creator: SlashCreator, config: Config) {
    super(creator, { name: "dinowipe", description: "Start a poll for an ARK dinosaur wipe." }, config);
  }

  async run(ctx: CommandContext) {
    // Prompt to choose an ARK server
    const servers = this.config.ark.servers.map((server) => ({
      label: server.name,
      value: server.name,
      emoji: { name: server.emoji },
    }));
    await ctx.send({
      content: "Choose an ARK server",
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [{ type: ComponentType.STRING_SELECT, custom_id: "server_input", options: servers }],
        },
      ],
    });
    ctx.registerComponent("server_input", async (inputCtx) => {
      // Validate the chosen ARK server
      const arkServer = this.config.ark.servers.find((server) => server.name === inputCtx.values[0]);
      if (!arkServer) return await inputCtx.editOriginal({ content: `That ARK server doesn't exist!` });

      // Check if there was recently a winning poll
      const polls = await db
        .select()
        .from(arkDinoWipes)
        .where(and(eq(arkDinoWipes.server, arkServer.name), eq(arkDinoWipes.success, true)))
        .orderBy(desc(arkDinoWipes.created_at));
      let nextPollAt =
        polls.length > 0 ? new Date(polls[0].created_at.getTime() + this.config.ark.dinowipeCooldown * 1_000) : null;
      if (nextPollAt && nextPollAt <= new Date()) nextPollAt = null;

      // Check if there are any holds in place
      const holds = await db.select().from(arkDinoWipeBlocks).where(eq(arkDinoWipeBlocks.server, arkServer.name));

      // Prompt for an action
      await inputCtx.editOriginal({
        content: `${holds.length === 0 && !nextPollAt ? `Would you like to dino wipe **${arkServer.label}**?` : ""}
${holds.length > 0 ? `<@${holds[0].user_id}> is preventing dino wipes on **${arkServer.label}**: ${getTimestamp(holds[0].created_at, "R")}!` : ""}
${nextPollAt ? `You can ask for another dino wipe on **${arkServer.label}** ${getTimestamp(nextPollAt, "R")}!` : ""}`.trim(),
        components: [
          {
            type: ComponentType.ACTION_ROW,
            components: [
              // Start a dinosaur wipe poll
              {
                type: ComponentType.BUTTON,
                style: ButtonStyle.PRIMARY,
                custom_id: "poll_button",
                label: "Start Poll",
                emoji: { name: "🙋" },
                disabled: holds.length > 0 || nextPollAt !== null,
              },
              holds.length === 0
                ? // Prevent future dinosaur wipe polls
                  {
                    type: ComponentType.BUTTON,
                    style: ButtonStyle.SECONDARY,
                    custom_id: "hold_btn",
                    label: "Hold",
                    emoji: { name: "⏸️" },
                  }
                : // Resume future dinosaur wipe polls
                  {
                    type: ComponentType.BUTTON,
                    style: ButtonStyle.SUCCESS,
                    custom_id: "resume_btn",
                    label: "Resume",
                    emoji: { name: "▶️" },
                  },
            ],
          },
        ],
      });
      inputCtx.registerComponent("poll_button", async (btnCtx) => await this.startPoll(ctx, btnCtx, arkServer));
      inputCtx.registerComponent("hold_btn", async (btnCtx) => await this.holdPolls(ctx, btnCtx, arkServer));
      inputCtx.registerComponent("resume_btn", async (btnCtx) => await this.resumePolls(ctx, btnCtx, arkServer));
    });
  }

  /**
   * Start a dinosaur wipe poll.
   *
   * @param ctx Slash command context.
   * @param btnCtx Button component context.
   * @param arkServer The chosen ARK server.
   */
  async startPoll(ctx: CommandContext, btnCtx: ComponentContext, arkServer: ArkServer) {
    const user = btnCtx.user;
    await btnCtx.acknowledge();
    log.debug("@%s is starting a new dino wipe poll on %s...", user.username, arkServer.label, labels.ark);

    // Send some instructions
    await btnCtx.editOriginal({
      content: `For a dino wipe to take place on **${arkServer.label}**, you must get 100% favour ${getTimestamp(new Date(new Date().getTime() + this.config.ark.dinowipePollDuration * 1_000), "R")}`,
      components: [],
    });

    // Start a new poll
    const pollMessage = await btnCtx.sendFollowUp({
      poll: {
        question: {
          text: `${user.globalName ?? user.username} is asking for a dino wipe on ${arkServer.label}`,
        },
        answers: [
          { answer_id: 1, poll_media: { text: "Yes", emoji: { name: "✅" } } },
          { answer_id: 2, poll_media: { text: "No", emoji: { name: "🙅" } } },
        ],
        duration: Math.max(Math.floor(this.config.ark.dinowipePollDuration / 3_600), 1),
      },
    });
    log.info("@%s started a new dino wipe poll on %s (%s)", user.username, arkServer.label, pollMessage.id, labels.ark);
    await db.insert(arkDinoWipes).values({ user_id: user.id, server: arkServer.name, poll_id: pollMessage.id });

    // Wait for the poll duration
    // NB: Discord has a minimum of 1hr, so we'll have to manually end it ourselves
    setTimeout(async () => {
      // End the poll
      const channel = (await (this.client as Client).channels.fetch(pollMessage.channelID))!;
      const message = await (channel as TextChannel).messages.endPoll(pollMessage.id);
      // Check the poll results
      const yesAnswer = message.poll!.answers.get(1)!;
      const noAnswer = message.poll!.answers.get(2)!;
      // Send feedback
      if (yesAnswer.voteCount === 0 && noAnswer.voteCount === 0) {
        // The dino wipe is undecided
        log.info("@%s's dino wipe poll on %s was undecided", user.username, arkServer.label, labels.ark);
        await message.reply(`No one voted for a dino wipe on **${arkServer.name}** 🤷‍♀️`);
        await db.update(arkDinoWipes).set({ success: false }).where(eq(arkDinoWipes.poll_id, message.id));
      } else if (noAnswer.voteCount >= 1) {
        // At least one person objected to a dino wipe
        log.info("@%s's dino wipe poll on %s failed", user.username, arkServer.label, labels.ark);
        await message.reply(`At least one person objected to a dino wipe on **${arkServer.name}** 🙅‍♀️`);
        await db.update(arkDinoWipes).set({ success: false }).where(eq(arkDinoWipes.poll_id, message.id));
      } else {
        // The dino wipe will go ahead
        log.info("@%s's dino wipe poll on %s succeeded", user.username, arkServer.label, labels.ark);
        await message.reply(`Everyone voted for a dino wipe on **${arkServer.label}**, sending instructions...`);
        await performDinoWipe(arkServer);
      }
    }, this.config.ark.dinowipePollDuration * 1_000);
  }

  /**
   * Prevent future dinosaur wipe polls.
   *
   * @param ctx Slash command context.
   * @param btnCtx Button component context.
   * @param arkServer The chosen ARK server.
   */
  async holdPolls(ctx: CommandContext, btnCtx: ComponentContext, arkServer: ArkServer) {
    await btnCtx.acknowledge();
    await db
      .insert(arkDinoWipeBlocks)
      .values({ user_id: btnCtx.user.id, server: arkServer.name })
      .then(async () => {
        log.info("@%s is preventing dino wipe polls on %s", btnCtx.user.username, arkServer.label, labels.ark);
        await btnCtx.editOriginal({
          content: `${btnCtx.user.mention} is preventing dino wipe polls on **${arkServer.label}**.`,
          components: [],
        });
      })
      .catch(async (err) => {
        log.error("Unable to pause dino wipe polls on %s: %s", arkServer.label, err, labels.ark);
        await btnCtx.editOriginal({
          content: "We were unable to put dino wipes on hold for you, please try again later!",
          components: [],
        });
      });
  }

  /**
   * Resume future dinosaur wipe polls.
   *
   * @param ctx Slash command context.
   * @param btnCtx Button component context.
   * @param arkServer The chosen ARK server.
   */
  async resumePolls(ctx: CommandContext, btnCtx: ComponentContext, arkServer: ArkServer) {
    await btnCtx.acknowledge();
    await db
      .delete(arkDinoWipeBlocks)
      .where(eq(arkDinoWipeBlocks.server, arkServer.name))
      .then(async () => {
        log.info(
          "@%s is no longer preventing dino wipe polls on %s",
          btnCtx.user.username,
          arkServer.label,
          labels.ark,
        );
        await btnCtx.editOriginal({
          content: `${btnCtx.user.mention} is no longer preventing dino wipe polls on **${arkServer.label}**.`,
          components: [],
        });
      })
      .catch(async (err) => {
        log.error("Unable to resume dino wipe polls on %s: %s", arkServer.label, err, labels.ark);
        await btnCtx.editOriginal({
          content: "We were unable to remove your hold on dino wipes, please try again later!",
          components: [],
        });
      });
  }
}

/**
 * Returns a timestamp for Discord.
 *
 * @param date The date to represent.
 * @param format The format of the timestamp.
 * @return {string} A markdown formatted timestamp.
 */
export function getTimestamp(date: Date, format: "R" | "D" | "d" | "T" | "t" | "F" | "f"): string {
  return `<t:${Math.floor(date.getTime() / 1_000)}:${format}>`;
}

/**
 * Executes the `DestroyWildDinos` command on the given ARK server.
 *
 * @param arkServer The ARK server config to dino wipe.
 */
export async function performDinoWipe(arkServer: ArkServer) {
  // Check if this server has RCON configured
  if (!arkServer.rcon_ip || !arkServer.rcon_port || !arkServer.rcon_password) {
    log.warning(`The ${arkServer.label} ARK server does not have a valid RCON configuration!`);
    return;
  }

  // Connect a new RCON client
  const client = new Rcon(arkServer.rcon_ip, arkServer.rcon_port, arkServer.rcon_password);
  Object.defineProperty(client, "rconId", { value: 0, writable: true });
  Object.defineProperty(client, "challenge", { value: false, writable: true });

  // Execute the commands on the ARK server
  client.on("auth", async () => {
    log.info("(%s) RCON connected", arkServer.name, labels.ark);
    // Countdown in-game
    client.send("ServerChat All wild dinosaurs will be killed in 60 seconds...");
    await sleep(30_000);
    client.send("ServerChat All wild dinosaurs will be killed in 30 seconds...");
    await sleep(20_000);
    client.send("ServerChat All wild dinosaurs will be killed in 10 seconds...");
    await sleep(5_000);
    client.send("ServerChat All wild dinosaurs will be killed in 5 seconds...");
    await sleep(1_000);
    client.send("ServerChat All wild dinosaurs will be killed in 4 seconds...");
    await sleep(1_000);
    client.send("ServerChat All wild dinosaurs will be killed in 3 seconds...");
    await sleep(1_000);
    client.send("ServerChat All wild dinosaurs will be killed in 2 seconds...");
    await sleep(1_000);
    client.send("ServerChat All wild dinosaurs will be killed in 1 seconds...");
    await sleep(1_000);
    // Destroy wild dinosaurs
    client.send("DestroyWildDinos");
    client.send("ServerChat All wild dinosaurs that have been killed!");
    // Disconnect shortly after
    await sleep(3_000);
    client.disconnect();
  });
  client.on("response", async (msg: string) => log.debug("(%s) %s", arkServer.name, msg, labels.ark));
  client.on("error", async (error) => log.error("(%s) %s", arkServer.name, error, labels.ark));
  client.on("end", async () => log.info("(%s) RCON disconnected", arkServer.name, labels.ark));

  // Connect and exit
  log.info("(%s) RCON connecting...", arkServer.name, labels.ark);
  client.connect();
}
