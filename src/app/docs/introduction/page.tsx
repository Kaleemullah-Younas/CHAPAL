'use client';

import { DocSection } from '@/components/docs/DocSection';
import { Shield, Brain, Users } from 'lucide-react';

export default function IntroductionPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 font-heading">
                    Introduction
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed border-l-4 border-primary pl-6 py-2 bg-secondary/20 rounded-r-lg">
                    CHAPAL (Contextual Human-Assisted Protection and Anomaly Learning) is a next-generation AI auditing system designed to make Large Language Model interactions safe, transparent, and compliant.
                </p>
            </div>

            <DocSection title="The Problem">
                <p className="text-lg text-muted-foreground mb-4">
                    As AI becomes more integrated into daily life, the risks of <strong>hallucinations</strong>, <strong>unsafe content</strong>, and <strong>prompt injections</strong> increase. Traditional filters are often binary (block/allow) and lack context.
                </p>
                <p className="text-lg text-muted-foreground">
                    CHAPAL fills this gap by introducing a <strong>Human-in-the-Loop (HITL)</strong> architecture that doesn't just block errors—it learns from them.
                </p>
            </DocSection>

            <DocSection title="Core Pillars">
                <div className="grid gap-6 md:grid-cols-3 not-prose">
                    <div className="p-6 bg-white rounded-xl border border-border shadow-sm">
                        <Shield className="w-8 h-8 text-primary mb-4" />
                        <h3 className="text-lg font-bold font-heading mb-2">Real-Time Auditing</h3>
                        <p className="text-sm text-muted-foreground">
                            Every message is scanned instantly using both deterministic rules and semantic analysis via Llama 3.1.
                        </p>
                    </div>
                    <div className="p-6 bg-white rounded-xl border border-border shadow-sm">
                        <Users className="w-8 h-8 text-emerald-500 mb-4" />
                        <h3 className="text-lg font-bold font-heading mb-2">Human Intervention</h3>
                        <p className="text-sm text-muted-foreground">
                            Experts review flagged content to approve safe messages or correct anomalies, refining the system.
                        </p>
                    </div>
                    <div className="p-6 bg-white rounded-xl border border-border shadow-sm">
                        <Brain className="w-8 h-8 text-indigo-500 mb-4" />
                        <h3 className="text-lg font-bold font-heading mb-2">Transparency</h3>
                        <p className="text-sm text-muted-foreground">
                            Users see exactly <em>how</em> their interaction is being analyzed with safety scores and emotion detection.
                        </p>
                    </div>
                </div>
            </DocSection>

            <DocSection title="Key Terminology">
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-border">
                        <h4 className="font-bold text-foreground font-heading">Safety Score</h4>
                        <p className="text-muted-foreground text-sm mt-1">
                            A 0-100 metric indicating the risk level of a conversation. Scores below 50 trigger blocks.
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-border">
                        <h4 className="font-bold text-foreground font-heading">Anomaly</h4>
                        <p className="text-muted-foreground text-sm mt-1">
                            Any interaction deviating from safe norms, including PII leaks, medical advice requests, or injection attacks.
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-border">
                        <h4 className="font-bold text-foreground font-heading">Triage</h4>
                        <p className="text-muted-foreground text-sm mt-1">
                            The admin process of reviewing pending anomalies to decide on blocking or correcting the AI response.
                        </p>
                    </div>
                </div>
            </DocSection>
        </div>
    );
}
