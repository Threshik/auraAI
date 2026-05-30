const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function getHeaders(customHeaders?: HeadersInit): HeadersInit {
  return {
    ...customHeaders,
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
  };
}

export async function createConversation(): Promise<{ id: number; title: string }> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: "POST",
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to create conversation");
  }

  return response.json();
}

export async function getConversations(): Promise<{ id: number; title: string }[]> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch conversations");
  }

  return response.json();
}

export async function getMessages(
  conversationId: number
): Promise<{ id: number; role: string; content: string }[]> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages`,
    {
      headers: getHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }

  return response.json();
}

export async function sendMessage(
  message: string,
  conversationId: number,
  onChunk: (chunk: string) => void,
  fileBase64?: string,
  fileMediaType?: string,
  fileName?: string,
  activeProject?: string | null,
) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: getHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      ...(fileBase64 && {
        file_base64: fileBase64,
        file_media_type: fileMediaType ?? "application/octet-stream",
        file_name: fileName ?? "upload.bin",
      }),
      ...(activeProject && { active_project: activeProject }),
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
    headers: getHeaders({ "Content-Type": "application/json" }),
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
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export async function getAzureDevOpsStatus(): Promise<{ configured: boolean; org: string | null; default_project: string | null }> {
  const response = await fetch(`${API_BASE_URL}/azure-devops/status`, {
    headers: getHeaders(),
  });
  if (!response.ok) return { configured: false, org: null, default_project: null };
  return response.json();
}

export async function getAzureDevOpsProjects(): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`${API_BASE_URL}/azure-devops/projects`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
}

export async function getAzureDevOpsPipelines(project?: string | null): Promise<{
  id: number;
  name: string;
  path: string;
  last_run: {
    id: number;
    status: string;
    result: string | null;
    started: string | null;
    branch: string;
    url: string | null;
  } | null;
}[]> {
  const params = project ? `?project=${encodeURIComponent(project)}` : "";
  const response = await fetch(`${API_BASE_URL}/azure-devops/pipelines${params}`, {
    headers: getHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
}

export async function deleteMessagesFrom(
  conversationId: number,
  messageId: number
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/conversations/${conversationId}/messages/from/${messageId}`,
    {
      method: "DELETE",
      headers: getHeaders(),
    }
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
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ system_prompt: systemPrompt }),
  });

  if (!response.ok) {
    throw new Error("Failed to update system prompt");
  }

  return response.json();
}

export async function loginUser(): Promise<{ status: string; username?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to register login session");
  }
  return response.json();
}

export async function logoutUser(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to register logout session");
  }
  return response.json();
}

export interface ShareResponse {
  is_shared: boolean;
  share_token: string | null;
  share_url: string | null;
}

export async function shareConversation(id: number): Promise<ShareResponse> {
  const response = await fetch(`${API_BASE_URL}/conversations/${id}/share`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to share conversation");
  }
  return response.json();
}

export async function unshareConversation(id: number): Promise<ShareResponse> {
  const response = await fetch(`${API_BASE_URL}/conversations/${id}/share`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to unshare conversation");
  }
  return response.json();
}

export async function getSharedConversation(token: string): Promise<{ id: number; title: string }> {
  const response = await fetch(`${API_BASE_URL}/shared/${token}`);
  if (!response.ok) {
    throw new Error("Shared conversation not found");
  }
  return response.json();
}

export async function getSharedMessages(token: string): Promise<any[]> {
  const response = await fetch(`${API_BASE_URL}/shared/${token}/messages`);
  if (!response.ok) {
    throw new Error("Failed to fetch shared messages");
  }
  return response.json();
}