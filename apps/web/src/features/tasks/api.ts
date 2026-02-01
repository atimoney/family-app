import type {
  Task,
  TasksQuery,
  TaskTemplate,
  CreateTaskInput,
  UpdateTaskInput,
  TaskTemplatesQuery,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput,
  CreateTaskFromTemplateInput,
} from './types';

import { getSession } from 'src/lib/supabase';
import { apiClient } from 'src/lib/api-client';

// ----------------------------------------------------------------------

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

// ----------------------------------------------------------------------
// TASKS CRUD
// ----------------------------------------------------------------------

export async function getTasks(query: TasksQuery = {}): Promise<Task[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.status) {
    const statusArr = Array.isArray(query.status) ? query.status : [query.status];
    statusArr.forEach((s) => params.append('status', s));
  }
  if (query.assignedTo) params.set('assignedTo', query.assignedTo);
  if (query.dueBefore) params.set('dueBefore', query.dueBefore);
  if (query.dueAfter) params.set('dueAfter', query.dueAfter);
  if (query.includeCompleted) params.set('includeCompleted', 'true');
  if (query.labels?.length) params.set('labels', query.labels.join(','));
  if (query.search) params.set('search', query.search);

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<Task[]>(`/v1/tasks${suffix}`, { headers });
}

export async function getTask(taskId: string): Promise<Task> {
  const headers = await getAuthHeaders();
  return apiClient.get<Task>(`/v1/tasks/${taskId}`, { headers });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const headers = await getAuthHeaders();
  return apiClient.post<Task>('/v1/tasks', input, { headers });
}

export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<Task> {
  const headers = await getAuthHeaders();
  return apiClient.patch<Task>(`/v1/tasks/${taskId}`, input, { headers });
}

export async function deleteTask(taskId: string): Promise<{ ok: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ ok: boolean }>(`/v1/tasks/${taskId}`, { headers });
}

export async function bulkUpdateTasks(
  updates: Array<{ id: string; status?: string; sortOrder?: number }>
): Promise<{ ok: boolean; updated: number }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ ok: boolean; updated: number }>('/v1/tasks/bulk-update', { updates }, { headers });
}

// ----------------------------------------------------------------------
// RECURRING TASKS
// ----------------------------------------------------------------------

/**
 * Complete a recurring task and generate the next occurrence.
 * Returns both the completed task and the newly created next occurrence.
 */
export async function completeRecurringTask(
  taskId: string
): Promise<{ completed: Task; next?: Task }> {
  const headers = await getAuthHeaders();
  return apiClient.post<{ completed: Task; next?: Task }>(
    `/v1/tasks/${taskId}/complete-and-generate-next`,
    {},
    { headers }
  );
}

// ----------------------------------------------------------------------
// CALENDAR LINKING
// ----------------------------------------------------------------------

export type CalendarLinkResult = {
  task: Task;
  calendarEvent: {
    id: string;
    calendarId: string;
    htmlLink?: string;
  };
};

/**
 * Create a Google Calendar event from a task.
 * Task must have a due date.
 * @param taskId - The task ID
 * @param options - Optional calendar ID and duration in minutes (default 60)
 */
export async function createCalendarEventFromTask(
  taskId: string,
  options: { calendarId?: string; duration?: number } = {}
): Promise<CalendarLinkResult> {
  const headers = await getAuthHeaders();
  return apiClient.post<CalendarLinkResult>(
    `/v1/tasks/${taskId}/create-calendar-event`,
    options,
    { headers }
  );
}

/**
 * Unlink a calendar event from a task.
 * Optionally delete the event from Google Calendar.
 */
export async function unlinkCalendarEvent(
  taskId: string,
  deleteEvent = false
): Promise<Task> {
  const headers = await getAuthHeaders();
  return apiClient.delete<Task>(
    `/v1/tasks/${taskId}/unlink-calendar-event?deleteEvent=${deleteEvent}`,
    { headers }
  );
}

// ----------------------------------------------------------------------
// TASK TEMPLATES CRUD
// ----------------------------------------------------------------------

export async function getTaskTemplates(query: TaskTemplatesQuery = {}): Promise<TaskTemplate[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();

  if (query.search) params.set('search', query.search);
  if (query.includeDeleted) params.set('includeDeleted', 'true');

  const suffix = params.toString() ? `?${params.toString()}` : '';

  return apiClient.get<TaskTemplate[]>(`/v1/task-templates${suffix}`, { headers });
}

export async function getTaskTemplate(templateId: string): Promise<TaskTemplate> {
  const headers = await getAuthHeaders();
  return apiClient.get<TaskTemplate>(`/v1/task-templates/${templateId}`, { headers });
}

export async function createTaskTemplate(input: CreateTaskTemplateInput): Promise<TaskTemplate> {
  const headers = await getAuthHeaders();
  return apiClient.post<TaskTemplate>('/v1/task-templates', input, { headers });
}

export async function updateTaskTemplate(
  templateId: string,
  input: UpdateTaskTemplateInput
): Promise<TaskTemplate> {
  const headers = await getAuthHeaders();
  return apiClient.patch<TaskTemplate>(`/v1/task-templates/${templateId}`, input, { headers });
}

export async function deleteTaskTemplate(templateId: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders();
  return apiClient.delete<{ success: boolean }>(`/v1/task-templates/${templateId}`, { headers });
}

export async function createTaskFromTemplate(
  templateId: string,
  overrides: CreateTaskFromTemplateInput = {}
): Promise<Task> {
  const headers = await getAuthHeaders();
  return apiClient.post<Task>(`/v1/task-templates/${templateId}/create-task`, overrides, { headers });
}
