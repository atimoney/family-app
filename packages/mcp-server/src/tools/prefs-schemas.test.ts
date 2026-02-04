import { describe, it, expect } from 'vitest';
import {
  prefScopeSchema,
  prefsGetInputSchema,
  prefsGetOutputSchema,
  prefsSetInputSchema,
  prefsSetOutputSchema,
  prefsDeleteInputSchema,
  prefsDeleteOutputSchema,
  prefsListInputSchema,
  prefsListOutputSchema,
  prefsGetBulkInputSchema,
  prefsGetBulkOutputSchema,
  prefItemSchema,
  PREF_KEYS,
} from './prefs-schemas.js';

describe('prefs-schemas', () => {
  // ==================================================================
  // SCOPE SCHEMA
  // ==================================================================

  describe('prefScopeSchema', () => {
    it('should accept "family" scope', () => {
      expect(prefScopeSchema.parse('family')).toBe('family');
    });

    it('should accept "person" scope', () => {
      expect(prefScopeSchema.parse('person')).toBe('person');
    });

    it('should reject invalid scope', () => {
      expect(() => prefScopeSchema.parse('global')).toThrow();
      expect(() => prefScopeSchema.parse('')).toThrow();
    });
  });

  // ==================================================================
  // PREFS.GET SCHEMAS
  // ==================================================================

  describe('prefsGetInputSchema', () => {
    it('should accept valid family scope input', () => {
      const input = {
        scope: 'family',
        key: 'meals.allergies',
      };
      expect(() => prefsGetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept valid person scope input with userId', () => {
      const input = {
        scope: 'person',
        key: 'meals.personalAllergies',
        userId: 'user-123',
      };
      expect(() => prefsGetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept person scope without userId (defaults to self)', () => {
      const input = {
        scope: 'person',
        key: 'general.timezone',
      };
      expect(() => prefsGetInputSchema.parse(input)).not.toThrow();
    });

    it('should reject empty key', () => {
      const input = {
        scope: 'family',
        key: '',
      };
      expect(() => prefsGetInputSchema.parse(input)).toThrow();
    });

    it('should reject key over 100 characters', () => {
      const input = {
        scope: 'family',
        key: 'a'.repeat(101),
      };
      expect(() => prefsGetInputSchema.parse(input)).toThrow();
    });
  });

  describe('prefsGetOutputSchema', () => {
    it('should accept valid output with value', () => {
      const output = {
        key: 'meals.allergies',
        valueJson: ['gluten', 'nuts'],
        exists: true,
        updatedAt: '2026-02-05T10:00:00.000Z',
        updatedByUserId: 'user-123',
      };
      expect(() => prefsGetOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept output for non-existent preference', () => {
      const output = {
        key: 'meals.allergies',
        valueJson: null,
        exists: false,
        updatedAt: null,
        updatedByUserId: null,
      };
      expect(() => prefsGetOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept various value types', () => {
      const testCases = [
        { valueJson: 'string value', exists: true },
        { valueJson: 42, exists: true },
        { valueJson: true, exists: true },
        { valueJson: { nested: 'object' }, exists: true },
        { valueJson: [1, 2, 3], exists: true },
      ];

      for (const { valueJson, exists } of testCases) {
        const output = {
          key: 'test.key',
          valueJson,
          exists,
          updatedAt: '2026-02-05T10:00:00.000Z',
          updatedByUserId: 'user-123',
        };
        expect(() => prefsGetOutputSchema.parse(output)).not.toThrow();
      }
    });
  });

  // ==================================================================
  // PREFS.SET SCHEMAS
  // ==================================================================

  describe('prefsSetInputSchema', () => {
    it('should accept valid family scope input', () => {
      const input = {
        scope: 'family',
        key: 'meals.defaultServings',
        valueJson: 4,
      };
      expect(() => prefsSetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept valid person scope input', () => {
      const input = {
        scope: 'person',
        key: 'general.timezone',
        userId: 'user-123',
        valueJson: 'Australia/Sydney',
      };
      expect(() => prefsSetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept complex JSON values', () => {
      const input = {
        scope: 'family',
        key: 'meals.preferences',
        valueJson: {
          cuisines: ['italian', 'mexican'],
          maxPrepTime: 30,
          organic: true,
        },
      };
      expect(() => prefsSetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept array values', () => {
      const input = {
        scope: 'family',
        key: 'meals.allergies',
        valueJson: ['gluten', 'dairy', 'nuts'],
      };
      expect(() => prefsSetInputSchema.parse(input)).not.toThrow();
    });

    it('should accept null value', () => {
      const input = {
        scope: 'family',
        key: 'meals.allergies',
        valueJson: null,
      };
      expect(() => prefsSetInputSchema.parse(input)).not.toThrow();
    });
  });

  describe('prefsSetOutputSchema', () => {
    it('should accept successful create output', () => {
      const output = {
        ok: true,
        key: 'meals.allergies',
        created: true,
      };
      expect(() => prefsSetOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept successful update output', () => {
      const output = {
        ok: true,
        key: 'meals.allergies',
        created: false,
      };
      expect(() => prefsSetOutputSchema.parse(output)).not.toThrow();
    });
  });

  // ==================================================================
  // PREFS.DELETE SCHEMAS
  // ==================================================================

  describe('prefsDeleteInputSchema', () => {
    it('should accept valid family scope input', () => {
      const input = {
        scope: 'family',
        key: 'meals.allergies',
      };
      expect(() => prefsDeleteInputSchema.parse(input)).not.toThrow();
    });

    it('should accept valid person scope input', () => {
      const input = {
        scope: 'person',
        key: 'general.timezone',
        userId: 'user-123',
      };
      expect(() => prefsDeleteInputSchema.parse(input)).not.toThrow();
    });
  });

  describe('prefsDeleteOutputSchema', () => {
    it('should accept output when preference existed', () => {
      const output = {
        ok: true,
        existed: true,
      };
      expect(() => prefsDeleteOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept output when preference did not exist', () => {
      const output = {
        ok: true,
        existed: false,
      };
      expect(() => prefsDeleteOutputSchema.parse(output)).not.toThrow();
    });
  });

  // ==================================================================
  // PREFS.LIST SCHEMAS
  // ==================================================================

  describe('prefsListInputSchema', () => {
    it('should accept minimal input', () => {
      const input = {
        scope: 'family',
      };
      expect(() => prefsListInputSchema.parse(input)).not.toThrow();
    });

    it('should accept input with keyPrefix', () => {
      const input = {
        scope: 'family',
        keyPrefix: 'meals.',
      };
      expect(() => prefsListInputSchema.parse(input)).not.toThrow();
    });

    it('should accept person scope with userId', () => {
      const input = {
        scope: 'person',
        userId: 'user-123',
        keyPrefix: 'calendar.',
      };
      expect(() => prefsListInputSchema.parse(input)).not.toThrow();
    });
  });

  describe('prefItemSchema', () => {
    it('should accept valid preference item', () => {
      const item = {
        key: 'meals.allergies',
        valueJson: ['gluten'],
        updatedAt: '2026-02-05T10:00:00.000Z',
        updatedByUserId: 'user-123',
      };
      expect(() => prefItemSchema.parse(item)).not.toThrow();
    });
  });

  describe('prefsListOutputSchema', () => {
    it('should accept empty list', () => {
      const output = {
        preferences: [],
        count: 0,
      };
      expect(() => prefsListOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept list with multiple preferences', () => {
      const output = {
        preferences: [
          {
            key: 'meals.allergies',
            valueJson: ['gluten'],
            updatedAt: '2026-02-05T10:00:00.000Z',
            updatedByUserId: 'user-123',
          },
          {
            key: 'meals.defaultServings',
            valueJson: 4,
            updatedAt: '2026-02-04T10:00:00.000Z',
            updatedByUserId: 'user-456',
          },
        ],
        count: 2,
      };
      expect(() => prefsListOutputSchema.parse(output)).not.toThrow();
    });
  });

  // ==================================================================
  // PREFS.GETBULK SCHEMAS
  // ==================================================================

  describe('prefsGetBulkInputSchema', () => {
    it('should accept single request', () => {
      const input = {
        requests: [
          { scope: 'family', key: 'meals.allergies' },
        ],
      };
      expect(() => prefsGetBulkInputSchema.parse(input)).not.toThrow();
    });

    it('should accept multiple mixed requests', () => {
      const input = {
        requests: [
          { scope: 'family', key: 'meals.allergies' },
          { scope: 'family', key: 'meals.defaultServings' },
          { scope: 'person', key: 'general.timezone', userId: 'user-123' },
        ],
      };
      expect(() => prefsGetBulkInputSchema.parse(input)).not.toThrow();
    });

    it('should accept empty requests array', () => {
      const input = {
        requests: [],
      };
      expect(() => prefsGetBulkInputSchema.parse(input)).not.toThrow();
    });
  });

  describe('prefsGetBulkOutputSchema', () => {
    it('should accept results with mixed values and nulls', () => {
      const output = {
        results: {
          'meals.allergies': ['gluten', 'nuts'],
          'meals.defaultServings': 4,
          'tasks.defaultAssignee': null,
          'calendar.defaultDuration': 60,
        },
      };
      expect(() => prefsGetBulkOutputSchema.parse(output)).not.toThrow();
    });

    it('should accept empty results', () => {
      const output = {
        results: {},
      };
      expect(() => prefsGetBulkOutputSchema.parse(output)).not.toThrow();
    });
  });

  // ==================================================================
  // PREF_KEYS CONSTANTS
  // ==================================================================

  describe('PREF_KEYS', () => {
    it('should have meals domain keys', () => {
      expect(PREF_KEYS.MEALS.ALLERGIES).toBe('meals.allergies');
      expect(PREF_KEYS.MEALS.DEFAULT_SERVINGS).toBe('meals.defaultServings');
      expect(PREF_KEYS.MEALS.KID_FRIENDLY_DEFAULT).toBe('meals.kidFriendlyDefault');
      expect(PREF_KEYS.MEALS.WEEK_STARTS_MONDAY).toBe('meals.weekStartsMonday');
    });

    it('should have tasks domain keys', () => {
      expect(PREF_KEYS.TASKS.DEFAULT_ASSIGNEE).toBe('tasks.defaultAssignee');
      expect(PREF_KEYS.TASKS.DEFAULT_DUE_TIME).toBe('tasks.defaultDueTime');
      expect(PREF_KEYS.TASKS.DEFAULT_PRIORITY).toBe('tasks.defaultPriority');
    });

    it('should have calendar domain keys', () => {
      expect(PREF_KEYS.CALENDAR.DEFAULT_DURATION).toBe('calendar.defaultDuration');
      expect(PREF_KEYS.CALENDAR.PREFERRED_TIMEZONE).toBe('calendar.preferredTimezone');
    });

    it('should have general domain keys', () => {
      expect(PREF_KEYS.GENERAL.TIMEZONE).toBe('general.timezone');
      expect(PREF_KEYS.GENERAL.LANGUAGE).toBe('general.language');
    });
  });
});
