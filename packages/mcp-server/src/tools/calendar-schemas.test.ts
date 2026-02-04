import { describe, it, expect } from 'vitest';
import {
  calendarSearchInputSchema,
  calendarCreateInputSchema,
  calendarUpdateInputSchema,
  calendarEventSchema,
  validateDateRange,
} from './calendar-schemas.js';

describe('calendarSearchInputSchema', () => {
  it('should accept valid search input with all fields', () => {
    const input = {
      query: 'team meeting',
      from: '2026-02-01T00:00:00.000Z',
      to: '2026-02-28T23:59:59.999Z',
      attendeeUserId: 'user-123',
      limit: 50,
    };
    const result = calendarSearchInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty search input', () => {
    const result = calendarSearchInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should apply default limit of 20', () => {
    const result = calendarSearchInputSchema.parse({});
    expect(result.limit).toBe(20);
  });

  it('should reject limit over 100', () => {
    const result = calendarSearchInputSchema.safeParse({ limit: 150 });
    expect(result.success).toBe(false);
  });

  it('should reject query over 200 chars', () => {
    const result = calendarSearchInputSchema.safeParse({ query: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('should reject invalid datetime format for from', () => {
    const result = calendarSearchInputSchema.safeParse({ from: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

describe('calendarCreateInputSchema', () => {
  it('should accept valid create input', () => {
    const input = {
      title: 'Team Meeting',
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
      location: 'Conference Room A',
      notes: 'Weekly standup',
      allDay: false,
      attendeeUserIds: ['user-1', 'user-2'],
    };
    const result = calendarCreateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should require title', () => {
    const result = calendarCreateInputSchema.safeParse({
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should require startAt', () => {
    const result = calendarCreateInputSchema.safeParse({
      title: 'Meeting',
      endAt: '2026-02-10T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should require endAt', () => {
    const result = calendarCreateInputSchema.safeParse({
      title: 'Meeting',
      startAt: '2026-02-10T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty title', () => {
    const result = calendarCreateInputSchema.safeParse({
      title: '',
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should reject title over 500 chars', () => {
    const result = calendarCreateInputSchema.safeParse({
      title: 'a'.repeat(501),
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should apply default allDay to false', () => {
    const result = calendarCreateInputSchema.parse({
      title: 'Meeting',
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
    });
    expect(result.allDay).toBe(false);
  });
});

describe('calendarUpdateInputSchema', () => {
  it('should accept valid update input', () => {
    const input = {
      eventId: 'event-123',
      patch: {
        title: 'Updated Meeting',
        startAt: '2026-02-10T10:00:00.000Z',
      },
    };
    const result = calendarUpdateInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should require eventId', () => {
    const result = calendarUpdateInputSchema.safeParse({
      patch: { title: 'Updated' },
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty patch', () => {
    const result = calendarUpdateInputSchema.safeParse({
      eventId: 'event-123',
      patch: {},
    });
    expect(result.success).toBe(true);
  });

  it('should accept nullable location', () => {
    const result = calendarUpdateInputSchema.safeParse({
      eventId: 'event-123',
      patch: { location: null },
    });
    expect(result.success).toBe(true);
  });
});

describe('calendarEventSchema', () => {
  it('should validate a complete event', () => {
    const event = {
      id: 'event-123',
      familyId: 'family-456',
      title: 'Team Meeting',
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
      location: 'Office',
      notes: 'Weekly sync',
      allDay: false,
      createdByUserId: 'user-789',
      attendees: [
        { userId: 'user-1', displayName: 'Alice', status: 'accepted' },
        { userId: 'user-2', displayName: 'Bob', status: 'pending' },
      ],
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const result = calendarEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('should allow null location and notes', () => {
    const event = {
      id: 'event-123',
      familyId: 'family-456',
      title: 'Team Meeting',
      startAt: '2026-02-10T09:00:00.000Z',
      endAt: '2026-02-10T10:00:00.000Z',
      location: null,
      notes: null,
      allDay: false,
      createdByUserId: 'user-789',
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };
    const result = calendarEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe('validateDateRange', () => {
  it('should return true when endAt is after startAt', () => {
    expect(validateDateRange(
      '2026-02-10T09:00:00.000Z',
      '2026-02-10T10:00:00.000Z'
    )).toBe(true);
  });

  it('should return false when endAt equals startAt', () => {
    expect(validateDateRange(
      '2026-02-10T09:00:00.000Z',
      '2026-02-10T09:00:00.000Z'
    )).toBe(false);
  });

  it('should return false when endAt is before startAt', () => {
    expect(validateDateRange(
      '2026-02-10T10:00:00.000Z',
      '2026-02-10T09:00:00.000Z'
    )).toBe(false);
  });
});
