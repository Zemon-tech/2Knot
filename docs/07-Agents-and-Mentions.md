# Agents & @-Mentions

This document explains the agent system and how inline `@` mentions behave in the chat composer.

## Concepts

- **Agent**: A saved persona/tool with a `name`, optional `description`, `slug`, and a required `systemPrompt`.
- **Active Agent**: When selected, the agent influences the model via `agentId` in the `/ai/stream` request.
- **Inline Mention**: Typing `@` in the composer opens a compact agent list. Selecting inserts `@<agent-slug>` in the text where you typed `@`.

## Data model (backend)
- Collection: `agents` (see `backend/src/models/Agent.ts`)
- CRUD routes (auth required):
  - `GET /api/agents` — list
  - `POST /api/agents` — create `{ name, description?, systemPrompt }`
  - `PATCH /api/agents/:id` — update
  - `DELETE /api/agents/:id` — remove

## Frontend behavior

- **Open mention menu**: Type `@` and continue typing characters; a compact list filters by `name`/`slug`.
- **Insert mention**: Selecting an agent inserts `@<slug> ` at the caret. This sets the agent as active.
- **Agent pill**: When active, a pill appears in the left addon (under Websearch). Click to clear.
- **Rectangle composer**: The input switches to a rectangular style when websearch or an agent is active.
- **Backspace removal**: Backspace anywhere inside `@<slug>` (or just after its trailing space) removes the whole token in a single keypress and clears the active agent if it matches the token.
- **Create agent from menu**: Selecting “Create new agent…” opens a dialog to create and immediately insert/select the agent.

## Implementation notes

- Chat page: `frontend/src/pages/Chat.tsx`
  - Inserts mentions at caret using the focused textarea and updates caret/Autosize.
  - Tracks active agent in state and passes `agentId` to `api.ai.stream()`.
  - Renders pills via `PromptInputActiveModeWebsearch` for visual consistency.
- Prompt input: `frontend/src/components/ai-elements/prompt-input.tsx`
  - Textarea exposes `onMentionQueryChange` and `onMentionRemoved`.
  - Backspace logic finds token boundaries and removes the whole mention.
  - Force multiline layout/rectangle style is supported via props from Chat.

## Tips for extending

- Add agent-specific settings (e.g., default provider/model) to the `Agent` schema and expose in the dialog.
- Allow switching agents mid-message by keeping the menu active even when an agent is selected and replacing the nearest `@token`.
- For inline “chip” rendering inside the input, consider a contenteditable or an overlay highlighter.
