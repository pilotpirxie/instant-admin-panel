// import { Router } from "express";
// import { Config } from "./configInterface";

// type PluginMetaFile = {
//   name: string;
//   author: string;
//   version: string;
//   description: string;
//   apiEntryFile: string;
//   clientEntryFile: string;
// }

// type ApiChangeRowFunction = ({
//   config,
//   pluginParams,
//   table,
//   row,
// }: {
//   config: Config;
//   pluginParams: Record<string, unknown>;
//   table: string;
//   row: Record<string, unknown>;
// }) => void

// express
// type ApiEntry = {
//   registerEndpoints: ({
//     config,
//     pluginParams,
//   }: {
//     config: Config;
//     pluginParams: Record<string, unknown>;
//   }) => Router;
//   registerAfterCreate?: ApiChangeRowFunction;
//   registerAfterUpdate?: ApiChangeRowFunction;
//   registerAfterDelete?: ApiChangeRowFunction;
//   registerAfterView?: ApiChangeRowFunction;
//   registerBeforeCreate?: ApiChangeRowFunction;
//   registerBeforeUpdate?: ApiChangeRowFunction;
//   registerBeforeDelete?: ApiChangeRowFunction;
//   registerBeforeView?: ApiChangeRowFunction;
// }

// react
// type ClientEntry = {
//   render: ({
//     config,
//     pluginParams,
//     slot,
//     slotType,
//   }: {
//     config: Config;
//     pluginParams: Record<string, unknown>;
//     slot: "appSidebar" | "appHeader" | "appFooter" | "aboveTable" | "belowTable" | "columnHeader" | "row" | "ceil";
//     slotType: "table" | "materializedView" | "column" | "row" | "ceil";
//   }) => React.ReactNode;
// }
