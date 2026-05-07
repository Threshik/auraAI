"use client";

import { useState } from "react";
import { sendMessage } from "@/services/api";

export default function Home() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");

  async function handleSendMessage() {
    try {
      const data = await sendMessage(message);
      setResponse(data.response);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">
        AI Chat Platform
      </h1>

      <input
        type="text"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="border p-2 rounded w-80"
      />

      <button
        onClick={handleSendMessage}
        className="bg-black text-white px-4 py-2 rounded"
      >
        Send
      </button>

      {response && (
        <div className="border rounded p-4 w-80">
          {response}
        </div>
      )}
    </main>
  );
}