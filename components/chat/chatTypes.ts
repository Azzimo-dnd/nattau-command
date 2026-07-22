export type ChatProfile = {
  id: string;
  display_name: string;
  role: "dm" | "player";
};

export type ChatConversation = {
  id: string;
  player_id: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

export type ChatMessageView = ChatMessage & {
  sender_name: string;
  sender_role: "dm" | "player";
};
