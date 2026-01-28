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
  | 'Meal'
  | 'School'
  | 'Sport'
  | 'Activity'
  | 'Chore'
  | 'Appointment'
  | 'Work'
  | 'Travel'
  | 'Home'
  | 'Admin';

/** E1: Event audience enum */
export type EventAudience = 'family' | 'adults' | 'kids';

/** E1: Meal category metadata */
export type MealMetadata = {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | null;
  kidFriendly?: boolean;
  recipeRef?: string | null;
};

/** E1: School category metadata */
export type SchoolMetadata = {
  schoolName?: string | null;
};

/** E1: Sport category metadata */
export type SportMetadata = {
  sportName?: string | null;
  teamName?: string | null;
  homeAway?: 'home' | 'away' | null;
  arrivalBufferMins?: number | null;
};

/** E1: Chore category metadata */
export type ChoreMetadata = {
  rewardPoints?: number | null;
  completionRequired?: boolean;
};

/** E1: Appointment category metadata */
export type AppointmentMetadata = {
  appointmentType?: string | null;
  providerName?: string | null;
  transportRequired?: boolean;
};

/** E1: Travel category metadata */
export type TravelMetadata = {
  tripName?: string | null;
  mode?: 'flight' | 'car' | 'train' | 'other' | null;
  bookingRef?: string | null;
};

/** E1: Home category metadata */
export type HomeMetadata = {
  tradeType?: string | null;
  contractorName?: string | null;
  urgency?: 'low' | 'med' | 'high' | null;
};

/** E1: Admin category metadata */
export type AdminMetadata = {
  status?: 'pending' | 'done' | null;
  dueDate?: string | null;
  referenceLink?: string | null;
};

/** E1: Union type for all category-specific metadata */
export type CategoryMetadata =
  | MealMetadata
  | SchoolMetadata
  | SportMetadata
  | ChoreMetadata
  | AppointmentMetadata
  | TravelMetadata
  | HomeMetadata
  | AdminMetadata
  | Record<string, unknown>;

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
  /** For Meal category: who is cooking */
  cookMemberId?: string | null;
  /** For Chore category: who is assigned to do it */
  assignedToMemberId?: string | null;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  purchased: boolean;
};
