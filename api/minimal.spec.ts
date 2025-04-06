import * as fs from "fs";
import { Config } from "./src/data/ConfigInterface";
import { runWithConfigFile } from "./src/run";

const exampleConfig: Config = {
  database: {
    dialect: "postgresql",
    connection: {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres",
    },
  },
  accessControl: {
    roles: [
      {
        name: "admin",
        tables: [{
          name: /^.*/,
          permissions: {
            allowRead: true,
            allowWrite: true,
            allowDelete: true,
          }
        }]
      }
    ],
    localUsers: [
      {
        email: "admin@example.com",
        name: "Admin",
        passwordHash: "pbkdf2:sha256:100000$jZQeY9Yq$a256",
        salt: "pbkdf2:sha256:100000$jZQeY9Yq$a256",
        role: "admin",
      }
    ]
  },
};

const configContent = JSON.stringify(exampleConfig);
fs.writeFileSync("config.json", configContent);

runWithConfigFile(exampleConfig);