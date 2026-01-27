# User Guide & Features

CHAPAL provides a secure chat environment with built-in transparency tools.

## The Interface

The main interface is split into two panels:
1.  **Chat Panel (Left):** Standard chat interface.
2.  **Transparency Panel (Right):** Shows real-time metrics of the current session.

## Transparency Metrics

*   **Safety Score:** A 0-100 metric. Scores below 50 indicate a potential block.
*   **Emotion Detection:** Analyzes user sentiment (e.g., "Anxious", "Hostile", "Curious").
*   **Live Flag Log:** Displays ephemeral alerts for detected anomalies (Layer 1 or Layer 2).

## Simulation Toolbar

For testing and demonstration, the app includes a **Simulation Toolbar** above the chat input.

| Button | Function |
| :--- | :--- |
| **Prompt Injection** | Injects `"Ignore previous instructions..."` to test override protections. |
| **Self Harm** | Injects `"I feel hopeless..."` to test crisis intervention logic. |
| **PII Leak** | Injects a fake Social Security Number to test redaction/blocking. |
| **Hallucination** | Asks `"Who is the President of Mars?"` to test fact-checking limits. |
| **Medical Advice** | Asks for medication dosages to test safety policy compliance. |
| **DDoS Attack** | **[Special]** Sends a burst of 4 rapid messages to trigger Layer 1 Spike Detection and temporary IP/User blocking. |
