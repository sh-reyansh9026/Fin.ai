import { z } from 'zod';


// zod is for validation of entries of form 
export const accountSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['CURRENT', 'SAVINGS']),
    balance: z.string().min(1, 'Initial balance is required'),
    isDefault: z.boolean().default(),
});