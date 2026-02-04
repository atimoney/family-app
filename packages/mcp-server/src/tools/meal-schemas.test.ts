import { describe, it, expect } from 'vitest';
import {
  mealTypeSchema,
  localDateSchema,
  mealItemFieldsSchema,
  mealConstraintsSchema,
  mealsGeneratePlanInputSchema,
  mealPlanDraftItemSchema,
  shoppingDeltaItemSchema,
  mealsGeneratePlanOutputSchema,
  mealsSavePlanInputSchema,
  mealsSavePlanOutputSchema,
  mealsGetPlanInputSchema,
  mealsGetPlanOutputSchema,
} from './meal-schemas.js';

describe('meal-schemas', () => {
  describe('mealTypeSchema', () => {
    it('should accept valid meal types', () => {
      expect(mealTypeSchema.safeParse('breakfast').success).toBe(true);
      expect(mealTypeSchema.safeParse('lunch').success).toBe(true);
      expect(mealTypeSchema.safeParse('dinner').success).toBe(true);
      expect(mealTypeSchema.safeParse('snack').success).toBe(true);
    });

    it('should reject invalid meal types', () => {
      expect(mealTypeSchema.safeParse('brunch').success).toBe(false);
      expect(mealTypeSchema.safeParse('supper').success).toBe(false);
      expect(mealTypeSchema.safeParse('').success).toBe(false);
    });
  });

  describe('localDateSchema', () => {
    it('should accept valid YYYY-MM-DD dates', () => {
      expect(localDateSchema.safeParse('2026-02-09').success).toBe(true);
      expect(localDateSchema.safeParse('2026-12-31').success).toBe(true);
      expect(localDateSchema.safeParse('2025-01-01').success).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(localDateSchema.safeParse('02-09-2026').success).toBe(false);
      expect(localDateSchema.safeParse('2026/02/09').success).toBe(false);
      expect(localDateSchema.safeParse('2026-2-9').success).toBe(false);
      expect(localDateSchema.safeParse('2026-02-09T10:00:00Z').success).toBe(false);
    });
  });

  describe('mealItemFieldsSchema', () => {
    it('should accept minimal valid fields', () => {
      const result = mealItemFieldsSchema.safeParse({
        date: '2026-02-09',
        mealType: 'dinner',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full fields', () => {
      const result = mealItemFieldsSchema.safeParse({
        date: '2026-02-09',
        mealType: 'dinner',
        servings: 4,
        notes: 'Test notes',
        recipeRef: 'https://example.com/recipe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      expect(mealItemFieldsSchema.safeParse({ date: '2026-02-09' }).success).toBe(false);
      expect(mealItemFieldsSchema.safeParse({ mealType: 'dinner' }).success).toBe(false);
      expect(mealItemFieldsSchema.safeParse({}).success).toBe(false);
    });

    it('should enforce servings constraints', () => {
      expect(
        mealItemFieldsSchema.safeParse({
          date: '2026-02-09',
          mealType: 'dinner',
          servings: 0,
        }).success
      ).toBe(false);
      expect(
        mealItemFieldsSchema.safeParse({
          date: '2026-02-09',
          mealType: 'dinner',
          servings: 51,
        }).success
      ).toBe(false);
    });
  });

  describe('mealConstraintsSchema', () => {
    it('should accept empty constraints', () => {
      const result = mealConstraintsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept undefined constraints', () => {
      const result = mealConstraintsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should accept full constraints', () => {
      const result = mealConstraintsSchema.safeParse({
        lowCarb: true,
        kidFriendly: true,
        vegetarian: true,
        allergies: ['gluten', 'dairy'],
        maxTotalTime: 45,
      });
      expect(result.success).toBe(true);
    });

    it('should enforce maxTotalTime constraints', () => {
      expect(
        mealConstraintsSchema.safeParse({ maxTotalTime: 5 }).success
      ).toBe(false); // min 10
      expect(
        mealConstraintsSchema.safeParse({ maxTotalTime: 301 }).success
      ).toBe(false); // max 300
    });
  });

  describe('mealsGeneratePlanInputSchema', () => {
    it('should accept minimal valid input', () => {
      const result = mealsGeneratePlanInputSchema.safeParse({
        weekStartDate: '2026-02-09',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full input', () => {
      const result = mealsGeneratePlanInputSchema.safeParse({
        weekStartDate: '2026-02-09',
        constraints: {
          lowCarb: true,
          kidFriendly: true,
        },
        preferences: { cuisine: 'italian' },
        scheduleHints: [
          {
            startAt: '2026-02-09T18:00:00Z',
            endAt: '2026-02-09T20:00:00Z',
            title: 'Soccer practice',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require weekStartDate', () => {
      const result = mealsGeneratePlanInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('mealPlanDraftItemSchema', () => {
    it('should accept valid draft item', () => {
      const result = mealPlanDraftItemSchema.safeParse({
        date: '2026-02-09',
        mealType: 'dinner',
        title: 'Spaghetti Bolognese',
      });
      expect(result.success).toBe(true);
    });

    it('should accept draft item with optional fields', () => {
      const result = mealPlanDraftItemSchema.safeParse({
        date: '2026-02-09',
        mealType: 'dinner',
        title: 'Spaghetti Bolognese',
        servings: 4,
        notes: 'Family favorite',
        recipeRef: 'https://example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should require title', () => {
      const result = mealPlanDraftItemSchema.safeParse({
        date: '2026-02-09',
        mealType: 'dinner',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('shoppingDeltaItemSchema', () => {
    it('should accept minimal item', () => {
      const result = shoppingDeltaItemSchema.safeParse({
        name: 'Eggs',
      });
      expect(result.success).toBe(true);
    });

    it('should accept full item', () => {
      const result = shoppingDeltaItemSchema.safeParse({
        name: 'Eggs',
        qty: '1',
        unit: 'dozen',
        category: 'dairy',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('mealsSavePlanInputSchema', () => {
    it('should accept valid input', () => {
      const result = mealsSavePlanInputSchema.safeParse({
        weekStartDate: '2026-02-09',
        items: [
          {
            date: '2026-02-09',
            mealType: 'dinner',
            title: 'Spaghetti',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept input with listId', () => {
      const result = mealsSavePlanInputSchema.safeParse({
        listId: 'list-123',
        weekStartDate: '2026-02-09',
        items: [
          {
            date: '2026-02-09',
            mealType: 'dinner',
            title: 'Spaghetti',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should require at least one item', () => {
      const result = mealsSavePlanInputSchema.safeParse({
        weekStartDate: '2026-02-09',
        items: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('mealsGetPlanInputSchema', () => {
    it('should accept empty input', () => {
      const result = mealsGetPlanInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept listId', () => {
      const result = mealsGetPlanInputSchema.safeParse({
        listId: 'list-123',
      });
      expect(result.success).toBe(true);
    });

    it('should accept weekStartDate', () => {
      const result = mealsGetPlanInputSchema.safeParse({
        weekStartDate: '2026-02-09',
      });
      expect(result.success).toBe(true);
    });
  });
});
