# 🚀 Frontend Developer Guide: Project Name

This document serves as the **official guide** to the frontend application, detailing the project architecture, core components, state management patterns, and essential developer commands.

---

## ✨ Project Overview & Key Statistics

| Metric | Status | Notes |
| :--- | :--- | :--- |
| **Technology Stack** | Modern | React, TypeScript, Tailwind CSS |
| **Last Commit** | [GitHub Stat Placeholder: 3 hours ago] | Keep your branches fresh! |
| **Open Issues** | [GitHub Stat Placeholder: 12] | Help us squash those bugs! |
| **Test Coverage** | [GitHub Stat Placeholder: 85%] | Target is 90% minimum. |



---

## 🛠️ Technology Stack

The stack is built for **speed, scalability, and maintainability**.

| Technology | Role | Aesthetic Tag |
| :--- | :--- | :--- |
| **Vite** | Blazing-fast build tool and dev server. | `⚡️` |
| **React + TypeScript** | Component-based UI and strong type safety. | `⚛️` + `🟦` |
| **Utility-first Styling** | Tailwind CSS-like approach for rapid styling. | `🎨` |
| **shadcn/ui Primitives** | Accessible, reusable UI components (`components/ui`). | `🧩` |
| **lucide-react** | Lightweight, beautiful icon set. | `🖼️` |

---

## 📂 Application Structure

The repository follows a clean, feature-driven, and layered architecture for clear separation of concerns.

```

frontend/src/
├─ api/
│  └─ client.ts               \# 🌐 Centralized API wrapper (auth, retry logic).
├─ components/
│  ├─ ai-elements/            \# 💬 Feature components specific to the AI chat experience.
│  │  ├─ prompt-input.tsx     \# ⌨️ Composer (attachments, actions, text area).
│  │  ├─ model-selector.tsx   \# 🧠 Model selection dialog.
│  │  ├─ message.tsx          \# 🖼️ Message bubble container.
│  │  ├─ response.tsx         \# 📝 Assistant's markdown renderer.
│  │  └─ ...
│  ├─ agents/
│  │  └─ CreateAgentDialog.tsx \# 🧑‍💻 Modal for creating/configuring agents.
│  └─ ui/                     \# 🧱 Generic UI Primitives (Button, Input, Dialog, etc.).
│     ├─ input-group.tsx      \# Grouping inputs and addons.
│     ├─ button.tsx, input.tsx, dialog.tsx, ...
│     └─ ...
├─ context/
│  └─ AuthContext.tsx         \# 🔑 Global Auth State (user details, login/logout functions).
├─ pages/
│  └─ Chat.tsx                \# 🖥️ The main chat screen view.
└─ main.tsx / App.tsx         \# 🏁 App shell, router setup, and provider wrappers.

```

---

## 🧭 Key User Experience (UX) Flows

### **1. Composer (`prompt-input.tsx`)**
* **Comprehensive Input:** Handles file attachments, drag-and-drop, clipboard paste, dynamic autosizing, and an extensible action menu.
* **Mention Support:** The `PromptInputTextarea` exposes `onMentionQueryChange` and `onMentionRemoved` for agent selection logic.

### **2. Agents & Mentions (`@`)**
* **Activation:** Typing the **`@`** symbol in the composer triggers a compact, filtered list of available Agents.
* **Selection:** Choosing an agent inserts an **`@<slug>`** token (pill) and sets the active agent context for the next submission.
* **Removal:** Pressing **`Backspace`** inside the mention token removes the *entire* pill and clears the active agent context.

### **3. Websearch Toggle**
* **Activation:** Toggled via a dedicated button in the action menu.
* **Visual Cue:** A **Websearch pill** appears, mirroring the agent pill styling, to indicate active search grounding.
* **Deactivation:** Clicking the pill deactivates the web search context.

### **4. Streaming Responses (SSE)**
* **Endpoint:** The `api.ai.stream()` helper manages the Server-Sent Events (SSE) connection.
* **Data Push:** Streams deltas (text chunks), conversational **phases** (e.g., 'thinking', 'generating'), **sources** (citations), and the **web summary**.

---

## 🌐 API Client & State Persistence

### **API Client (`src/api/client.ts`)**
* **Typed Endpoints:** Exposes strongly typed helpers for **auth**, **conversations**, **agents**, and **AI** services.
* **Resilience:** Automatically retries the SSE call on a **401 Unauthorized** response by executing `auth.refresh()` to get a new token.
* **Base URL:** Uses `VITE_API_BASE` env. Defaults to `http://localhost:4000/api` if not set.

#### ADK endpoints (optional)
Add these helpers to call ADK routes exposed by the backend:

```ts
export const api = {
  // ...existing groups
  adk: {
    health: () => request<{ healthy: boolean; timestamp: string }>("/adk/health"),
    listAgents: (refresh?: boolean) => request<{ agents: string[]; cached: boolean; timestamp: string }>(`/adk/agents${refresh ? "?refresh=true" : ""}`),
    sendMessage: (body: { agentName: string; message: string; conversationId?: string }) =>
      request<{ response: string; agentName: string; sessionId: string; timestamp: string; conversationId: string }>(
        "/adk/message",
        { method: "POST", body: JSON.stringify(body) }
      ),
  },
};
```

### **Dev Tips on State Management**
* **Ephemeral State:** Store temporary, UI-only state (e.g., whether a dropdown is open) **locally** within components.
* **Persistent State:** Use `localStorage` only for state that *must* survive a browser refresh (e.g., last selected AI provider/model).
* **Message Rendering:** Keep rendering functions for messages as lightweight as possible. **Sanitize** or remove any provider-internal fenced blocks (e.g., internal tool calls) before rendering markdown.

---

## ⚙️ Essential Developer Commands

Use these commands from the **project root** directory.

| Command | Purpose |
| :--- | :--- |
| `npm run dev --prefix frontend` | **Starts the development server.** |
| `npm run build --prefix frontend` | **Generates the production build artifacts.** |
| `npm run preview --prefix frontend` | **Serves the production build locally for testing.** |

---

## 🔧 Environment configuration

- **VITE_API_BASE**: Set to your backend API base (e.g., `http://localhost:4000/api`).
- Supabase (optional, for images):
  - **REACT_APP_SUPABASE_URL**
  - **REACT_APP_SUPABASE_ANON_KEY**
  - **VITE_SUPABASE_BUCKET**

---
