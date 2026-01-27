'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface DocSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
    id?: string;
}

export function DocSection({ title, description, children, id }: DocSectionProps) {
    return (
        <section id={id} className="mb-16 scroll-mt-24">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <h2 className="text-2xl lg:text-3xl font-bold font-heading text-foreground mb-4">
                    {title}
                </h2>
                {description && (
                    <p className="text-lg text-muted-foreground mb-8 leading-relaxed font-sans max-w-3xl">
                        {description}
                    </p>
                )}
                <div className="prose prose-slate max-w-none prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                    {children}
                </div>
            </motion.div>
        </section>
    );
}
