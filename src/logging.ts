/**
 * @file Logging utilities.
 * @author Jonathan Hiles <jonathan@hil.es>
 * @since 1.0.0
 */

import process from "node:process";
import chalk from "chalk";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

/** The directory to store log files. */
const logsDir = process.env.HLNA_LOGS_DIR ?? "./logs";

/** A hierarchy of log level names. */
const levels = {
  error: 0,
  warn: 1,
  success: 2,
  info: 3,
  verbose: 4,
  debug: 5,
};

/** A mapping of log levels to colours for use in terminals. */
const colors = {
  error: "brightRed",
  warn: "brightYellow",
  success: "brightGreen",
  info: [],
  verbose: "cyan",
  debug: "grey",
};

/** A mapping of log levels to symbols for use in terminals. */
const symbols = {
  error: chalk.redBright("◉"),
  warn: chalk.yellow("◉"),
  success: chalk.greenBright("◉"),
  info: "◉",
  verbose: chalk.cyan("○"),
  debug: chalk.grey("◌"),
};

/** A predefined collection of reusable log labels. */
export const labels = {
  discord: { label: "discord" },
  db: { label: "db" },
  commands: { label: "commands" },
  config: { label: "config" },
  ark: { label: "ark" },
};

/** A mapping of predefined log labels to their styled variant for use in terminals. */
const styledLabels = {
  discord: chalk.hex("#ffbb33")("[DISCORD]"),
  db: chalk.hex("#35b6fc")("[DB]"),
  commands: chalk.hex("#ffdc9c")("[COMMANDS]"),
  config: chalk.hex("#f6e3bf")("[CONFIG]"),
  ark: chalk.hex("#00d724")("[ARK]"),
};

/** The metadata attached to a log record. */
export type LogMetadata = {
  label: string;
};

/** The global logger. */
export const log = createLogger({
  level: process.env.HLNA_LOG_LEVEL ?? "info",
  levels,
  format: format.combine(
    format.timestamp(),
    format.splat(),
    format.metadata({ fillExcept: ["timestamp", "level", "message"] }),
  ),
  transports: [
    // Console
    // https://github.com/winstonjs/winston/blob/master/docs/transports.md#console-transport
    new transports.Console({
      format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        format.colorize({ message: true, colors }),
        format.printf((info) => {
          const symbol = (symbols as Record<string, string>)[info.level] ?? symbols.info;
          const timestamp = chalk.grey(`[${info.timestamp}]`);
          const metadata = info.metadata as LogMetadata;
          const label =
            metadata.label &&
            ((styledLabels as Record<string, string>)[metadata.label] ?? `[${metadata.label.toUpperCase()}]`);
          return `${symbol} ${timestamp}${label ? ` ${label}` : ""} ${info.message}`;
        }),
      ),
      stderrLevels: ["error", "warn"],
    }),
    // Daily rotating file
    // https://github.com/winstonjs/winston-daily-rotate-file#options
    new DailyRotateFile({
      filename: `${logsDir}/%DATE%.log`,
      auditFile: `${logsDir}/.audit.json`,
      maxSize: process.env.HLNA_LOG_MAX_SIZE ?? undefined,
      maxFiles: process.env.HLNA_LOG_RETENTION ?? "14d",
      zippedArchive: true,
      format: format.combine(format.uncolorize({ message: true }), format.json({ deterministic: false })),
    }),
  ],
});
