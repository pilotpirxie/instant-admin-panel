import {describe, it} from "node:test";
import assert from 'node:assert';
import {getErrorMessage} from "./errorMessages";

describe('getErrorMessage', () => {
  it('should return error message for 500 internal server error', () => {
    const message = getErrorMessage('InternalServerError');
    assert.strictEqual(message.message, 'Internal server error');
    assert.strictEqual(message.status, 500);
  });

  it('should return error message for 400 generic error', () => {
    const message = getErrorMessage('GenericError');
    assert.strictEqual(message.message, 'Something went wrong, try again later');
    assert.strictEqual(message.status, 500);
  });

  it('should return error message for 400 validation error', () => {
    const message = getErrorMessage('ValidationError');
    assert.strictEqual(message.message, 'Invalid data, check your data and try again');
    assert.strictEqual(message.status, 400);
  });

  it('should return error message for 401 invalid credentials', () => {
    const message = getErrorMessage('InvalidCredentials');
    assert.strictEqual(message.message, 'Invalid credentials, check your data and try again');
    assert.strictEqual(message.status, 401);
  });
});