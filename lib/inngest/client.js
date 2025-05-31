import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
    id: "ai-finance", // Unique app ID
    name: "AI Finance", // App name
    retryFunction: async (attempt) => ({ // if function fails it will retry
        delay: Math.pow(2, attempt) * 1000, // Exponential backoff
        maxAttempts: 2, // Retry up to 2 times
    })
});
