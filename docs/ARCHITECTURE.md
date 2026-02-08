# System Architecture

CHAPAL (Contextual Human-Assisted Protection and Anomaly Learning) is built on a **Dual-Layer Detection Architecture** designed to balance real-time performance with deep semantic understanding.

## High-Level Data Flow

1.  **User Input** is received via the Chat Interface.
2.  **Layer 1 (Deterministic Guard)** scans the input immediately on the server.
    - _Checks:_ Spike detection (DDoS protection), Regex patterns (PII, Injection).
    - _Action:_ If triggered, blocks immediately.
3.  **Google Gemini 3** (`gemini-3-flash-preview`) generates a response via the official `@google/generative-ai` SDK (buffered, not sent to user yet). See `src/lib/gemini.ts` → `streamGeminiResponse()`.
4.  **Layer 2 (Semantic Auditor)** analyzes the User Query + AI Response pair.
    - _Engine:_ Llama 3.1 8B running on Groq (for speed).
    - _Checks:_ Hallucinations, Medical Advice, Tone/Sentiment, Complex Injection attempts.
5.  **Decision Gate**:
    - _Safe:_ Response is streamed to the user.
    - _Anomaly:_ Response is blocked/hidden. Incident is logged to the Database with status `Pending Review`.
6.  **Human-in-the-Loop**: Admins review the logged anomaly and decide to **Approve**, **Block**, or **Correct** the response.

## Technology Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Database**: PostgreSQL via [Prisma ORM](https://www.prisma.io/)
- **AI Models**:
  - Generation: **Google Gemini 3** (`gemini-3-flash-preview`) — via `@google/generative-ai` SDK
  - Embeddings: **Gemini Embedding** (`gemini-embedding-001`) — for semantic feedback learning
  - Auditing: Llama 3.1 70B/8B (via Groq)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Project Structure

- `src/app`: App Router pages and API routes.
- `src/app/api/chat/route.ts`: Core logic containing the Dual-Layer pipeline.
- `src/components/chat`: Chat interface components (`TransparencyPanel`, `SimulationToolbar`).
- `src/lib`: Utility functions for AI services (`gemini.ts`, `groq.ts`, `anomaly-detection.ts`).
