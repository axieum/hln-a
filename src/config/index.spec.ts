import { afterEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import fs from "node:fs";
import process from "node:process";
import chalk from "chalk";
import { log } from "../logging";
import { getConfig, loadDefaults, loadEnvironment, loadUserConfig } from "./index";

void mock.module("node:fs", () => ({
  default: {
    copyFileSync: jest.fn(),
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => "{}"),
  },
}));

describe("config", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loadDefaults", async () => {
    spyOn(fs, "readFileSync").mockReturnValueOnce('{/* comment */"option": "value"}');
    expect(loadDefaults()).toMatchObject({ option: "value" });
  });

  describe("loadUserConfig", () => {
    it("should create a new config file when one does not exist yet", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValueOnce(false);
      const copyFileSyncSpy = spyOn(fs, "copyFileSync").mockImplementation(jest.fn());
      spyOn(fs, "readFileSync").mockReturnValueOnce('{/* defaults */"lorem": true}');

      const result = loadUserConfig();
      expect(existsSyncSpy).toHaveBeenCalled();
      expect(copyFileSyncSpy).toHaveBeenCalled();
      expect(result).toMatchObject({ lorem: true });
    });

    it("should return an empty object when unable to create a new config file", () => {
      const existsSyncSpy = spyOn(fs, "existsSync").mockReturnValueOnce(false);
      spyOn(fs, "copyFileSync").mockImplementationOnce(() => {
        throw new Error("expected");
      });

      const result = loadUserConfig();
      expect(existsSyncSpy).toHaveBeenCalled();
      expect(result).toMatchObject({});
    });

    it("should parse user configuration", () => {
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValueOnce(`{
        /* Discord bot client details. */
        "client": {
          // General Information → Application ID
          "applicationId": "this-is-a-mocked-value"
        }
      }`);

      const result = loadUserConfig();
      expect(readFileSyncSpy).toHaveBeenCalled();
      expect(result).toMatchObject({ client: { applicationId: "this-is-a-mocked-value" } });
    });

    it("should return an empty object when unable to parse the user configuration", () => {
      const readFileSyncSpy = spyOn(fs, "readFileSync").mockReturnValueOnce('{"client": {');

      const result = loadUserConfig();
      expect(readFileSyncSpy).toHaveBeenCalled();
      expect(result).toMatchObject({});
    });
  });

  it("loadEnvironment", () => {
    spyOn(fs, "readFileSync").mockReturnValueOnce(
      '{ "cat": { "lorem": "HLNA_LOREM", "missing": "HLNA_MISSING", "flag": "HLNA_FLAG", "sub": { "pi": "HLNA_PI" } } }',
    );
    // @ts-ignore TS2345 return `process.env` as object
    spyOn(process, "env").mockReturnValue({
      HLNA_LOREM: "Lorem ipsum dolor sit amet.",
      HLNA_FLAG: "true",
      HLNA_PI: "3.14",
    });

    const result = loadEnvironment();
    expect(result?.cat).toBeObject();
    expect(result.cat).toHaveProperty("lorem", "Lorem ipsum dolor sit amet.");
    expect(result.cat).toHaveProperty("flag", "true");
    expect(result.cat).not.toHaveProperty("missing");
    expect(result.cat).toHaveProperty("sub", { pi: "3.14" });
  });

  describe("getConfig", () => {
    it("should load configuration", () => {
      spyOn(fs, "readFileSync")
        // Defaults
        .mockReturnValueOnce(
          '{"client": {"token": "mock", "applicationId": null}, "ark": {"servers": [], "dinowipe": {}}}',
        )
        // User configuration
        .mockReturnValueOnce('{"client": {"applicationId": "123"}}')
        // Environment variables
        .mockReturnValueOnce('{"client": {"token": "HLNA_TOKEN", "publicKey": "HLNA_PUBLIC_KEY"}}');

      // @ts-ignore https://github.com/oven-sh/bun/issues/5279
      spyOn(process, "env").mockReturnValue({ HLNA_PUBLIC_KEY: "lorem" });

      expect(getConfig()).toMatchObject({
        client: {
          token: "mock",
          applicationId: "123",
          publicKey: "lorem",
        },
      });
    });

    it("should validate configuration", () => {
      const logErrorSpy = spyOn(log, "error");

      spyOn(fs, "readFileSync")
        // Defaults
        .mockReturnValueOnce('{"client": {"token": "mock", "applicationId": null}}')
        // User configuration
        .mockReturnValueOnce('{"client": {"applicationId": ""}}')
        // Environment variables
        .mockReturnValueOnce('{"client": {"token": "HLNA_TOKEN", "publicKey": "HLNA_PUBLIC_KEY"}}');

      // @ts-ignore https://github.com/oven-sh/bun/issues/5279
      spyOn(process, "env").mockReturnValue({ HLNA_TOKEN: "" });

      expect(getConfig()).toBeUndefined();
      expect(
        logErrorSpy.mock.lastCall?.[0].toString(),
      ).toBe(`We found ${chalk.bold.underline("4 issues")} with your configuration:
├ String must contain at least 1 character(s) at "client.token"
├ Required at "client.publicKey"
├ String must contain at least 1 character(s) at "client.applicationId"
└ Required at "ark"`);
    });
  });
});
