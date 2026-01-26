# Architecture: Human-in-the-Loop Anomaly Detection for AI System Misbehavior

## Phase 1: User Interaction & AI Generation

1. **User** initiates a session and sends a **User Query**.
2. The query is processed by the **Chatbot**.
3. The system generates initial **AI Responses**.

## Phase 2: Automated Anomaly Detection

4. Before reaching the user, the response passes through **Anomaly Detection (Automated)**.
   - _The system scans for the following specific issues:_
     - **Accuracy:** Hallucination Check.
     - **Safety/Trigger:** Policy Violation.
     - **Prompt Injection Detection.**
     - **Sudden Spikes:** Unusual Volume.
     - **Medical/Physiological/Emotion Detection.**

## Phase 3: Verification & Decision Logic

5. The system performs a logic check: **Is Safe?** (Checked/Verified).

### Scenario A: The Response is Safe (YES)

1. The system proceeds to **Return Response to User**.
2. The interaction concludes successfully.

### Scenario B: The Response is Unsafe/Anomalous (NO)

_This triggers the "Human-in-the-Loop Intervention" block._

1. **Block & Route:** The system blocks the immediate response to the user and routes the data.
2. The issue is sent to the **Admin Panel / Triage**.
   - **Transparency Note:** The Admin sees **ALL** anomaly parameters. The User only sees "red alert" parameters on their dashboard for transparency.
3. The case moves to **Specialist Review**.
   - _Who involves:_ Respective Department / Specialists (e.g., Cyber, Psych, Domain Expert).
4. The specialist performs an analysis: **Analyze User Query + AI Response**.
5. The process enters the **Feedback & Correction Loop**.
   - _Action:_ If the AI hallucinated or was unsafe, the Specialist gives feedback & regenerates the response.
   - _System Update:_ The models are updated based on this feedback (Feedback Loop for Improvement points back to AI Responses).
6. The corrected content goes to a final check: **Once Satisfied (Human Approved)**.
7. The system performs the final action: **Send Corrected Response to User & Notification**.

---

## Additional Component: User Transparency

- **User Dashboard:** At any point, the user can access the **User Panel**.
- **Function:** The User can check anomalies detected in their specific chat history (viewing only the relevant "red alert" data).
