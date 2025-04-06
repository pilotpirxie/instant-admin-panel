import { Request } from "express";

export function getIp(req: Request): string {
  return (
    req.ips
    || req.ip
    || req.headers["x-forwarded-for"]
    || req.socket.remoteAddress
    || ""
  ).toString();
}
