import express, { Express } from 'express';
import * as dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import { errorHandler } from './middlewares/errors';
import {generateOpenAPI} from "express-endpoints-collection/dist/generator";
import * as fs from "node:fs";
import {getCommonErrorsSchema} from "./utils/errorResponse";
import { jsonSendStatus } from './middlewares/jsonSendStatus';
import { Config } from './data/configInterface';

export function runWithConfigFile(config: Config) {
  console.info(JSON.stringify(config, null, 2));

  dotenv.config();
  const port = process.env.PORT || 3000;
  const app: Express = express();
  app.set('trust proxy', true);
  app.use(bodyParser.json({ limit: process.env.MAX_BODY_SIZE || '1KB' }));
  app.use(cors());
  app.disable('x-powered-by');
  app.use(jsonSendStatus);
  
  app.get('/api/health', async (req, res) => res.sendStatus(200));
  
  const openApiYaml = generateOpenAPI({
    title: "API",
    version: "1.0.0",
    endpoints: [
      // TODO: Add endpoints here
    ],
    servers: ["http://localhost:3000/api/"],
    commonResponses: getCommonErrorsSchema(),
  });
  
  fs.writeFileSync("openapi.yaml", openApiYaml.toString());
  
  app.get("/openapi.yaml", (req, res) => {
    res.set("Content-Type", "text/yaml");
    return res.send(openApiYaml);
  });
  
  app.use(errorHandler);
  
  app.listen(port, () => {
    console.info({
      mode: process.env.NODE_ENV,
      sdk: process.version,
      datetime: new Date().toISOString(),
      url: `http://localhost:${port}`,
    });
    console.info(`Server is running on port ${port}`);
  });
}