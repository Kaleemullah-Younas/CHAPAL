'use client';

import { DocSection } from '@/components/docs/DocSection';

export default function AdminGuidePage() {
    return (
        <div className="space-y-8">
            <div>
                <span className="inline-block text-sm font-semibold tracking-widest uppercase text-indigo-500 mb-2 font-heading">
                    Guides
                </span>
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 font-heading">
                    Admin Guide
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    The Command Center for Human-in-the-Loop intervention. Learn how to review, approve, and correct AI behaviors.
                </p>
            </div>

            <DocSection title="The Triage Dashboard">
                <p className="mb-4">
                    Admins access a secure dashboard that aggregates all flagged interactions from across the platform. The dashboard is prioritized by <strong>Severity</strong>.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li><strong>Critical (Red):</strong> Immediate threats, self-harm, or severe injection attacks.</li>
                    <li><strong>High (Orange):</strong> Strong hallucinations or PII leaks.</li>
                    <li><strong>Medium (Yellow):</strong> Ambiguous medical advice or moderate policy violations.</li>
                </ul>
            </DocSection>

            <DocSection title="Intervention Workflow">
                <p className="mb-6">
                    When you select a flaged item, you enter the <strong>Review Mode</strong>. Here you see the user's original query and the AI's blocked response.
                </p>

                <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 border-b border-border px-6 py-3">
                        <h3 className="font-heading font-bold text-sm text-muted-foreground uppercase">Available Actions</h3>
                    </div>
                    <div className="divide-y divide-border">
                        <div className="p-6">
                            <h4 className="font-bold text-lg text-emerald-600 mb-2 font-heading">1. Approve (False Positive)</h4>
                            <p className="text-sm text-muted-foreground">
                                Use this if the system incorrect flagged a safe message.
                                <br />
                                <em>Action:</em> The message is unblocked and instantly displayed to the user. The system logs this as a safe pattern.
                            </p>
                        </div>
                        <div className="p-6">
                            <h4 className="font-bold text-lg text-rose-600 mb-2 font-heading">2. Confirm Block</h4>
                            <p className="text-sm text-muted-foreground">
                                Use this if the violation was correctly identified.
                                <br />
                                <em>Action:</em> The user is notified that the content remains blocked. The user may be suspended if repeated.
                            </p>
                        </div>
                        <div className="p-6">
                            <h4 className="font-bold text-lg text-indigo-600 mb-2 font-heading">3. Specialist Correction</h4>
                            <p className="text-sm text-muted-foreground">
                                <strong>The Core HITL Feature.</strong> Use this to rewrite the AI's response manually.
                                <br />
                                <em>Action:</em> Your written response replaces the blocked AI message. The user sees the corrected answer, and this pair (Query + Corrected Response) is saved for fine-tuning.
                            </p>
                        </div>
                    </div>
                </div>
            </DocSection>

            <DocSection title="Anomaly Logs">
                <p>
                    Every decision you make is recorded in the <strong>Anomaly Log</strong>. This dataset becomes the ground truth for training future iterations of the Llama 3.1 guardrail model, creating a continuous improvement loop.
                </p>
            </DocSection>
        </div>
    );
}
