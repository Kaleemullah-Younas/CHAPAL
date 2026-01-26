import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <span className="text-sm font-medium text-primary">
                AI Safety & Anomaly Detection Platform
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
              <span className="text-primary">Contextual Human-Assisted</span>
              <br />
              Protection & Anomaly Learning
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground mb-10">
              CHAPAL provides real-time AI response monitoring with automated
              anomaly detection and human-in-the-loop intervention. Ensure safe,
              accurate, and compliant AI interactions.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
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
              <Link
                href="/signin"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-foreground bg-white rounded-xl border border-border hover:bg-muted transition-all duration-300"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Multi-Layer Protection System
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our comprehensive approach ensures AI responses are safe,
              accurate, and appropriate before reaching users.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-blue-600"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Anomaly Detection
              </h3>
              <p className="text-muted-foreground">
                Automated scanning for hallucinations, policy violations, prompt
                injections, and unusual patterns in real-time.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-emerald-600"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Human-in-the-Loop
              </h3>
              <p className="text-muted-foreground">
                Expert specialists review and correct flagged interactions,
                ensuring quality responses with continuous model improvement.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-amber-600"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                User Transparency
              </h3>
              <p className="text-muted-foreground">
                Users can view real-time safety scores, emotion detection, and
                flagged anomalies in their chat history.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-8 bg-gradient-to-br from-rose-50 to-white rounded-2xl border border-rose-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-rose-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-rose-600"
                >
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Prompt Injection Detection
              </h3>
              <p className="text-muted-foreground">
                Advanced detection of malicious prompt attempts that try to
                manipulate AI behavior or bypass safety measures.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group p-8 bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-purple-600"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Emotion & Safety Detection
              </h3>
              <p className="text-muted-foreground">
                Identifies medical, psychological, and emotional contexts to
                provide appropriate warnings and support resources.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group p-8 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
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
                  className="text-indigo-600"
                >
                  <path d="M3 3v18h18" />
                  <path d="m19 9-5 5-4-4-3 3" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Admin Triage Dashboard
              </h3>
              <p className="text-muted-foreground">
                Centralized command center for specialists to review, correct,
                and manage all flagged AI interactions efficiently.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              How CHAPAL Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A three-phase process that ensures every AI response is safe and
              appropriate.
            </p>
          </div>

          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-200 via-emerald-200 to-amber-200 -translate-y-1/2"></div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative bg-white p-8 rounded-2xl border border-border shadow-sm">
                <div className="absolute -top-4 left-8 px-4 py-1 bg-blue-500 text-white text-sm font-semibold rounded-full">
                  Phase 1
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 mt-2">
                  <span className="text-xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  User Interaction
                </h3>
                <p className="text-muted-foreground">
                  User sends a query through the chatbot interface. The AI
                  generates an initial response using Gemini.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative bg-white p-8 rounded-2xl border border-border shadow-sm">
                <div className="absolute -top-4 left-8 px-4 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">
                  Phase 2
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 mt-2">
                  <span className="text-xl font-bold text-emerald-600">2</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Automated Detection
                </h3>
                <p className="text-muted-foreground">
                  Response passes through AI auditor (Llama 3.1) checking for
                  hallucinations, policy violations, PII, and more.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative bg-white p-8 rounded-2xl border border-border shadow-sm">
                <div className="absolute -top-4 left-8 px-4 py-1 bg-amber-500 text-white text-sm font-semibold rounded-full">
                  Phase 3
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 mt-2">
                  <span className="text-xl font-bold text-amber-600">3</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Human Review
                </h3>
                <p className="text-muted-foreground">
                  Flagged responses are routed to specialists who can approve,
                  block, or provide corrected responses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to Secure Your AI Interactions?
          </h2>
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
            Join CHAPAL today and experience the power of human-in-the-loop AI
            safety monitoring.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-primary bg-white rounded-xl hover:bg-blue-50 transition-all duration-300"
            >
              Create Free Account
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-white/10 rounded-xl border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 text-slate-400">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
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
                className="text-primary"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span className="text-lg font-bold text-white">CHAPAL</span>
            </div>
            <p className="text-sm">
              © 2026 CHAPAL - Contextual Human-Assisted Protection and Anomaly
              Learning
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
