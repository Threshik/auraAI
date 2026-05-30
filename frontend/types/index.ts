export interface Message {
    id?: number;
    role: string;
    content: string;
    created_at?: string;
    file_name?: string | null;
    file_media_type?: string | null;
    file_base64?: string | null;
}

export interface Conversation {
    id: number;
    title: string;
    system_prompt?: string | null;
    updated_at?: string;
    is_shared?: boolean;
    share_token?: string | null;
}
