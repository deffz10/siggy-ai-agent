const fs = require("fs")
const fetch = require("node-fetch")

const systemPrompt = fs.readFileSync("./prompt.txt", "utf8")
const knowledge = fs.readFileSync("./knowledge.txt", "utf8")

const SYSTEM_MSG = systemPrompt + `

---
OFFICIAL RITUAL KNOWLEDGE BASE

${knowledge}

---
RULES:
- Always prioritize the knowledge base above for Ritual-specific facts.
- Do not invent information not listed there.
- If unsure, say you are not certain instead of guessing.
`

let history = [
  { role: "system", content: SYSTEM_MSG }
]

module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(200).json({ status: "ok" })
  }

  try {

    const { message } = req.body

    if (!message) {
      return res.json({ reply: "Empty message" })
    }

    history.push({
      role: "user",
      content: message
    })

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
          max_tokens: 800
        })
      }
    )

    const data = await response.json()

    const reply =
      data.choices?.[0]?.message?.content?.trim() || "No response"

    history.push({
      role: "assistant",
      content: reply
    })

    res.status(200).json({ reply })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      reply: "Server error"
    })

  }

}
