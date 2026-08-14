/// <reference types="jest" />
import { formatWithdrawalPinError } from './pinError';

describe('formatWithdrawalPinError', () => {
  it('shows attempts left', () => {
    expect(formatWithdrawalPinError({ attempts_left: 3, error: 'Incorrect withdrawal PIN' })).toBe(
      'Incorrect PIN. 3 attempts left.'
    );
    expect(formatWithdrawalPinError({ attempts_left: 1 })).toBe('Incorrect PIN. 1 attempt left.');
  });

  it('shows lock message when locked', () => {
    expect(
      formatWithdrawalPinError({
        pin_locked: true,
        locked_until: '2099-01-15T12:00:00.000Z',
      })
    ).toMatch(/PIN locked until/);
  });

  it('treats zero attempts as locked', () => {
    expect(formatWithdrawalPinError({ attempts_left: 0 })).toBe(
      'Incorrect PIN. No attempts left. PIN is locked for 15 minutes.'
    );
  });
});
