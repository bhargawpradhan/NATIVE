import { z } from 'zod';

// Phone normalization helper
export function normalizePhone(rawPhone: string): string {
  // Strip whitespace, dashes, parentheses
  const cleaned = rawPhone.replace(/[\s\-\(\)]/g, '').trim();
  // Ensure starts with + if international or keep canonical
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  // Default prefix + if 10-12 digits without +
  return `+${cleaned}`;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 5) return '***';
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix} ****** ${suffix}`;
}

export const requestOtpSchema = z.object({
  phone: z.preprocess(
    (val) => (typeof val === 'string' ? val.replace(/[\s\-\(\)]/g, '').trim() : val),
    z
      .string({ required_error: 'Phone number is required' })
      .min(8, 'Phone number must be at least 8 characters')
      .max(20, 'Phone number must be at most 20 characters')
      .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format. Must be a valid national or E.164 number.')
  )
});

export const verifyOtpSchema = z.object({
  phone: z.preprocess(
    (val) => (typeof val === 'string' ? val.replace(/[\s\-\(\)]/g, '').trim() : val),
    z
      .string({ required_error: 'Phone number is required' })
      .min(8, 'Phone number must be at least 8 characters')
      .max(20, 'Phone number must be at most 20 characters')
  ),
  otp: z
    .string({ required_error: 'OTP code is required' })
    .regex(/^\d{6}$/, 'OTP must be exactly 6 numeric digits')
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
