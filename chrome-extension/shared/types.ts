export interface Nugget {
  _id: string;
  content: string;
  source?: string;
}

export interface CustomConcept {
  _id: string;
  title: string;
  summary: string;
  enrichmentPrompt: string;
}

export interface ConceptGroup {
  _id: string;
  title: string;
  conceptIds?: string[];
}

export interface Session {
  _id: string;
  title?: string;
}

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}
