import {describe, it} from "node:test";
import assert from 'node:assert';
import {errorResponse} from "./errorResponse";
import {Response} from "express";

function createMock (expectedStatus: number, expectedJson: {
  message: string;
  errorCode: string;
  details?: unknown;
}) {
  return {
    status: (statusCode: number) => {
      assert.strictEqual(statusCode, expectedStatus);
      return {
        json: (data: any) => {
          assert.strictEqual(data.message, expectedJson.message);
          assert.strictEqual(data.errorCode, expectedJson.errorCode);
          if (expectedJson.details) {
            assert.deepStrictEqual(data.details, expectedJson.details);
          }
        }
      };
    }
  } as Response;
}

describe('errorMessages', () => {
  it('should return error message for 400', () => {
    const res = createMock(500, {
      message: 'Something went wrong, try again later',
      errorCode: 'GenericError',
      details: {}
    });

    errorResponse({
      response: res,
      errorCode: 'GenericError'
    });
  });

  it('should return error message for 500', () => {
    const res = createMock(500, {
      message: 'Internal server error',
      errorCode: 'InternalServerError',
      details: {}
    });

    errorResponse({
      response: res,
      errorCode: 'InternalServerError'
    });
  });

  it('should return error message for 400', () => {
    const res = createMock(400, {
      message: 'Invalid data, check your data and try again',
      errorCode: 'ValidationError',
      details: {}
    });

    errorResponse({
      response: res,
      errorCode: 'ValidationError'
    });
  });

  it('should return error with details', () => {
    const res = createMock(400, {
      message: 'Invalid data, check your data and try again',
      errorCode: 'ValidationError',
      details: { foo: 'bar' }
    });

    errorResponse({
      response: res,
      errorCode: 'ValidationError',
      details: { foo: 'bar' }
    });
  });
});