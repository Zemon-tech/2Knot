# Social Content ADK Agent

## What this agent does

The `social_content_agent` is an ADK `Agent` that:

- **Generates social media content** (X/Twitter, LinkedIn, Instagram, etc.).
- **Uses Google Search** (via the `google_search` built-in tool) to:
  - Fetch the latest news and web information.
  - Cross-check / verify key facts before writing posts.
- Adapts tone and format based on the user’s request.

Implementation: `agent/agents/social_content_agent/agent.py`.

## Files

- `__init__.py` – Imports the `agent` module so ADK can discover the package.
- `agent.py` – Defines `root_agent` with:
  - `name="social_content_agent"`
  - `model="gemini-2.5-flash"`
  - `tools=[google_search]`
  - Instructions that enforce: use search for news, verify facts, and include a short `Sources` section.

## Requirements

- Python 3.10+
- ADK installed (see https://google.github.io/adk-docs/get-started/python/)
- A valid Gemini API key in a `.env` file in the **project root** or as documented in ADK:
  - `GOOGLE_API_KEY=your_key_here`

## Running the agent

From the parent directory that contains the `agent` folder (the same level where you run `greeting_agent`):

```bash
# Activate the same virtualenv you use for greeting_agent, then:
adk web
```

- Open the URL shown in the terminal (typically http://localhost:8000).
- In the UI, pick `social_content_agent` from the agents dropdown.
- Start chatting with prompts like:
  - "Create a LinkedIn post about the latest AI regulation news in the EU."
  - "Give me 3 X posts about today’s biggest AI model announcement, each with a different angle."
  - "Draft an Instagram caption summarizing today’s key crypto market news in a neutral, informative tone."

You can also run it from the CLI (agent name may depend on how ADK discovers the project):

```bash
adk run social_content_agent
```

## Behavior notes

- When the user asks about **current events or news-based topics**, the agent will:
  - Call `google_search` to get up-to-date information.
  - Try more than one query to cross-check important claims.
  - Prefer reputable sources (major news orgs, official docs, etc.).
- The agent:
  - Summarizes sources in its own words.
  - Avoids making up statistics or quotes.
  - Adds a short `Sources:` section with key links / domains at the end of news-based responses.

You can further customize behavior by editing the `instruction` field in `agent.py` (e.g., default tone, preferred platforms, languages).
