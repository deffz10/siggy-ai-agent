const express = require("express")
const fs = require("fs")
const fetch = require("node-fetch")
require("dotenv").config()

const app = express()
app.use(express.json())
app.use(express.static("."))

// Check API key
if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY missing in .env file")
}

// Load files
const systemPrompt = fs.readFileSync("prompt.txt", "utf8")
const knowledge = fs.readFileSync("knowledge.txt", "utf8")

// Build system message
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
- Write only clean plain text. This is enforced at the system level.
`

let history = [
  { role: "system", content: SYSTEM_MSG }
]

const MAX_HISTORY = 10

function trimHistory() {
  if (history.length > MAX_HISTORY) {
    history = [
      history[0], // always keep system prompt
      ...history.slice(history.length - (MAX_HISTORY - 1))
    ]
  }
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body

    if (!message || !message.trim()) {
      return res.json({ reply: "Empty message" })
    }

    const userMessage = message.trim()
    console.log("User:", userMessage)

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
          temperature: 0.7,      // slightly higher for more personality
          top_p: 0.9,
          max_tokens: 800        // increased from 500 to 800
        })
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error("Groq error:", text)
      return res.json({ reply: "AI service error" })
    }

    const data = await response.json()
    let reply =
      data.choices?.[0]?.message?.content?.trim() || "No response."

    // Strip any markdown that slipped through (safety net)
    reply = reply
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/^\s*[-*+]\s/gm, "• ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    console.log("Siggy:", reply)

    history.push({
      role: "assistant",
      content: reply
    })

    trimHistory()

    res.json({ reply })

  } catch (err) {
    console.error("Server error:", err)
    res.json({ reply: "Server error. Try again." })
  }
})

// Reset conversation
app.post("/api/reset", (req, res) => {
  history = [
    { role: "system", content: SYSTEM_MSG }
  ]
  console.log("Conversation reset")
  res.json({ status: "reset" })
})

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKey: process.env.GROQ_API_KEY ? "set" : "missing",
    historyLength: history.length
  })
})

app.listen(3000, () => {
  console.log("")
  console.log("✓ Siggy running → http://localhost:3000")
  console.log("✓ GROQ API:", process.env.GROQ_API_KEY ? "connected" : "missing")
  console.log("")
})
