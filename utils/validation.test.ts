/// <reference types="jest" />
import {
  formatPhoneNumber,
  getPhoneDigits,
  getPhoneError,
  validatePhone,
} from './validation';

describe('Nigerian phone numbers', () => {
  it('accepts 11-digit local mobiles', () => {
    expect(validatePhone('08031234567')).toBe(true);
    expect(validatePhone('0803 123 4567')).toBe(true);
    expect(formatPhoneNumber('08031234567')).toBe('0803 123 4567');
  });

  it('does not truncate the 11th digit', () => {
    expect(getPhoneDigits('08031234567')).toBe('08031234567');
    expect(formatPhoneNumber('08031234567').replace(/\D/g, '')).toHaveLength(11);
  });

  it('rejects 10-digit numbers', () => {
    expect(validatePhone('0803123456')).toBe(false);
    expect(getPhoneError('0803123456')).toMatch(/11 digits \(10\/11\)/);
  });

  it('normalizes +234 numbers to local 11 digits', () => {
    expect(getPhoneDigits('+2348031234567')).toBe('08031234567');
    expect(validatePhone('+2348031234567')).toBe(true);
  });
});
