import {describe, it} from "node:test";
import assert from 'node:assert';
import {generateCode} from "./generateCode";

describe('generateCode', () => {
  it('should return 6 digits code by default', () => {
    const code = generateCode();
    assert.strictEqual(code.length, 6);
    assert.ok(/^\d+$/.test(code));
  });

  it('should return 4 digits code', () => {
    const code = generateCode(4);
    assert.strictEqual(code.length, 4);
    assert.ok(/^\d+$/.test(code));
  });

  it('should return 8 digits code', () => {
    const code = generateCode(8);
    assert.strictEqual(code.length, 8);
    assert.ok(/^\d+$/.test(code));
  });

  it('should return 500 digits code', () => {
    const code = generateCode(500);
    assert.strictEqual(code.length, 500);
    assert.ok(/^\d+$/.test(code));
  });

  it('should return 1 digit code', () => {
    const code = generateCode(1);
    assert.strictEqual(code.length, 1);
    assert.ok(/^\d+$/.test(code));
  });
});