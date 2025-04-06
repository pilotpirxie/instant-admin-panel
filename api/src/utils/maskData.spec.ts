import { describe, it } from 'node:test';
import assert from 'node:assert';
import { maskEmail } from './maskData';

describe('maskEmail', () => {
  it('should mask regular email', () => {
    const email = 'john@example.com';
    const maskedEmail = maskEmail({ email, char: '*', percent: 0.5 });
    assert.strictEqual(maskedEmail, 'jo**@example.com');
  });

  it('should mask slightly longer email', () => {
    const email = 'john.doe@sl.com';
    const maskedEmail = maskEmail({ email, char: '*', percent: 0.5 });
    assert.strictEqual(maskedEmail, 'john****@sl.com');
  });

  it('should mask super short email', () => {
    const email = 'a@example.com';
    const maskedEmail = maskEmail({ email, char: '*', percent: 0.5 });
    assert.strictEqual(maskedEmail, '*@example.com');
  });

  it('should mask email with super long local part', () => {
    const email = 'thisone.is.littlelongeremail@gmail.com';
    const maskedEmail = maskEmail({ email, char: '*', percent: 0.5 });
    assert.strictEqual(maskedEmail, 'thisone.is.lit**************@gmail.com');
  });
});
