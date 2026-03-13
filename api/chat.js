import fs from "fs"
import fetch from "node-fetch"

const systemPrompt = fs.readFileSync("prompt.txt", "utf8")
const knowledge = fs.readFileSync("knowledge.txt", "utf8")

const SYSTEM_MSG = systemPrompt + `

---
OFFICIAL RITUAL KNOWLEDGE BASE
(Use this as the primary source of truth when answering Ritual-related questions)

${knowledge}

---
RULES:
- Always prioritize the knowledge base above for Ritual-specific facts.
- Do not invent information not listed there.
- If unsure, say you are not certain instead of guessing.
- NEVER use markdown formatting in responses: no **, no *, no #, no _, no backticks.
- Write only clean plain text.
`

let history = [
  { role: "system", content: SYSTEM_MSG }
]

const MAX_HISTORY = 10

function trimHistory() {
  if (history.length > MAX_HISTORY) {
    history = [
      history[0],
      ...history.slice(history.length - (MAX_HISTORY - 1))
    ]
  }
}

export default async function handler(req, res) {

  try {

    if (req.method === "POST") {

      const { message } = req.body

      if (!message || !message.trim()) {
        return res.status(200).json({ reply: "Empty message" })
      }

      const userMessage = message.trim()

      history.push({
        role: "user",
        content: userMessage
      })

      trimHistory()

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + process.env.GROQ_API_KEY
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: history,
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 800
          })
        }
      )

      if (!response.ok) {
        const text = await response.text()
        console.error("Groq error:", text)
        return res.status(500).json({ reply: "AI service error" })
      }

      const data = await response.json()

      let reply =
        data.choices?.[0]?.message?.content?.trim() || "No response."

      reply = reply
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/^\s*[-*+]\s/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

      history.push({
        role: "assistant",
        content: reply
      })

      trimHistory()

      return res.status(200).json({ reply })

    }

    if (req.method === "GET") {

      return res.status(200).json({
        status: "ok",
        apiKey: process.env.GROQ_API_KEY ? "set" : "missing",
        historyLength: history.length
      })

    }

  } catch (err) {

    console.error("Server error:", err)

    return res.status(500).json({
      reply: "Server error. Try again."
    })

  }

}
