import { z } from 'zod';

export const createShoppingItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  quantity: z.string().optional(),
  category: z.string().optional(),
});

export const updateShoppingItemSchema = z.object({
  purchased: z.boolean().optional(),
  quantity: z.string().optional(),
});

export type CreateShoppingItemInput = z.infer<typeof createShoppingItemSchema>;
export type UpdateShoppingItemInput = z.infer<typeof updateShoppingItemSchema>;
