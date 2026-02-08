<div align="center">

![CHAPAL Hero](docs/readme_hero.png)

#

![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Google Gemini 3](https://img.shields.io/badge/Google%20Gemini%203-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white)
![Llama 3.1](https://img.shields.io/badge/Llama%203.1-0496FF?style=for-the-badge&logo=meta&logoColor=white)

</div>

---

## 🛡️ Project Overview

**CHAPAL** is a cutting-edge **AI Safety & Auditing Platform** built with **Google Gemini 3** (`gemini-3-flash-preview`), designed to solve the critical challenge of trust in Large Language Models (LLMs). By combining deterministic rule sets with semantic understanding, CHAPAL acts as a firewall between users and AI, ensuring every interaction is safe, accurate, and compliant.

Unlike traditional "black box" filters, CHAPAL introduces a **Human-in-the-Loop (HITL)** workflow, allowing experts to review blocked content, correct hallucinations, and fine-tune the system in real-time.

---

## 🤖 Google Gemini 3 — Core AI Engine

> **This project is powered by Google Gemini 3.** The Gemini API is the backbone of all AI generation in CHAPAL.

### Where Gemini 3 is Used

| Feature                      | Model                    | File                                                     | Function                                                                               |
| :--------------------------- | :----------------------- | :------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Chat Response Generation** | `gemini-3-flash-preview` | [`src/lib/gemini.ts`](src/lib/gemini.ts)                 | `streamGeminiResponse()` — Streams AI responses to users in real-time                  |
| **Chat Title Generation**    | `gemini-3-flash-preview` | [`src/lib/gemini.ts`](src/lib/gemini.ts)                 | `generateChatTitle()` — Auto-generates chat titles from first message                  |
| **Vector Embeddings**        | `gemini-embedding-001`   | [`src/lib/pinecone.ts`](src/lib/pinecone.ts)             | `generateEmbedding()` — Generates 768-dim embeddings for semantic feedback learning    |
| **Chat API Orchestration**   | `gemini-3-flash-preview` | [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) | `POST handler` — Orchestrates the full Dual-Layer pipeline using Gemini for generation |

### How Gemini 3 is Integrated

- **SDK**: Official Google Generative AI SDK ([`@google/generative-ai`](https://www.npmjs.com/package/@google/generative-ai) v0.24.1)
- **Model**: `gemini-3-flash-preview` — configured in [`src/lib/gemini.ts` → `getModel()`](src/lib/gemini.ts)
- **Embeddings**: `gemini-embedding-001` via REST API — configured in [`src/lib/pinecone.ts` → `generateEmbedding()`](src/lib/pinecone.ts)
- **API Key**: Set via `GEMINI_API_KEY` environment variable (supports multiple comma-separated keys for rotation)
- **Key Rotation**: Built-in `GeminiKeyManager` class handles rate-limit retries and key rotation across multiple API keys

### Required Environment Variables for Gemini

```env
# Google Gemini 3 API Key (required — get from https://aistudio.google.com/apikey)
# Supports multiple keys separated by commas for rate-limit rotation
GEMINI_API_KEY="your-gemini-api-key"
```

> **Note:** The `.env` file is not committed to the repository for security reasons. See [`.env.example`](.env.example) for the full list of required environment variables.

---

## 🏗️ System Architecture

Our **Dual-Layer Detection System** ensures robust protection without compromising speed.

![System Architecture](docs/architecture-diagram.jpeg)

1.  **Layer 1 (Deterministic Guard):** Instantly mitigates high-velocity threats like DDoS attacks, PII leaks, and known injection patterns using regex and heuristic logic.
2.  **AI Response Generation (Gemini 3):** The user query is sent to **Google Gemini 3** (`gemini-3-flash-preview`) via the official SDK to generate a response.
3.  **Layer 2 (Semantic Auditor):** Powered by **Llama 3.1 (via Groq)**, this layer "reads" the conversation to detect subtle nuances like hostile tone, medical advice, hallucinations, and psychological distress.

---

## 🌟 Key Features

- **⚡ Real-Time Anomaly Detection**:
  - **Prompt Injection**: Detects attempts to jailbreak the model (e.g., "Ignore previous instructions").
  - **Hallucination Check**: Cross-references AI responses for factual consistency.
  - **Policy Enforcement**: Blocks Medical/Legal advice and Toxic content.
- **👩‍💻 Human-in-the-Loop Intervention**:
  - Admins can **Approve**, **Block**, or **Rewrite** flagged responses.
  - " Rewrite" actions create a feedback loop, improving the model over time.
- **📊 Transparent Analytics**:
  - **Safety Score**: Live 0-100 metric for every session.
  - **Emotion Recognition**: Tracks user sentiment intensity.
- **🔧 Developer Simulation Tools**:
  - Built-in toolbar to simulate attacks (DDoS, Self-harm, PII) for testing defenses.

![Anomaly Detection Flow](docs/anamoly_detection.png)

---

## 📚 Documentation Index

We maintain modular documentation to help you get started quickly.

| Guide                                              | Audience   | Description                                            |
| :------------------------------------------------- | :--------- | :----------------------------------------------------- |
| **[🏛️ System Architecture](docs/ARCHITECTURE.md)** | Architects | Deep dive into the Dual-Layer Pipeline and Tech Stack. |
| **[📖 User Guide](docs/USER_GUIDE.md)**            | End Users  | How to use the Chat Interface and Simulation Toolbar.  |
| **[👮 Admin Guide](docs/ADMIN_GUIDE.md)**          | Admins     | Triage dashboard workflows and HITL best practices.    |

> **Live Docs:** You can also view the documentation securely within the app at [`/docs`](https://chapal.strangers.systems/docs).

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PRISMA with MONGO
- **Google Gemini API Key** (get from [Google AI Studio](https://aistudio.google.com/apikey))
- Groq API Key (for Layer 2 semantic analysis)

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/Kaleemullah-Younas/CHAPAL.git
    cd chapal
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Set up environment variables**
    Copy `.env.example` to `.env` and fill in your API keys:

    ```bash
    cp .env.example .env
    ```

    The most important variable is `GEMINI_API_KEY` — this powers all AI generation via **Google Gemini 3**.

4.  **Initialize Database**

    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run the development server**
    ```bash
    npm run dev
    ```
