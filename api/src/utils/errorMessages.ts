export const errorMessages = {
  GenericError: { message: "Something went wrong, try again later", status: 500 },
  InternalServerError: { message: "Internal server error", status: 500 },
  ValidationError: { message: "Invalid data, check your data and try again", status: 400 },
  InvalidCredentials: { message: "Invalid credentials, check your data and try again", status: 401 },
  UserNotFound: { message: "User not found", status: 404 },
  NotFound: { message: "Not found", status: 404 },
  InvalidFile: { message: "Invalid file", status: 400 },
  InvalidFileSize: { message: "File is too big", status: 400 },
  EmailNotVerified: { message: "Email not verified", status: 403 },
  UserAlreadyExists: { message: "User already exists. If you already have an account, try logging in", status: 409 },
  MissingAuthorizationHeader: { message: "Missing authorization header", status: 401 },
  InvalidAuthorizationHeader: { message: "Invalid authorization header", status: 401 },
  InvalidToken: { message: "Invalid token", status: 401 },
  InvalidCode: { message: "Code is invalid or expired", status: 400 },
  FailedDependency: { message: "Failed dependency", status: 424 },
  PayloadTooLarge: { message: "Payload too large", status: 413 },
  TokenExpired: { message: "Token expired", status: 401 },
  EmailAlreadyInUse: { message: "Email already in use", status: 409 },
};

export const GenericError = "GenericError";

export type ErrorCode = keyof typeof errorMessages;

export function getErrorMessage(errorCode: ErrorCode | null): { message: string; status: number } {
  if (!errorCode) return errorMessages[GenericError];
  return errorMessages[errorCode] || errorMessages[GenericError];
}