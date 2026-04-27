import axios from "axios";

export const askAi = async (messages) => {
  try {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Message Array is Empty.");
    }

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions", // ✅ correct URL
      {
        model: "openai/gpt-4o-mini", // ✅ OpenRouter format
        messages: messages,
        max_tokens: 200
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, // ✅ your env key
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173", // optional but recommended
          "X-Title": "AI-Agent-App" // optional app name
        }
      }
    );

    const content = response?.data?.choices?.[0]?.message?.content;

    if (!content || !content.trim()) {
      throw new Error("AI returned empty response.");
    }

    return content;

  } catch (error) {
    console.error("OpenRouter Error:", error.response?.data || error.message);
    throw new Error("OpenRouter API Error");
  }
};