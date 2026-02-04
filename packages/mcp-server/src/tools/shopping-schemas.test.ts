import { describe, it, expect } from 'vitest';
import {
  shoppingCategorySchema,
  shoppingItemFieldsSchema,
  shoppingItemOutputSchema,
  shoppingItemInputSchema,
  shoppingAddItemsInputSchema,
  shoppingAddItemsOutputSchema,
  shoppingGetPrimaryListInputSchema,
  shoppingGetPrimaryListOutputSchema,
  shoppingGetItemsInputSchema,
  shoppingGetItemsOutputSchema,
  shoppingCheckItemsInputSchema,
  shoppingCheckItemsOutputSchema,
} from './shopping-schemas.js';

describe('shopping-schemas', () => {
  describe('shoppingCategorySchema', () => {
    it('should accept valid categories', () => {
      const categories = [
        'produce',
        'dairy',
        'meat',
        'seafood',
        'bakery',
        'frozen',
        'pantry',
        'beverages',
        'snacks',
        'household',
        'personal',
        'other',
      ];
      for (const cat of categories) {
        expect(shoppingCategorySchema.safeParse(cat).success).toBe(true);
      }
    });

    it('should reject invalid categories', () => {
      expect(shoppingCategorySchema.safeParse('invalid').success).toBe(false);
      expect(shoppingCategorySchema.safeParse('').success).toBe(false);
    });
  });

  describe('shoppingItemFieldsSchema', () => {
    it('should accept empty fields', () => {
      const result = shoppingItemFieldsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept full fields', () => {
      const result = shoppingItemFieldsSchema.safeParse({
        qty: '2',
        unit: 'lbs',
        category: 'produce',
        source: 'meal_plan',
        sourceItemId: 'item-123',
      });
      expect(result.success).toBe(true);
    });

    it('should enforce field length constraints', () => {
      const result = shoppingItemFieldsSchema.safeParse({
        qty: 'a'.repeat(51), // max 50
      });
      expect(result.success).toBe(false);

      const result2 = shoppingItemFieldsSchema.safeParse({
        unit: 'a'.repeat(31), // max 30
      });
      expect(result2.success).toBe(false);
    });
  });

  describe('shoppingItemInputSchema', () => {
    it('should require name', () => {
      const result = shoppingItemInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should accept minimal input', () => {
      const result = shoppingItemInputSchema.safeParse({
        name: 'Eggs',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full input', () => {
      const result = shoppingItemInputSchema.safeParse({
        name: 'Eggs',
        qty: '1',
        unit: 'dozen',
        category: 'dairy',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = shoppingItemInputSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name over 200 chars', () => {
      const result = shoppingItemInputSchema.safeParse({
        name: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('shoppingAddItemsInputSchema', () => {
    it('should require at least one item', () => {
      const result = shoppingAddItemsInputSchema.safeParse({
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid items', () => {
      const result = shoppingAddItemsInputSchema.safeParse({
        items: [
          { name: 'Eggs' },
          { name: 'Milk', qty: '2', unit: 'L' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional listId', () => {
      const result = shoppingAddItemsInputSchema.safeParse({
        listId: 'list-123',
        items: [{ name: 'Eggs' }],
      });
      expect(result.success).toBe(true);
    });

    it('should enforce max 100 items', () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        name: `Item ${i}`,
      }));
      const result = shoppingAddItemsInputSchema.safeParse({ items });
      expect(result.success).toBe(false);
    });
  });

  describe('shoppingGetPrimaryListInputSchema', () => {
    it('should accept empty input', () => {
      const result = shoppingGetPrimaryListInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept familyId', () => {
      const result = shoppingGetPrimaryListInputSchema.safeParse({
        familyId: 'family-123',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shoppingGetItemsInputSchema', () => {
    it('should accept empty input with defaults', () => {
      const result = shoppingGetItemsInputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should accept all filters', () => {
      const result = shoppingGetItemsInputSchema.safeParse({
        listId: 'list-123',
        checked: false,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });

    it('should enforce limit constraints', () => {
      expect(shoppingGetItemsInputSchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(shoppingGetItemsInputSchema.safeParse({ limit: 501 }).success).toBe(false);
      expect(shoppingGetItemsInputSchema.safeParse({ limit: 500 }).success).toBe(true);
    });
  });

  describe('shoppingCheckItemsInputSchema', () => {
    it('should require itemIds', () => {
      const result = shoppingCheckItemsInputSchema.safeParse({
        checked: true,
      });
      expect(result.success).toBe(false);
    });

    it('should require at least one itemId', () => {
      const result = shoppingCheckItemsInputSchema.safeParse({
        itemIds: [],
        checked: true,
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid input', () => {
      const result = shoppingCheckItemsInputSchema.safeParse({
        itemIds: ['item-1', 'item-2'],
        checked: true,
      });
      expect(result.success).toBe(true);
    });

    it('should default checked to true', () => {
      const result = shoppingCheckItemsInputSchema.safeParse({
        itemIds: ['item-1'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.checked).toBe(true);
      }
    });

    it('should enforce max 100 items', () => {
      const itemIds = Array.from({ length: 101 }, (_, i) => `item-${i}`);
      const result = shoppingCheckItemsInputSchema.safeParse({
        itemIds,
        checked: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('shoppingItemOutputSchema', () => {
    it('should accept valid output', () => {
      const result = shoppingItemOutputSchema.safeParse({
        id: 'item-123',
        name: 'Eggs',
        qty: '1',
        unit: 'dozen',
        category: 'dairy',
        checked: false,
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimal output', () => {
      const result = shoppingItemOutputSchema.safeParse({
        id: 'item-123',
        name: 'Eggs',
        checked: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shoppingAddItemsOutputSchema', () => {
    it('should accept valid output', () => {
      const result = shoppingAddItemsOutputSchema.safeParse({
        addedCount: 2,
        items: [
          { id: '1', name: 'Eggs', checked: false },
          { id: '2', name: 'Milk', qty: '2', unit: 'L', checked: false },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shoppingGetPrimaryListOutputSchema', () => {
    it('should accept list present', () => {
      const result = shoppingGetPrimaryListOutputSchema.safeParse({
        list: { id: 'list-123', name: 'Shopping List' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept null list', () => {
      const result = shoppingGetPrimaryListOutputSchema.safeParse({
        list: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shoppingGetItemsOutputSchema', () => {
    it('should accept valid output', () => {
      const result = shoppingGetItemsOutputSchema.safeParse({
        list: { id: 'list-123', name: 'Shopping List' },
        items: [
          { id: '1', name: 'Eggs', checked: false },
        ],
        total: 1,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('shoppingCheckItemsOutputSchema', () => {
    it('should accept valid output', () => {
      const result = shoppingCheckItemsOutputSchema.safeParse({
        updatedCount: 3,
      });
      expect(result.success).toBe(true);
    });
  });
});
