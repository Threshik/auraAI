const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export async function createConversation(): Promise<{ id: number; title: string }> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to create conversation");
  }

  return response.json();
}

export async function getConversations(): Promise<{ id: number; title: string }[]> {
  const response = await fetch(`${API_BASE_URL}/conversations`);

  if (!response.ok) {
    throw new Error("Failed to fetch conversations");
  }

  return response.json();
}

export async function getMessages(
  conversationId: number
): Promise<{ id: number; role: string; content: string }[]> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }

  return response.json();
}

export async function sendMessage(
  message: string,
  conversationId: number,
  onChunk: (chunk: string) => void
) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
    }),
  });

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value);

    onChunk(chunk);
  }
}

export async function renameConversation(
  id: number,
  title: string
): Promise<{ id: number; title: string }> {
  const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error("Failed to rename conversation");
  }

  return response.json();
}

export async function deleteConversation(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export async function deleteMessagesFrom(
  conversationId: number,
  messageId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages/from/${messageId}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Failed to delete messages");
  }
}

export async function setSystemPrompt(
  id: number,
  systemPrompt: string
): Promise<{ id: number; title: string; system_prompt: string | null }> {
  const response = await fetch(`${API_BASE_URL}/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system_prompt: systemPrompt }),
  });

  if (!response.ok) {
    throw new Error("Failed to update system prompt");
  }

  return response.json();
}