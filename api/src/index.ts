#!/usr/bin/env node
import { program } from "commander";
import { runWithConfigFile } from "./run";
import * as fs from "fs";

program
  .name("instant-admin-panel")
  .description("Instant Admin Panel - A dynamic admin panel generator")
  .argument("[configFilePath]", "Path to the configuration file", "config.json")
  .action((configFilePath) => {
    const fileExists = fs.existsSync(configFilePath);
    if (!fileExists) {
      console.error(`File ${configFilePath} does not exist`);
      process.exit(1);
    }

    const configContent = fs.readFileSync(configFilePath, "utf8");
    const configJson = JSON.parse(configContent);
    runWithConfigFile(configJson);
  })
  .parse(process.argv);