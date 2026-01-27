# CHAPAL - Contextual Human-Assisted Protection and Anomaly Learning

**CHAPAL** is a next-generation AI auditing system designed to make Large Language Model interactions safe, transparent, and compliant. It features a dual-layer detection architecture (Deterministic + Semantic) and a Human-in-the-Loop intervention workflow.

## 📚 Documentation

We have comprehensive modular documentation available for developers and users.

### [System Architecture](/docs/ARCHITECTURE.md)
*   **Best for:** Developers, Architects.
*   **Topics:** Dual-Layer Data Flow, Gemini/Groq Integration, Tech Stack.

### [User & Feature Guide](/docs/USER_GUIDE.md)
*   **Best for:** End Users, QA Testers.
*   **Topics:** Using the Chat, Simulation Toolbar (DDoS, Injection tests), Transparency Panel metrics.

### [Admin & Triage Guide](/docs/ADMIN_GUIDE.md)
*   **Best for:** Moderators, Admins.
*   **Topics:** Triage Dashboard, Correcting hallucinations, Approval workflows.

---

## 🚀 Quick Start

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Refer to `src/app/api/chat/route.ts` for required keys (Gemini, Groq, Database).

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Visit [http://localhost:3000](http://localhost:3000).

4.  **View Examples**
    The app includes a live [Docs](/src/app/docs) route at `http://localhost:3000/docs`.

---

## Key Features

*   **Real-time Anomaly Detection**: Blocks PII, Medical Advice, and Prompt Injection.
*   **Simulation Toolbar**: Test defenses with one-click attacks.
*   **Transparency Panel**: View live safety scores and emotion analysis.
