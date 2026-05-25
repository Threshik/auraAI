export interface Message {
    id?: number;
    role: string;
    content: string;
    created_at?: string;
}

export interface Conversation {
    id: number;
    title: string;
    system_prompt?: string | null;
    updated_at?: string;
}
