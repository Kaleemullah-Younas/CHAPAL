'use client';

import { DocSection } from '@/components/docs/DocSection';

export default function ArchitecturePage() {
    return (
        <div className="space-y-8">
            <div>
                <span className="inline-block text-sm font-semibold tracking-widest uppercase text-emerald-500 mb-2 font-heading">
                    Reference
                </span>
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 font-heading">
                    System Architecture
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    CHAPAL operates on a dual-layer detection system to balance speed and semantic understanding.
                </p>
            </div>

            <DocSection title="High-Level Flow">
                <div className="p-6 bg-slate-900 rounded-xl text-slate-200 font-mono text-sm overflow-x-auto mb-8 shadow-inner">
                    <p>User Query</p>
                    <p className="text-emerald-400">⬇</p>
                    <p><strong>[Layer 1] Deterministic Guard (Local)</strong></p>
                    <p className="pl-4 text-slate-400">- Spike Detection (DDoS)</p>
                    <p className="pl-4 text-slate-400">- Regex / Pattern Matching (PII, Keywords)</p>
                    <p className="text-emerald-400">⬇ (if Safe)</p>
                    <p><strong>Gemini 1.5 Flash (Generation)</strong></p>
                    <p className="pl-4 text-slate-400">- Generates initial response buffer</p>
                    <p className="text-emerald-400">⬇</p>
                    <p><strong>[Layer 2] Semantic Auditor (Groq / Llama 3.1)</strong></p>
                    <p className="pl-4 text-slate-400">- Contextual Analysis (Hallucinations, Tone)</p>
                    <p className="pl-4 text-slate-400">- Medical/Psychological Evaluation</p>
                    <p className="text-emerald-400">⬇</p>
                    <p><strong>Decision Gate</strong></p>
                    <p className="pl-4 text-emerald-400">➡ Safe: Deliver to User</p>
                    <p className="pl-4 text-rose-400">➡ Anomaly: Block & Route to Admin</p>
                </div>
            </DocSection>

            <DocSection title="Layer 1: Deterministic (The Shield)">
                <p>
                    This layer runs instantly on the server. It handles high-speed threats that don't require deep AI understanding to identify.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                    <li><strong>Spike Detection:</strong> Blocks users sending &gt;4 messages in rapid succession (Anti-DDoS).</li>
                    <li><strong>Pattern Matching:</strong> Uses strict Regex for SSNs, Credit Cards, and known malicious prompt injection strings.</li>
                </ul>
            </DocSection>

            <DocSection title="Layer 2: Semantic (The Brain)">
                <p>
                    Powered by <strong>Llama 3.1 8B</strong> running on <strong>Groq</strong> LPU hardware. This layer "reads" the conversation like a human auditing the chat.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                    <li><strong>Hallucination Check:</strong> Compares the Gemini response against known facts or internal context.</li>
                    <li><strong>Tone Analysis:</strong> Detects subtle hostility or manipulation that regex misses.</li>
                    <li><strong>Medical/Legal Safety:</strong> Identifies if the AI is giving advice it shouldn't (e.g., specific dosage instructions).</li>
                </ul>
            </DocSection>

            <DocSection title="Technology Stack">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 not-prose">
                    <div className="text-center p-4 bg-white border border-border rounded-xl">
                        <div className="font-bold text-foreground">Next.js 15</div>
                        <div className="text-xs text-muted-foreground">Framework</div>
                    </div>
                    <div className="text-center p-4 bg-white border border-border rounded-xl">
                        <div className="font-bold text-foreground">Gemini</div>
                        <div className="text-xs text-muted-foreground">Chat Model</div>
                    </div>
                    <div className="text-center p-4 bg-white border border-border rounded-xl">
                        <div className="font-bold text-foreground">Groq</div>
                        <div className="text-xs text-muted-foreground">Inference Engine</div>
                    </div>
                    <div className="text-center p-4 bg-white border border-border rounded-xl">
                        <div className="font-bold text-foreground">Prisma</div>
                        <div className="text-xs text-muted-foreground">ORM / DB</div>
                    </div>
                </div>
            </DocSection>
        </div>
    );
}
