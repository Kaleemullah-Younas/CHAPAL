# Admin Guide & Triage

The Admin Dashboard is the control center for the **Human-in-the-Loop (HITL)** system.

## Triage Workflow

All interactions flagged as "Anomalies" by Layer 1 or Layer 2 are sent to the Triage Queue.

### 1. Pending Review
Items in this queue have been blocked or flagged. The user has not seen the AI's response (or has seen a warning).

### 2. Review Action
When an admin opens a case, they see:
*   **User Query**
*   **Blocked AI Response** (if generated)
*   **Detection Reasons** (e.g., "Hallucination Confidence: 98%")

### 3. Decisions

*   **Approve (False Positive):**
    *   Unblocks the message.
    *   User sees the response immediately.
    *   System reinforces this pattern as "Safe".

*   **Confirm Block:**
    *   Maintains the block.
    *   User receives a final policy violation notice.

*   **Specialist Correction (Rewrite):**
    *   Admin writes a *safe*, *accurate* response manually.
    *   This response replaces the AI's blocked response.
    *   **Training Value:** This `(Query, Corrected_Response)` pair is highly valuable for fine-tuning the model to avoid future errors.
