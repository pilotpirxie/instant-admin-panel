import { NextFunction, Request, Response } from 'express';
import { isAxiosError } from 'axios';
import {errorResponse} from "../utils/errorResponse";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  if (isAxiosError(err)) {
    console.error('AxiosError', err.response?.data);
    return errorResponse({
      response: res,
      errorCode: 'FailedDependency',
    });
  }

  if (err) {
    console.error(err);
  }

  if (err.name === 'PayloadTooLargeError') {
    return errorResponse({
      response: res,
      errorCode: 'PayloadTooLarge',
    });
  }

  return errorResponse({
    response: res,
    errorCode: 'InternalServerError',
  });
};
