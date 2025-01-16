import { z } from "zod";

/** The configuration entry for an ARK server. */
export const arkServerSchema = z
  .object({
    // The name of the ARK server
    name: z.string().nonempty(),
    // An emoji that represents the ARK server
    emoji: z.string().emoji(),
    // The RCON IP address used to execute commands
    rcon_ip: z.string().optional(),
    // The RCON port used to connect
    rcon_port: z.number().int().optional(),
    // The RCON admin password used to authenticate
    rcon_password: z.string().optional(),
  })
  .transform((obj) => ({
    ...obj,
    // A derived label for the ARK server including its emoji
    label: `${obj.emoji} ${obj.name}`.trim(),
  }));

/** The ARK server configuration object type. */
export type ArkServer = z.infer<typeof arkServerSchema>;

/** The ARK: Survival Ascended configuration schema. */
export const arkSchema = z.object({
  // A list of available ARK servers
  servers: z.array(arkServerSchema),
  // Dinosaur wipe options
  dinowipe: z.object({
    // An optional ID of the discord role to ping for updates
    ping: z.string().optional(),
    // The number of seconds between dino wipes
    cooldown: z.number().int().default(3_600), // 3600s = 1h
    // The number of seconds that the poll runs for
    pollDuration: z.number().int().default(300), // 300s = 5m
  }),
});
