import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessageView,
  ChatProfile,
} from "@/components/chat/chatTypes";
import { createClient } from "@/lib/supabase/server";

type GmChatPageProps = {
  searchParams: Promise<{
    player?: string;
  }>;
};

async function loadMessages(
  conversationId: string,
  currentProfile: ChatProfile,
  otherParticipant: ChatProfile
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("gm_messages")
    .select("id, conversation_id, sender_id, content, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error(`Could not load messages: ${error.message}`);
  }

  return ((data ?? []) as ChatMessage[]).map((message): ChatMessageView => {
    const sender =
      message.sender_id === currentProfile.id
        ? currentProfile
        : otherParticipant;

    return {
      ...message,
      sender_name: sender.display_name,
      sender_role: sender.role,
    };
  });
}

async function getOrCreatePlayerConversation(playerId: string) {
  const supabase = await createClient();

  const { data: existingConversation, error: selectError } = await supabase
    .from("gm_conversations")
    .select("id, player_id, created_at, updated_at")
    .eq("player_id", playerId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Could not load conversation: ${selectError.message}`);
  }

  if (existingConversation) {
    return existingConversation as ChatConversation;
  }

  const { data: createdConversation, error: insertError } = await supabase
    .from("gm_conversations")
    .insert({ player_id: playerId })
    .select("id, player_id, created_at, updated_at")
    .single();

  if (insertError) {
    const { data: retryConversation, error: retryError } = await supabase
      .from("gm_conversations")
      .select("id, player_id, created_at, updated_at")
      .eq("player_id", playerId)
      .single();

    if (retryError) {
      throw new Error(`Could not create conversation: ${insertError.message}`);
    }

    return retryConversation as ChatConversation;
  }

  return createdConversation as ChatConversation;
}

export default async function GmChatPage({
  searchParams,
}: GmChatPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    throw new Error("The current user profile could not be loaded.");
  }

  const currentProfile = profileData as ChatProfile;

  if (currentProfile.role === "player") {
    const conversation = await getOrCreatePlayerConversation(currentProfile.id);

    const { data: gmProfileData, error: gmProfileError } = await supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("role", "dm")
      .limit(1)
      .single();

    if (gmProfileError || !gmProfileData) {
      return (
        <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-slate-100">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300"
          >
            ← Back to Command Center
          </Link>

          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
            No Game Master profile was found.
          </div>
        </main>
      );
    }

    const gmProfile = gmProfileData as ChatProfile;
    const messages = await loadMessages(
      conversation.id,
      currentProfile,
      gmProfile
    );

    return (
      <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 text-slate-100">
        <Link
          href="/"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
        >
          ← Back to Command Center
        </Link>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Private Channel
          </p>
          <h1 className="mt-3 text-4xl font-bold">Message the Game Master</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Only you and the Game Master can read this conversation.
          </p>
        </div>

        <div className="mt-6">
          <ChatWindow
            conversationId={conversation.id}
            currentUser={currentProfile}
            otherParticipant={gmProfile}
            initialMessages={messages}
          />
        </div>
      </main>
    );
  }

  const { data: playersData, error: playersError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("role", "player")
    .order("display_name", { ascending: true });

  if (playersError) {
    throw new Error(`Could not load players: ${playersError.message}`);
  }

  const players = (playersData ?? []) as ChatProfile[];
  const query = await searchParams;
  const selectedPlayer =
    players.find((player) => player.id === query.player) ?? players[0] ?? null;

  let selectedConversation: ChatConversation | null = null;
  let selectedMessages: ChatMessageView[] = [];

  if (selectedPlayer) {
    selectedConversation = await getOrCreatePlayerConversation(selectedPlayer.id);
    selectedMessages = await loadMessages(
      selectedConversation.id,
      currentProfile,
      selectedPlayer
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-slate-100">
      <Link
        href="/"
        className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Game Master Channel
        </p>
        <h1 className="mt-3 text-4xl font-bold">Player Conversations</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Select a player to open their private conversation with the Game Master.
        </p>
      </div>

      {players.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
          No player accounts have been created yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="px-2 text-xs uppercase tracking-[0.3em] text-yellow-500">
              Players
            </p>

            <nav className="mt-4 space-y-2">
              {players.map((player) => {
                const isSelected = selectedPlayer?.id === player.id;

                return (
                  <Link
                    key={player.id}
                    href={`/gm-chat?player=${player.id}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      isSelected
                        ? "border-yellow-500 bg-yellow-500/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-yellow-600/40"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border font-black ${
                        isSelected
                          ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-300"
                          : "border-slate-700 bg-slate-900 text-slate-400"
                      }`}
                    >
                      {player.display_name.slice(0, 1).toUpperCase()}
                    </span>

                    <div>
                      <p className="font-bold text-slate-200">
                        {player.display_name}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-600">
                        Private chat
                      </p>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {selectedPlayer && selectedConversation && (
            <ChatWindow
              key={selectedConversation.id}
              conversationId={selectedConversation.id}
              currentUser={currentProfile}
              otherParticipant={selectedPlayer}
              initialMessages={selectedMessages}
            />
          )}
        </div>
      )}
    </main>
  );
}
