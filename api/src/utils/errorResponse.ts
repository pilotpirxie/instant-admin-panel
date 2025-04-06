import {Response} from "express";
import {ErrorCode, errorMessages, getErrorMessage} from "./errorMessages";
import {z} from "zod";
import {EndpointOutputSchema, TypedResponse} from "express-endpoints-collection";

export function getErrorResponseBody({
  errorCode,
  details
}: {
  errorCode: ErrorCode;
  details?: unknown
}) {
  const error = getErrorMessage(errorCode);

  return {
    timestamp: new Date().toISOString(),
    message: error.message,
    errorCode,
    details: details || {},
  };
}

export function getErrorResponseBodySchema() {
  return z.object({
    timestamp: z.string(),
    message: z.string(),
    errorCode: z.string(),
    details: z.any().optional(),
  });
}

export function errorResponse<T extends EndpointOutputSchema>({
  response,
  errorCode,
  details
}: {
  response: Response | TypedResponse<T>;
  errorCode: ErrorCode;
  details?: unknown
}) {
  const error = getErrorMessage(errorCode);

  return response
    .status(error.status)
    .json(getErrorResponseBody({
      errorCode,
      details
    }));
}

export function getValidationErrorHandler(error: Error, validationDetails: unknown) {
  return getErrorResponseBody({
    errorCode: 'ValidationError',
    details: validationDetails
  });
}

export function getErrorsSchemaFor({
  errorCodes
}: {
  errorCodes: ErrorCode[]
}) {
  const errorsSchema: EndpointOutputSchema = [];
  for (const errorCode of errorCodes) {
    errorsSchema.push({
      status: getErrorMessage(errorCode).status,
      description: errorMessages[errorCode].message,
      body: z.object({
        timestamp: z.string(),
        message: z.string(),
        errorCode: z.string(),
        details: z.any().optional(),
      }),
    });
  }

  return errorsSchema;
}

export function getCommonErrorsSchema() {
  return getErrorsSchemaFor({
    errorCodes: [
      'ValidationError',
      'GenericError',
      'InternalServerError',
      "PayloadTooLarge",
      "FailedDependency",
    ]
  });
}