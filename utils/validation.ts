export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/** Local Nigerian mobiles are 11 digits, e.g. 0803 123 4567. */
const NIGERIAN_MOBILE = /^0(70|80|81|90|91)\d{8}$/;
export const NIGERIAN_PHONE_DIGITS = 11;
export const FORMATTED_PHONE_MAX_LENGTH = 13; // "0803 123 4567"

export function getPhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('2340') && digits.length >= 14) {
    digits = digits.slice(3);
  } else if (digits.startsWith('234') && digits.length >= 13) {
    digits = `0${digits.slice(3)}`;
  }

  return digits.slice(0, NIGERIAN_PHONE_DIGITS);
}

export function validatePhone(phone: string): boolean {
  return NIGERIAN_MOBILE.test(getPhoneDigits(phone));
}

export function getPhoneError(phone: string): string | undefined {
  const digits = getPhoneDigits(phone);
  if (!digits) return 'Phone number is required';
  if (digits.length < NIGERIAN_PHONE_DIGITS) {
    return `Nigerian numbers are 11 digits (${digits.length}/11)`;
  }
  if (!NIGERIAN_MOBILE.test(digits)) {
    return 'Enter a valid Nigerian number, like 0803 123 4567';
  }
  return undefined;
}

export function formatPhoneNumber(phone: string): string {
  const digits = getPhoneDigits(phone);
  if (digits.length === 0) return '';
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export function getPasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('At least 8 characters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z\d]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  let strength: PasswordStrength = 'weak';
  if (score <= 2) strength = 'weak';
  else if (score === 3) strength = 'fair';
  else if (score === 4) strength = 'good';
  else strength = 'strong';

  return { strength, score, feedback };
}
