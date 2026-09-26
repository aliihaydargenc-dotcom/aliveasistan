export type ViewId = "home" | "notes" | "voice" | "calendar" | "tools";

export interface Note {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  body?: string;
  plainText?: string;
  kind?: string;
  pinned?: boolean;
  archived?: boolean;
  audioFileId?: string;
  duration?: number;
  transcript?: string;
}

export interface CalendarEvent {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  title: string;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  note?: string;
  color?: string;
}

export interface AppUser {
  $id: string;
  name?: string;
  email?: string;
}
