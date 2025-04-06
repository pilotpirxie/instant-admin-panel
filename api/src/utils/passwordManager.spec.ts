import {describe, it} from "node:test";
import assert from 'node:assert';
import {getHashedPassword} from "./passwordManager";

describe('getHashedPassword', () => {
  it('should return hashed password', async () => {
    const password = 'password';
    const salt = 'salt';
    const iterations = 1000;

    const hashedPassword = getHashedPassword({password, salt, iterations});

    assert.strictEqual(hashedPassword.length, 128);
  });
});