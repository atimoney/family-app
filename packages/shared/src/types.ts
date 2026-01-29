// ============================================================================
// FAMILY & PROFILES
// ============================================================================

/** Role within a family - determines permissions */
export type FamilyRole = 'owner' | 'admin' | 'member';

/** Invite status lifecycle */
export type FamilyInviteStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

/** User profile - keyed by Supabase auth.users.id */
export type Profile = {
  id: string; // UUID from Supabase
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A family unit that members belong to */
export type Family = {
  id: string; // CUID
  name: string;
  createdBy: string; // Profile ID
  createdAt: string;
  updatedAt: string;
};

/** A member within a family - has family-specific display name and color */
export type FamilyMember = {
  id: string; // CUID - stable ID for future references (events, chores)
  familyId: string;
  profileId: string;
  role: FamilyRole;
  displayName: string | null; // Override for family context (e.g., "Dad")
  color: string | null; // For calendar/UI color coding
  joinedAt: string;
  removedAt: string | null;
  removedBy: string | null;
  // Populated from profile for convenience
  profile?: Profile;
};

/** An invitation to join a family */
export type FamilyInvite = {
  id: string; // CUID
  familyId: string;
  email: string | null; // If set, only this email can accept
  role: Exclude<FamilyRole, 'owner'>; // Can't invite as owner
  token: string;
  invitedBy: string; // Profile ID
  status: FamilyInviteStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  // Populated for display
  inviterProfile?: Profile;
  family?: Family;
};

/** Family with members populated - returned by GET /api/family */
export type FamilyWithMembers = Family & {
  members: FamilyMember[];
  myMembership: FamilyMember;
};

/** Invite validation response - returned by GET /api/invites/:token/validate */
export type InviteValidation = {
  valid: boolean;
  reason?: 'not_found' | 'expired' | 'already_used' | 'revoked' | 'email_mismatch' | 'already_member' | 'already_in_family';
  familyName?: string;
  inviterName?: string;
  role?: Exclude<FamilyRole, 'owner'>;
  email?: string | null;
};

// ============================================================================
// LEGACY FAMILY MEMBER TYPE (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use FamilyMember instead. This type is kept for backward compatibility
 * with existing UI components that use the old mock data format.
 */
export type LegacyFamilyMember = {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
};

// ============================================================================
// TASKS
// ============================================================================

export type TaskStatus = 'todo' | 'doing' | 'done';

export type Task = {
  id: string;
  title: string;
  assigneeId?: string;
  dueDate?: string;
  status?: TaskStatus;
  completed?: boolean;
  createdAt: string;
};

// Recurrence rule type
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g., every 2 weeks
  count?: number; // number of occurrences
  until?: string; // end date ISO string
  byDay?: string[]; // e.g., ['MO', 'WE', 'FR'] for weekly
  byMonthDay?: number[]; // e.g., [1, 15] for monthly on 1st and 15th
  byMonth?: number[]; // e.g., [1, 6] for yearly in Jan and June
};

// Reminder type
export type ReminderMethod = 'email' | 'popup';

export type EventReminder = {
  method: ReminderMethod;
  minutes: number; // minutes before event
};

// ============================================================================
// E1: EVENT METADATA - CATEGORIES, AUDIENCE & CATEGORY-SPECIFIC DATA
// ============================================================================

/** E1: Event category enum */
export type EventCategory =
  | 'School'
  | 'Sport'
  | 'Activity'
  | 'Social'
  | 'Appointment'
  | 'Work'
  | 'Travel'
  | 'Home'
  | 'Admin';

/** E1: Event audience enum */
export type EventAudience = 'family' | 'adults' | 'kids';

/** Category metadata - generic type for user-defined category fields */
export type CategoryMetadata = Record<string, unknown>;

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  calendarId?: string;
  description?: string | null;
  location?: string | null;
  recurrence?: RecurrenceRule | null;
  reminders?: EventReminder[] | null;
  extraData?: CalendarEventExtraDataV1;
};

export type CalendarEventExtraDataV1 = {
  tags: string[];
  category: EventCategory | string | null;
  audience?: EventAudience | null;
  notes: string | null;
  color?: string | null;
  metadata?: CategoryMetadata | null;
  familyAssignments?: EventFamilyAssignments | null;
};

/**
 * E2: Family member assignments for calendar events.
 * All fields are optional to ensure backward compatibility.
 */
export type EventFamilyAssignments = {
  /** Primary family member responsible for this event */
  primaryFamilyMemberId?: string | null;
  /** Family members participating in this event */
  participantFamilyMemberIds?: string[];
  /** Who is cooking (for meal-related events) */
  cookMemberId?: string | null;
  /** Who is assigned to do it */
  assignedToMemberId?: string | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  purchased: boolean;
};

// ============================================================================
// EVENT CATEGORIES (E1)
// ============================================================================

/** Configuration for a custom event category */
export type EventCategoryConfig = {
  id: string;
  familyId: string;
  name: string;
  label: string;
  icon: string;
  color: string | null;
  sortOrder: number;
  isSystem: boolean;
  metadataSchema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Input for creating a new category */
export type CreateCategoryInput = {
  name: string;
  label: string;
  icon: string;
  color?: string | null;
  sortOrder?: number;
  metadataSchema?: Record<string, unknown>;
};

/** Input for updating a category */
export type UpdateCategoryInput = {
  label?: string;
  icon?: string;
  color?: string | null;
  sortOrder?: number;
  metadataSchema?: Record<string, unknown>;
};

