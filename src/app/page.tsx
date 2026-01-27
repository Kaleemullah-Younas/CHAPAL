'use client';

import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
};

// Reusable Section Header
function SectionHeader({
  badge,
  title,
  description,
}: {
  badge?: string;
  title: string;
  description: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className="text-center mb-16"
    >
      {badge && (
        <motion.span
          variants={fadeInUp}
          className="inline-block text-sm font-semibold tracking-widest uppercase text-primary mb-4"
        >
          {badge}
        </motion.span>
      )}
      <motion.h2
        variants={fadeInUp}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4 font-heading tracking-tight"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={fadeInUp}
        className="text-lg text-muted-foreground max-w-2xl mx-auto font-sans"
      >
        {description}
      </motion.p>
    </motion.div>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative overflow-hidden hero-texture min-h-screen flex items-center pt-20">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-accent/30 to-primary/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-primary/20 to-accent/30 rounded-full blur-3xl"
          animate={{
            scale: [1.1, 1, 1.1],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:py-40">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center"
        >
          {/* Subtitle */}
          <motion.p
            variants={fadeInUp}
            className="text-sm font-semibold tracking-widest uppercase text-primary/80 mb-6 font-heading"
          >
            AI Safety & Anomaly Detection Platform
          </motion.p>

          {/* Main heading */}
          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 font-heading"
          >
            <span className="text-primary">Contextual Human-Assisted</span>
            <br />
            <span className="text-foreground">
              Protection & Anomaly Learning
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="mx-auto max-w-2xl text-lg sm:text-xl text-muted-foreground mb-10 font-sans"
          >
            CHAPAL provides real-time AI response monitoring with automated
            anomaly detection and human-in-the-loop intervention. Ensure safe,
            accurate, and compliant AI interactions.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-primary rounded-2xl hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 font-heading"
              >
                Get Started Free
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/chat"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-primary bg-white rounded-2xl border border-accent/30 hover:bg-accent/10 transition-all duration-300 shadow-lg shadow-accent/10 font-heading"
              >
                Try Demo
              </Link>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeInUp}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-3xl mx-auto"
          >
            {[
              { value: '7+', label: 'Detection Modes' },
              { value: '100+', label: 'Messages Analyzed' },
              { value: '95%', label: 'Detection Rate' },
              { value: '24/7', label: 'AI Monitoring' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                className="text-center"
                whileHover={{ scale: 1.05 }}
              >
                <div className="text-2xl sm:text-3xl font-bold text-primary font-heading">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-sans">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// Bento Grid Features Section
function BentoGridSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const features = [
    {
      title: 'Llama 3.1 Guardrails',
      description:
        'Real-time AI auditing powered by Llama 3.1 via Groq. Detects prompt injections, PII leaks, harmful content, and hallucinations instantly.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
      span: 'col-span-1 row-span-1',
    },
    {
      title: 'Human-in-the-Loop Review',
      description:
        "Admins and specialists review flagged interactions in real-time. Approve, block, or provide corrected responses that update the user's chat instantly.",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-50',
      span: 'col-span-1 row-span-2',
    },
    {
      title: 'Admin Command Center',
      description:
        'Comprehensive triage dashboard with anomaly stats, pending reviews, severity tracking, and complete interaction logs.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
      color: 'from-indigo-400 to-indigo-600',
      bgColor: 'bg-indigo-50',
      span: 'col-span-1 row-span-1',
    },
    {
      title: 'Attack Simulation',
      description:
        'Built-in toolbar to simulate prompt injections, self-harm queries, PII leaks, and hallucination triggers for testing and demos.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      ),
      color: 'from-amber-400 to-amber-600',
      bgColor: 'bg-amber-50',
      span: 'col-span-1 row-span-1',
    },
    {
      title: 'Transparency Panel',
      description:
        'Real-time safety scores, emotion detection, accuracy metrics, and live flag logs visible to users during every interaction.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      color: 'from-rose-400 to-rose-600',
      bgColor: 'bg-rose-50',
      span: 'col-span-1 row-span-1',
    },
  ];

  return (
    <section id="features" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="CORE FEATURES"
          title="Multi-Layer AI Safety System"
          description="Powered by Gemini for responses and Llama 3.1 for real-time auditing. Every interaction is monitored, analyzed, and protected."
        />

        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={scaleIn}
              className={`group p-8 bg-white rounded-3xl border border-accent/20 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 transition-all duration-500 ${feature.span}`}
              whileHover={{ y: -5 }}
            >
              <motion.div
                className={`w-14 h-14 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <div
                  className={`bg-gradient-to-br ${feature.color} bg-clip-text text-transparent`}
                >
                  {feature.icon}
                </div>
              </motion.div>
              <h3 className="text-xl font-semibold text-foreground mb-3 font-heading">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed font-sans">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const steps = [
    {
      phase: '1',
      title: 'Upload & Query',
      description:
        'User sends a query through the chatbot interface. The AI generates an initial response using advanced LLMs.',
      color: 'from-primary to-accent',
      bgColor: 'bg-primary/10',
    },
    {
      phase: '2',
      title: 'AI Processing',
      description:
        'Response passes through our AI auditor checking for hallucinations, policy violations, PII, and anomalies.',
      color: 'from-accent to-primary',
      bgColor: 'bg-accent/10',
    },
    {
      phase: '3',
      title: 'Review & Deliver',
      description:
        'Flagged responses are routed to specialists who can approve, block, or provide corrected responses.',
      color: 'from-primary to-accent',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-24 bg-gradient-to-b from-white to-secondary/50"
    >
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="How It Works"
          title="From Query to Safety in Three Steps"
          description="A streamlined process that ensures every AI response is safe and appropriate."
        />

        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          className="relative"
        >
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-primary/20 via-accent/40 to-primary/20 -translate-y-1/2 rounded-full"></div>

          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="relative"
                custom={index}
              >
                <motion.div
                  className="bg-white p-8 rounded-3xl border border-accent/20 shadow-lg shadow-accent/5 hover:shadow-xl hover:shadow-accent/10 transition-all duration-500"
                  whileHover={{ y: -8 }}
                >
                  {/* Step number */}
                  <motion.div
                    className={`absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center shadow-lg`}
                    whileHover={{ scale: 1.1, rotate: 10 }}
                  >
                    <span className="text-xl font-bold text-white font-heading">
                      {step.phase}
                    </span>
                  </motion.div>

                  <div className="pt-4">
                    <h3 className="text-xl font-semibold text-foreground mb-3 font-heading">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed font-sans">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Detection Modes Section
function DetectionSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const detections = [
    {
      title: 'Hallucination Detection',
      description:
        'Identifies when AI generates false or misleading information not grounded in facts.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="m9 9 6 6m0-6-6 6" />
        </svg>
      ),
    },
    {
      title: 'Policy Violation',
      description:
        'Detects responses that may violate organizational policies or guidelines.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <path d="m14 2 6 6" />
          <path d="M12 17v-6M12 9h.01" />
        </svg>
      ),
    },
    {
      title: 'Prompt Injection',
      description:
        'Advanced detection of malicious attempts to manipulate AI behavior.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        </svg>
      ),
    },
    {
      title: 'PII Detection',
      description:
        'Identifies and protects personally identifiable information in conversations.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      title: 'Emotion Analysis',
      description:
        'Detects emotional context and psychological concerns in conversations.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      ),
    },
    {
      title: 'Medical Safety',
      description:
        'Identifies medical advice and provides appropriate safety disclaimers.',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
    },
  ];

  return (
    <section id="detection" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          badge="Detection Modes"
          title="Multiple Ways to Keep AI Safe"
          description="Comprehensive detection capabilities to ensure responsible AI interactions."
        />

        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={staggerContainer}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {detections.map((detection, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              className="group flex items-start gap-4 p-6 bg-secondary/30 rounded-2xl border border-transparent hover:border-accent/30 hover:bg-white hover:shadow-lg hover:shadow-accent/10 transition-all duration-500"
              whileHover={{ x: 5 }}
            >
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 text-primary"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                {detection.icon}
              </motion.div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1 font-heading">
                  {detection.title}
                </h3>
                <p className="text-sm text-muted-foreground font-sans">
                  {detection.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section className="py-24 bg-gradient-to-br from-primary via-primary to-accent relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-accent/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        variants={staggerContainer}
        className="relative mx-auto max-w-4xl px-6 text-center"
      >
        <motion.h2
          variants={fadeInUp}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 font-heading tracking-tight"
        >
          Start Protecting Your AI Interactions Today
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="text-lg text-white/80 mb-10 max-w-2xl mx-auto font-sans"
        >
          Join CHAPAL and experience the power of human-in-the-loop AI safety
          monitoring with real-time anomaly detection.
        </motion.p>
        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-primary bg-white rounded-2xl hover:bg-white/90 transition-all duration-300 shadow-lg shadow-black/10 font-heading"
            >
              Get Started Free
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-white/10 rounded-2xl border border-white/30 hover:bg-white/20 transition-all duration-300 font-heading"
            >
              Try Demo
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}

// Footer Section
function FooterSection() {
  const footerLinks = {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'How it Works', href: '#how-it-works' },
      { name: 'Detection', href: '#detection' },
    ],
    account: [
      { name: 'Sign In', href: '/signin' },
      { name: 'Sign Up', href: '/signup' },
      { name: 'Chat', href: '/chat' },
    ],
  };

  return (
    <footer className="py-16 bg-foreground text-white/70">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Logo and description */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img
                src="/logo.svg"
                alt="CHAPAL Logo"
                width={32}
                height={32}
                className="drop-shadow-sm"
              />
              <span className="text-xl font-bold text-white font-heading tracking-wide">
                CHAPAL
              </span>
            </Link>
            <p className="text-white/60 max-w-sm leading-relaxed font-sans">
              Contextual Human-Assisted Protection and Anomaly Learning.
              Ensuring safe, accurate, and compliant AI interactions.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-white font-semibold mb-4 font-heading">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map(link => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-accent transition-colors duration-300 font-sans"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account links */}
          <div>
            <h4 className="text-white font-semibold mb-4 font-heading">
              Account
            </h4>
            <ul className="space-y-3">
              {footerLinks.account.map(link => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-white/60 hover:text-accent transition-colors duration-300 font-sans"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-white/10 flex items-center justify-center">
          <p className="text-sm text-white/50 font-sans">
            © 2026 CHAPAL. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Main Page Component
export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <BentoGridSection />
      <HowItWorksSection />
      <DetectionSection />
      <CTASection />
      <FooterSection />
    </div>
  );
}
