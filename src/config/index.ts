/**
 * @file Configuration schema, loading and validation.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import fs from "node:fs";
import process from "node:process";
import { inspect } from "node:util";
import chalk from "chalk";
import JSON5 from "json5";
import _ from "lodash";
import { ZodError, z } from "zod";
import { fromZodIssue } from "zod-validation-error";
import { labels, log } from "../logging.js";
import { arkSchema } from "./ark.ts";

/** The filename of the user-provided configuration file. */
const userConfig = "config.json5";

/** The configuration schema. */
export const schema = z.object({
  // Discord bot client details
  client: z.object({
    // Bot → Token
    token: z.string().nonempty(),
    // General Information → Public Key
    publicKey: z.string().nonempty(),
    // General Information → Application ID
    applicationId: z.string().nonempty(),
  }),
  // ARK: Survival Ascended
  ark: arkSchema,
});

/** The configuration object type. */
export type Config = z.infer<typeof schema>;

/**
 * Loads and returns the default configuration file.
 *
 * @return default config object
 */
// biome-ignore lint/suspicious/noExplicitAny: the JSON can have any value type
export function loadDefaults(): Record<string, any> {
  log.verbose("Applying default configuration", labels.config);
  const content = fs.readFileSync(new URL("default.json5", import.meta.url)).toString();
  const object = JSON5.parse(content);
  log.debug("Default config: %s", inspect(object, { colors: true }), labels.config);
  return object;
}

/**
 * Loads and returns the user-provided configuration file.
 *
 * @return user config object
 */
// biome-ignore lint/suspicious/noExplicitAny: the JSON can have any value type
export function loadUserConfig(): Record<string, any> {
  log.verbose("Applying user configuration: %s", chalk.underline(userConfig), labels.config);

  // If the config file doesn't exist yet, create one
  try {
    if (!fs.existsSync(userConfig)) {
      fs.copyFileSync(new URL("example.json5", import.meta.url), userConfig);
      log.log(
        "success",
        `We couldn't find a ${chalk.bold.underline(userConfig)} file so we've created one for you`,
        labels.config,
      );
      log.log("info", "↪ Go ahead and apply your changes to this file, and then restart the bot", labels.config);
    }
  } catch (error) {
    log.error("Unable to create default user configuration file!\n%s", error, labels.config);
    return {};
  }

  // Attempt to read the config file
  try {
    const content = fs.readFileSync(userConfig).toString();
    const object = JSON5.parse(content);
    log.debug("User config: %s", inspect(object, { colors: true }), labels.config);
    return object;
  } catch (error) {
    log.error("Unable to read user configuration file!\n%s", error, labels.config);
    return {};
  }
}

/**
 * Loads and returns environment variables that are present.
 *
 * @return config object
 */
export function loadEnvironment(): Record<string, object | string> {
  log.verbose("Applying environment variables", labels.config);
  const content = fs.readFileSync(new URL("environment.json5", import.meta.url)).toString();
  const parsed = JSON5.parse(content);

  const replaceWithEnv = (object: Record<string, object | string>) => {
    for (const key of Object.keys(object)) {
      const value = object[key];
      if (typeof value === "string") {
        if (Object.hasOwn(process.env, value) && process.env[value] !== null) {
          log.debug("%s → %s", value, process.env[value], labels.config);
          object[key] = process.env[value] as string;
        } else {
          delete object[key];
        }
      } else if (typeof value === "object") {
        replaceWithEnv(value as Record<string, object | string>);
      }
    }
  };

  replaceWithEnv(parsed as Record<string, string>);

  log.debug("Environment config: %s", inspect(parsed, { colors: true }), labels.config);

  return parsed;
}

/**
 * Loads, validates and returns the configuration file.
 *
 * @return validated config object or undefined if invalid
 */
export function getConfig(): Config | undefined {
  log.info("Loading configuration...", labels.config);

  // Merge the various configurations
  const defaults = loadDefaults();
  const userConfig = loadUserConfig();
  const environment = loadEnvironment();
  const merged = _.merge(defaults, userConfig, environment);

  // Validate the configuration
  let config: Config;
  try {
    log.verbose("Validating configuration", labels.config);
    config = schema.parse(merged);
  } catch (error) {
    if (error instanceof ZodError) {
      log.error(
        error.issues.reduce(
          (message, issue, i, issues) =>
            `${message}\n${i < issues.length - 1 ? "├" : "└"} ${fromZodIssue(issue, { prefix: null }).message}`,
          `We found ${chalk.bold.underline(`${error.issues.length} ${error.issues.length === 1 ? "issue" : "issues"}`)} with your configuration:`,
        ),
        labels.config,
      );
    } else {
      log.error("The configuration could not be validated!\n%s", error, labels.config);
    }

    return undefined;
  }

  // Finally, return the validated config object
  log.log("success", "Successfully loaded configuration!", labels.config);
  log.debug("Validated config: %s", inspect(config, { colors: true }), labels.config);
  return config;
}
