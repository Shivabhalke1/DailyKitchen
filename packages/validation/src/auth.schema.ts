import { z } from 'zod';

export const phoneRegex = /^[6-9]\d{9}$/;
export const otpRegex = /^\d{4}$/;
export const pincodeRegex = /^[1-9]\d{5}$/;

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Phone number or email is required')
    .refine(
      (val) => phoneRegex.test(val) || z.string().email().safeParse(val).success,
      {
        message: 'Enter a valid 10-digit mobile number or email address',
      }
    ),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(60, 'Full name cannot exceed 60 characters')
      .regex(/^[a-zA-Z\s]+$/, 'Full name must contain only letters'),
    phone: z
      .string()
      .regex(phoneRegex, 'Enter a valid 10-digit Indian mobile number (+91)'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(8, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const otpRequestSchema = z.object({
  phone: z
    .string()
    .regex(phoneRegex, 'Enter a valid 10-digit mobile number'),
});

export const otpVerifySchema = z.object({
  phone: z
    .string()
    .regex(phoneRegex, 'Enter a valid 10-digit mobile number'),
  otp: z
    .string()
    .regex(otpRegex, 'OTP must be exactly 4 digits'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OTPRequestInput = z.infer<typeof otpRequestSchema>;
export type OTPVerifyInput = z.infer<typeof otpVerifySchema>;
