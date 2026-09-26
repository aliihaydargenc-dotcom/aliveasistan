import { Account, Client, Storage, TablesDB } from "appwrite";

export const config = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1",
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || "alive-asistan",
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID || "alive",
  notesTableId: import.meta.env.VITE_APPWRITE_NOTES_TABLE_ID || "notes",
  eventsTableId: import.meta.env.VITE_APPWRITE_EVENTS_TABLE_ID || "events",
  voiceBucketId: import.meta.env.VITE_APPWRITE_VOICE_BUCKET_ID || "voice-notes",
};

export const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
