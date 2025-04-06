import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {errorResponse} from "../utils/errorResponse";

const jwtVerify = (
  jwtSecret: string,
  options: {
    required: boolean
  } = {
    required: true
  }
) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    if (options.required) {
      return errorResponse({
        response: res,
        errorCode: "MissingAuthorizationHeader",
      });
    } else {
      return next();
    }
  }

  if (req.headers.authorization.split(" ")[0] !== "Bearer") {
    return errorResponse({
      response: res,
      errorCode: "InvalidAuthorizationHeader",
    });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return errorResponse({
      response: res,
      errorCode: "InvalidAuthorizationHeader",
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || typeof decoded !== "object" || !decoded.sub) {
      return errorResponse({
        response: res,
        errorCode: "InvalidToken",
      });
    }
    req.userId = Number(decoded.sub);
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return errorResponse({
        response: res,
        errorCode: "TokenExpired",
      });
    }

    return errorResponse({
      response: res,
      errorCode: "InvalidToken",
    });
  }
};

export default jwtVerify;
