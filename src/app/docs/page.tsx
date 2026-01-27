'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Shield, LayoutDashboard, Cpu, ArrowRight } from 'lucide-react';

const guides = [
    {
        title: 'User Guide',
        description: 'Learn how to use the chat interface, anomaly simulation, and transparency panel.',
        href: '/docs/user-guide',
        icon: <Shield className="w-8 h-8 text-primary" />,
        color: 'bg-primary/10',
    },
    {
        title: 'Admin Guide',
        description: 'Master the triage dashboard and human-in-the-loop intervention workflows.',
        href: '/docs/admin-guide',
        icon: <LayoutDashboard className="w-8 h-8 text-indigo-500" />,
        color: 'bg-indigo-50',
    },
    {
        title: 'Architecture',
        description: 'Deep dive into the dual-layer detection system with Gemini and Llama 3.1.',
        href: '/docs/architecture',
        icon: <Cpu className="w-8 h-8 text-emerald-500" />,
        color: 'bg-emerald-50',
    },
];

export default function DocsPage() {
    return (
        <div className="space-y-16">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center py-12 px-4 rounded-3xl bg-secondary/30 border border-border"
            >
                <span className="inline-block text-sm font-semibold tracking-widest uppercase text-primary mb-4 font-heading">
                    Documentation
                </span>
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6 font-heading">
                    Welcome to CHAPAL Docs
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    Comprehensive guides and references for the Contextual Human-Assisted Protection and Anomaly Learning system.
                </p>
                <div className="mt-8 flex justify-center">
                    <Link
                        href="/docs/introduction"
                        className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group font-heading"
                    >
                        Start with Introduction
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </motion.div>

            <section>
                <h2 className="text-2xl font-bold font-heading text-foreground mb-8">
                    Quick Start Guides
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {guides.map((guide, index) => (
                        <motion.div
                            key={guide.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                        >
                            <Link
                                href={guide.href}
                                className="block h-full p-8 bg-white rounded-2xl border border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
                            >
                                <div className={`w-14 h-14 ${guide.color} rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                                    {guide.icon}
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-3 font-heading group-hover:text-primary transition-colors">
                                    {guide.title}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {guide.description}
                                </p>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>
        </div>
    );
}
