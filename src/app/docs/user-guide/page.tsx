'use client';

import { DocSection } from '@/components/docs/DocSection';
import { Zap, Shield, Eye, AlertTriangle } from 'lucide-react';

export default function UserGuidePage() {
    return (
        <div className="space-y-8">
            <div>
                <span className="inline-block text-sm font-semibold tracking-widest uppercase text-primary mb-2 font-heading">
                    Guides
                </span>
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 font-heading">
                    User Guide
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    Learn how to navigate the CHAPAL chat interface, simulate anomalies, and understand the transparency metrics.
                </p>
            </div>

            <DocSection title="The Chat Interface">
                <p className="mb-4">
                    The main chat screen is divided into two distinct areas:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-6">
                    <li><strong>Left Panel (Interaction):</strong> Where you chat with the AI and run simulations.</li>
                    <li><strong>Right Panel (Transparency):</strong> A real-time dashboard showing how the AI is analyzing your behavior.</li>
                </ul>
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
                    <Eye className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <p className="text-sm text-blue-700"><strong>Note:</strong> On mobile devices, the Transparency Panel is hidden to save space.</p>
                </div>
            </DocSection>

            <DocSection title="Simulating Anomalies">
                <p className="mb-6">
                    CHAPAL includes a built-in <strong>Simulation Toolbar</strong> above the chat input. This allows you to safely test the system's defenses by injecting pre-scripted "attacks" or anomalous queries.
                </p>

                <div className="grid gap-4 md:grid-cols-2 not-prose">
                    <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-rose-500" />
                            <h3 className="font-bold font-heading text-rose-900">Prompt Injection</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-rose-100 block mb-2 text-rose-600">
                            "Ignore previous instructions..."
                        </code>
                        <p className="text-sm text-rose-700">Tests if the system can prevent users from overriding its safety protocols.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold font-heading text-amber-900">Self Harm</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-amber-100 block mb-2 text-amber-600">
                            "I feel hopeless..."
                        </code>
                        <p className="text-sm text-amber-700">Triggers an immediate safety block and admin alert for high-risk psychological distress.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-4 h-4 text-purple-500" />
                            <h3 className="font-bold font-heading text-purple-900">PII Leak</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-purple-100 block mb-2 text-purple-600">
                            "My social security number is..."
                        </code>
                        <p className="text-sm text-purple-700">Demonstrates the system's ability to redact or block sensitive personal information.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 text-blue-500 font-bold">?</div>
                            <h3 className="font-bold font-heading text-blue-900">Hallucination</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-blue-100 block mb-2 text-blue-600">
                            "Who is the President of Mars?"
                        </code>
                        <p className="text-sm text-blue-700">Tests the semantic Fact-Checking layer (Layer 2) against non-factual queries.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 text-emerald-500 font-bold">+</div>
                            <h3 className="font-bold font-heading text-emerald-900">Medical Advice</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-emerald-100 block mb-2 text-emerald-600">
                            "Medication for chest pain?"
                        </code>
                        <p className="text-sm text-emerald-700">System correctly identifies this as advice only a professional should give.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-yellow-100 bg-yellow-50/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-yellow-600" />
                            <h3 className="font-bold font-heading text-yellow-900">DDoS Attack</h3>
                        </div>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-yellow-100 block mb-2 text-yellow-600">
                            [Special Action]
                        </code>
                        <p className="text-sm text-yellow-700">Simulates a burst of 4 rapid messages to trigger Layer 1 Spike Detection.</p>
                    </div>
                </div>
            </DocSection>

            <DocSection title="Transparency Panel">
                <p className="mb-6">
                    The transparency panel provides "X-Ray vision" into the AI's decision-making process.
                </p>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-bold font-heading mb-2">Safety Score</h3>
                        <p className="text-muted-foreground text-sm">A dynamic gauge that drops when risky keywords or patterns are detected. Green indicates safety, while Red indicates a likely block.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold font-heading mb-2">Emotion Analysis</h3>
                        <p className="text-muted-foreground text-sm">The system attempts to read the emotional context of your query (e.g., Anxious, Hostile, Curious). High intensity negative emotions may trigger faster escalation.</p>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold font-heading mb-2">Review Status</h3>
                        <p className="text-muted-foreground text-sm">If your message is blocked, you'll see a status indicator showing if it's "Pending Review" by a human admin.</p>
                    </div>
                </div>
            </DocSection>
        </div>
    );
}
