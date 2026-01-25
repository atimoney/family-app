export type FamilyMember = {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
};

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

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  purchased: boolean;
};
