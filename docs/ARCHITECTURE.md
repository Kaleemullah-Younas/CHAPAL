# System Architecture

CHAPAL (Contextual Human-Assisted Protection and Anomaly Learning) is built on a **Dual-Layer Detection Architecture** designed to balance real-time performance with deep semantic understanding.

## High-Level Data Flow

1.  **User Input** is received via the Chat Interface.
2.  **Layer 1 (Deterministic Guard)** scans the input immediately on the server.
    *   *Checks:* Spike detection (DDoS protection), Regex patterns (PII, Injection).
    *   *Action:* If triggered, blocks immediately.
3.  **Gemini 1.5 Flash** generates a response (buffered, not sent to user yet).
4.  **Layer 2 (Semantic Auditor)** analyzes the User Query + AI Response pair.
    *   *Engine:* Llama 3.1 8B running on Groq (for speed).
    *   *Checks:* Hallucinations, Medical Advice, Tone/Sentiment, Complex Injection attempts.
5.  **Decision Gate**:
    *   *Safe:* Response is streamed to the user.
    *   *Anomaly:* Response is blocked/hidden. Incident is logged to the Database with status `Pending Review`.
6.  **Human-in-the-Loop**: Admins review the logged anomaly and decide to **Approve**, **Block**, or **Correct** the response.

## Technology Stack

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
*   **Database**: PostgreSQL via [Prisma ORM](https://www.prisma.io/)
*   **AI Models**:
    *   Generation: Google Gemini 1.5 Flash
    *   Auditing: Llama 3.1 70B/8B (via Groq)
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React

## Project Structure

*   `src/app`: App Router pages and API routes.
*   `src/app/api/chat/route.ts`: Core logic containing the Dual-Layer pipeline.
*   `src/components/chat`: Chat interface components (`TransparencyPanel`, `SimulationToolbar`).
*   `src/lib`: Utility functions for AI services (`gemini.ts`, `groq.ts`, `anomaly-detection.ts`).
