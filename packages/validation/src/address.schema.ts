import { z } from 'zod';
import { phoneRegex, pincodeRegex } from './auth.schema.js';

export const addressSchema = z.object({
  fullName: z.string().min(2, 'Name is required').max(60),
  phone: z.string().regex(phoneRegex, 'Valid 10-digit phone number is required'),
  houseFlat: z.string().min(1, 'House/Flat number is required').max(100),
  streetArea: z.string().min(3, 'Street/Area is required').max(150),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2, 'City is required').max(50),
  state: z.string().min(2, 'State is required').max(50),
  pincode: z.string().regex(pincodeRegex, 'Enter a valid 6-digit Indian PIN code'),
  label: z.enum(['home', 'work', 'other']),
  isDefault: z.boolean().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
