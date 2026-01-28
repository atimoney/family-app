# E2 - Family Member Assignments Test Checklist

This checklist documents manual test scenarios for the E2 feature: assigning family members to calendar events.

## Prerequisites

- [ ] Family app running locally (`pnpm dev` in both api and web)
- [ ] User logged in with Google OAuth
- [ ] At least one family created with 2+ members
- [ ] At least one Google Calendar connected

---

## Test Scenarios

### 1. Create Event with Family Assignments

**Steps:**
1. Open the calendar view
2. Click to create a new event
3. Fill in title, date/time
4. Scroll to "Family" section
5. Select a Primary member from the dropdown
6. Select 1-2 Participants from the multi-select
7. Save the event

**Expected Results:**
- [ ] Event saves successfully
- [ ] Event appears on calendar
- [ ] Re-opening event shows Primary member selected
- [ ] Re-opening event shows Participants selected

---

### 2. Create Event without Family Assignments

**Steps:**
1. Create a new event
2. Leave Family section empty
3. Save the event

**Expected Results:**
- [ ] Event saves successfully (no regression)
- [ ] Event opens without errors
- [ ] Family section shows empty dropdowns

---

### 3. Update Existing Event to Add Assignments

**Steps:**
1. Click an existing event (without assignments)
2. Add a Primary member
3. Add Participants
4. Save changes

**Expected Results:**
- [ ] Event updates successfully
- [ ] Re-opening shows new assignments
- [ ] Google Calendar extended properties updated (check in Google Calendar API explorer)

---

### 4. Update Event to Remove Assignments

**Steps:**
1. Open an event with assignments
2. Clear Primary member
3. Clear Participants
4. Save changes

**Expected Results:**
- [ ] Event updates successfully
- [ ] Re-opening shows empty Family section
- [ ] Existing event data not corrupted

---

### 5. Sync Round-Trip (Google Calendar)

**Steps:**
1. Create event with family assignments in our app
2. Manually trigger sync or wait for auto-sync
3. Edit the event title in Google Calendar directly
4. Trigger sync again

**Expected Results:**
- [ ] Title change syncs from Google
- [ ] Family assignments preserved (stored in extendedProperties.private)
- [ ] No data loss on round-trip

---

### 6. No Family Members Scenario

**Steps:**
1. Log out, create new user with no family/members
2. Open calendar, create event

**Expected Results:**
- [ ] Calendar form works without Family section visible
- [ ] No errors in console
- [ ] Event saves normally

---

### 7. Family Members Dropdown Display

**Steps:**
1. Verify family members dropdown population
2. Check member display with avatar, name, role

**Expected Results:**
- [ ] All family members appear in dropdown
- [ ] Avatar renders (or initials if no avatar)
- [ ] Name and role are visible
- [ ] Selected chips show member info correctly

---

## API Validation

### POST /v1/calendar/events

```bash
# Create event with family assignments
curl -X POST http://localhost:3000/v1/calendar/events \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Event",
    "start": "2025-01-15T10:00:00Z",
    "end": "2025-01-15T11:00:00Z",
    "calendarId": "<calendar-id>",
    "extraData": {
      "familyAssignments": {
        "primaryFamilyMemberId": "<member-uuid>",
        "participantFamilyMemberIds": ["<member-uuid-1>", "<member-uuid-2>"]
      }
    }
  }'
```

**Expected:** Event created, check extendedProperties.private in Google Calendar

### GET /events/:id

**Expected:** Response includes `metadata.familyAssignments` with the stored data

### PATCH /v1/calendar/events/:id

**Expected:** Family assignments can be updated, merged with existing extended properties

---

## Edge Cases

- [ ] Very long member names display correctly
- [ ] Members with no avatar show initials
- [ ] Selecting same member as primary and participant is allowed (UI doesn't prevent)
- [ ] Events created before E2 open without errors
- [ ] Deleting a family member doesn't break existing events (IDs stored, lookup fails gracefully)

---

## Sign-Off

| Tester | Date | Pass/Fail | Notes |
|--------|------|-----------|-------|
|        |      |           |       |
