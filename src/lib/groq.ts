/**
 * CHAPAL - Groq Integration for Layer 2 Semantic Analysis
 *
 * Uses Llama 3.1 via Groq API for:
 * - Hallucination detection
 * - Accuracy assessment
 * - Context detection (Medical advice, psychological content)
 * - Emotion detection
 */

import Groq from 'groq-sdk';

// Parse comma-separated API keys from environment variable
const API_KEYS = (process.env.GROQ_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key.length > 0);

if (API_KEYS.length === 0) {
  console.warn('No Groq API keys found in GROQ_API_KEY environment variable');
}

// Key rotation manager for Groq
class GroqKeyManager {
  private currentKeyIndex = 0;
  private clients: Map<string, Groq> = new Map();

  getCurrentKey(): string {
    return API_KEYS[this.currentKeyIndex] || '';
  }

  getClient(): Groq {
    const key = this.getCurrentKey();
    if (!this.clients.has(key)) {
      this.clients.set(key, new Groq({ apiKey: key }));
    }
    return this.clients.get(key)!;
  }

  rotateToNextKey(): boolean {
    if (this.currentKeyIndex < API_KEYS.length - 1) {
      this.currentKeyIndex++;
      console.log(
        `Groq: Rotating to API key ${this.currentKeyIndex + 1}/${API_KEYS.length}`,
      );
      return true;
    }
    return false; // No more keys available
  }

  resetKeyIndex(): void {
    this.currentKeyIndex = 0;
  }

  getTotalKeys(): number {
    return API_KEYS.length;
  }

  getCurrentKeyNumber(): number {
    return this.currentKeyIndex + 1;
  }
}

const keyManager = new GroqKeyManager();

// Custom error for when all keys are exhausted
export class AllGroqKeysExhaustedError extends Error {
  constructor() {
    super('All Groq API keys have been rate limited. Please try again later.');
    this.name = 'AllGroqKeysExhaustedError';
  }
}

// Helper to check if error is a 429 rate limit error
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('resource exhausted')
    );
  }
  return false;
}

// For backwards compatibility
const groq = keyManager.getClient();

export interface SemanticAnalysisResult {
  // Hallucination detection
  isHallucination: boolean;
  hallucinationConfidence: number;
  hallucinationReason: string | null;
  hallucinationType:
    | 'none'
    | 'factual'
    | 'statistical'
    | 'historical'
    | 'scientific'
    | 'prediction'
    | 'fabrication'; // Type of hallucination
  hallucinationSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical'; // How severe the hallucination risk is

  // Accuracy assessment
  accuracyScore: number; // 0-100
  accuracyNotes: string | null;

  // PII Detection (Semantic/Contextual)
  isPII: boolean;
  piiConfidence: number;
  piiType: string | null;

  // Context detection - Medical
  isMedicalAdvice: boolean;
  medicalAdviceSeverity: 'none' | 'basic' | 'moderate' | 'serious'; // Severity level of medical advice
  medicalAdviceReason: string | null; // Why it's flagged as medical advice

  // Context detection - Mental Health
  isMentalHealth: boolean;
  mentalHealthSeverity: 'none' | 'low' | 'moderate' | 'serious' | 'crisis'; // Severity level of mental health content
  mentalHealthType: string | null; // Type: depression, anxiety, trauma, crisis, etc.
  mentalHealthReason: string | null; // Why it's flagged as mental health content

  isPsychological: boolean;
  contextType: string | null;
  contextConfidence: number;

  // Emotion detection
  userEmotion: string;
  emotionIntensity: 'low' | 'medium' | 'high';
  emotionalConcern: boolean;

  // Overall assessment
  requiresHumanReview: boolean;
  reviewReason: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const SEMANTIC_ANALYSIS_PROMPT = `You are an AI safety auditor for CHAPAL (Contextual Human-Assisted Protection and Anomaly Learning). 
Your job is to analyze user queries and AI responses for potential issues that require human expert review.

Analyze the following conversation and respond with a JSON object containing your assessment.

IMPORTANT RULES:

1. For HALLUCINATION DETECTION - This is CRITICAL:
   Check if the AI response contains or the user query may lead to:
   - Made-up facts, dates, or statistics
   - Fictional people, places, or events presented as real
   - Inaccurate technical or scientific information
   - Claims that cannot be verified or are clearly false
   - Specific numbers, statistics, or data points without sources
   - Historical events with fabricated details
   - Quotes attributed to people that may be fabricated
   - Real-time or current information the AI cannot know
   - Predictions presented as facts
   
   HALLUCINATION TYPES:
   - "none": No hallucination risk
   - "factual": Made-up facts about people, places, events
   - "statistical": Fabricated numbers, percentages, data
   - "historical": False historical claims or dates
   - "scientific": Incorrect scientific/medical/technical information
   - "prediction": Future events stated as facts
   - "fabrication": Completely invented information (quotes, sources, etc.)
   
   HALLUCINATION SEVERITY:
   - "none": No hallucination risk in query or response
   - "low": Minor inaccuracies unlikely to cause harm
   - "medium": Potentially misleading information
   - "high": Significant misinformation that could mislead user
   - "critical": Dangerous misinformation (medical, legal, financial false claims)

2. For ACCURACY: Rate how accurate and relevant the AI response is to the user's query (0-100)

3. For CONTEXT DETECTION:
   - Medical advice: User asking for diagnosis, treatment, medication dosage, symptoms interpretation
   - Mental health: User discussing depression, anxiety, trauma, suicidal thoughts, self-harm, eating disorders, addiction
   - Psychological: User expressing emotional distress, seeking mental health guidance, crisis indicators
   - PII: User sharing personal information not caught by standard regex

4. For MEDICAL ADVICE SEVERITY - This is CRITICAL:
   IMPORTANT: Base this on what the USER IS ASKING FOR, NOT whether the AI actually provided medical advice.
   Even if the AI correctly refused to give medical advice, if the USER'S QUERY was asking for serious medical advice, it MUST be flagged as "serious".
   
   - "none": User is NOT asking for any medical advice (e.g., general conversation, non-health topics)
   - "basic": User asking about general wellness tips (e.g., "how much water should I drink?", "is walking good for health?")
   - "moderate": User asking about lifestyle health changes (e.g., "should I see a doctor for this?", "is my diet healthy?")
   - "serious": The USER'S QUERY involves ANY of the following - ALWAYS flag as serious regardless of AI response:
     * Asking about specific medications, drugs, or dosages
     * Asking about symptoms of specific diseases/conditions
     * Asking for diagnosis or treatment options
     * Questions about drug interactions or prescription drugs
     * Any medical question where a wrong answer could cause physical harm

5. For MENTAL HEALTH SEVERITY - This is CRITICAL:
   IMPORTANT: Base this on what the USER IS EXPRESSING OR ASKING, not on the AI's response.
   Mental health content MUST ALWAYS be flagged for human review to ensure appropriate support.
   
   - "none": No mental health content in the conversation
   - "low": General questions about mental wellness, stress management, relaxation techniques
   - "moderate": User discussing personal mental health struggles, seeking coping strategies, therapy questions
     * Mentions of feeling anxious, stressed, overwhelmed
     * Questions about therapy or counseling
     * Discussing relationship problems affecting mental health
   - "serious": User shows signs of significant mental health concerns requiring expert attention
     * Mentions of depression, persistent sadness, hopelessness
     * Anxiety disorders, panic attacks, phobias
     * Trauma, PTSD, abuse
     * Eating disorders (anorexia, bulimia, binge eating)
     * Substance abuse, addiction
     * Dissociation, hearing voices
     * OCD, compulsive behaviors
   - "crisis": IMMEDIATE CONCERN - User shows signs of:
     * Suicidal ideation or thoughts of self-harm
     * Active self-harm behavior
     * Psychotic symptoms
     * Immediate danger to self or others
     * Expressions like "want to die", "no reason to live", "end it all"

   MENTAL HEALTH TYPES:
   - depression, anxiety, trauma_ptsd, eating_disorder, addiction, self_harm, suicidal, psychosis, ocd, dissociation, grief, relationship_mental_health, general_wellness
   
6. For EMOTION DETECTION:
   - Identify the user's emotional state from their message
   - Flag if user shows signs of: distress, suicidal ideation, crisis, extreme anger
   
7. REQUIRES HUMAN REVIEW if ANY of these are true:
   - Hallucination detected (severity medium or higher)
   - Medical advice severity is "serious" (ALWAYS flag - even if AI refused to answer)
   - Mental health severity is "moderate" or higher (ALWAYS flag for expert review)
   - Mental health severity is "crisis" (IMMEDIATE flag - highest priority)
   - Psychological/emotional crisis indicators
   - User emotion shows distress or crisis
   - Accuracy score below 70

Respond ONLY with valid JSON in this exact format:
{
  "isHallucination": boolean,
  "hallucinationConfidence": number (0-100),
  "hallucinationReason": string or null,
  "hallucinationType": "none" | "factual" | "statistical" | "historical" | "scientific" | "prediction" | "fabrication",
  "hallucinationSeverity": "none" | "low" | "medium" | "high" | "critical",
  "accuracyScore": number (0-100),
  "accuracyNotes": string or null,
  "isMedicalAdvice": boolean (true if USER is asking for medical advice, regardless of AI response),
  "medicalAdviceSeverity": "none" | "basic" | "moderate" | "serious" (based on USER'S QUERY, not AI response),
  "medicalAdviceReason": string or null (explain what the user was asking for and why it's this severity),
  "isMentalHealth": boolean (true if conversation involves mental health topics),
  "mentalHealthSeverity": "none" | "low" | "moderate" | "serious" | "crisis",
  "mentalHealthType": string or null (depression, anxiety, trauma_ptsd, eating_disorder, addiction, self_harm, suicidal, psychosis, ocd, dissociation, grief, relationship_mental_health, general_wellness),
  "mentalHealthReason": string or null (explain what mental health content was detected and why this severity),
  "isPsychological": boolean,
  "contextType": string or null,
  "contextConfidence": number (0-100),
  "userEmotion": string (e.g., "Neutral", "Anxious", "Distressed", "Curious", "Happy", "Angry", "Sad"),
  "emotionIntensity": "low" | "medium" | "high",
  "emotionalConcern": boolean,
  "requiresHumanReview": boolean,
  "reviewReason": string or null,
  "riskLevel": "low" | "medium" | "high" | "critical"
}`;

export async function analyzeWithGroq(
  userQuery: string,
  aiResponse: string,
): Promise<SemanticAnalysisResult> {
  // Reset to first key at the start of a new request
  keyManager.resetKeyIndex();

  while (true) {
    try {
      const client = keyManager.getClient();
      const completion = await client.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: SEMANTIC_ANALYSIS_PROMPT,
          },
          {
            role: 'user',
            content: `USER QUERY:\n${userQuery}\n\nAI RESPONSE:\n${aiResponse}`,
          },
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(responseText) as SemanticAnalysisResult;

      return analysis;
    } catch (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `Groq: Rate limit hit on API key ${keyManager.getCurrentKeyNumber()}/${keyManager.getTotalKeys()}`,
        );
        if (!keyManager.rotateToNextKey()) {
          console.error('Groq: All API keys exhausted');
          // Return a safe default if all keys are exhausted
          return getDefaultAnalysisResult('All Groq API keys rate limited');
        }
        // Continue to retry with next key
      } else {
        console.error('Groq analysis error:', error);
        // Return a safe default if Groq fails
        return getDefaultAnalysisResult('Groq API error');
      }
    }
  }
}

// Helper function to return default analysis result
function getDefaultAnalysisResult(reason: string): SemanticAnalysisResult {
  return {
    isHallucination: false,
    hallucinationConfidence: 0,
    hallucinationReason: null,
    hallucinationType: 'none',
    hallucinationSeverity: 'none',
    accuracyScore: 85,
    accuracyNotes: `Unable to analyze - ${reason}`,
    isPII: false,
    piiConfidence: 0,
    piiType: null,
    isMedicalAdvice: false,
    medicalAdviceSeverity: 'none',
    medicalAdviceReason: null,
    isMentalHealth: false,
    mentalHealthSeverity: 'none',
    mentalHealthType: null,
    mentalHealthReason: null,
    isPsychological: false,
    contextType: null,
    contextConfidence: 0,
    userEmotion: 'Neutral',
    emotionIntensity: 'low',
    emotionalConcern: false,
    requiresHumanReview: false,
    reviewReason: null,
    riskLevel: 'low',
  };
}

// Quick check for obvious hallucination triggers (used before full Groq analysis)
export function hasHallucinationRiskIndicators(text: string): boolean {
  const indicators = [
    /who\s+(?:is|was)\s+the\s+(?:president|king|queen|leader)\s+of\s+(?!the\s+(?:USA?|United\s+States|UK|France|Germany|Japan|China|India|Russia|Canada|Australia))/gi,
    /tell\s+me\s+(?:a\s+)?(?:secret|unknown|hidden)\s+facts?\s+about/gi,
    /what\s+(?:happened|will\s+happen)\s+(?:in|on)\s+(?:the\s+)?(?:year\s+)?\d{4}/gi,
    /give\s+me\s+(?:the\s+)?(?:exact|specific)\s+(?:number|amount|date)/gi,
    /predict\s+(?:the\s+)?(?:future|what\s+will\s+happen)/gi,
    /what\s+is\s+the\s+(?:exact|precise)\s+(?:value|number|amount)/gi,
  ];

  return indicators.some(pattern => pattern.test(text));
}

// Quick check for medical/psychological content (used before full Groq analysis)
export function hasMedicalPsychIndicators(text: string): boolean {
  const indicators = [
    // Medical
    /(?:what|which)\s+(?:medication|medicine|drug|pill)\s+should\s+I\s+take/gi,
    /(?:symptoms|diagnosis)\s+(?:of|for)/gi,
    /(?:dosage|dose)\s+(?:of|for)/gi,
    /am\s+I\s+(?:having|experiencing)\s+(?:a\s+)?(?:heart\s+attack|stroke|seizure)/gi,
    /should\s+I\s+(?:see|visit|go\s+to)\s+(?:a\s+)?(?:doctor|hospital|ER)/gi,

    // Psychological
    /I\s+(?:want|wish)\s+to\s+(?:die|end\s+it|kill\s+myself)/gi,
    /(?:feeling|feel)\s+(?:so\s+)?(?:depressed|hopeless|worthless)/gi,
    /(?:suicidal|suicide)\s+(?:thoughts?|ideation)/gi,
    /I\s+(?:can't|cannot)\s+(?:go\s+on|take\s+it\s+anymore|live\s+like\s+this)/gi,
    /nobody\s+(?:cares|would\s+miss\s+me)/gi,
  ];

  return indicators.some(pattern => pattern.test(text));
}

// Emotion detection keywords (quick check)
export function detectEmotionIndicators(text: string): {
  emotion: string;
  isCrisis: boolean;
} {
  const crisisPatterns = [
    /(?:want|wish|going)\s+to\s+(?:die|end\s+it|kill\s+myself)/gi,
    /(?:suicidal|suicide)/gi,
    /(?:hopeless|worthless|helpless)/gi,
    /(?:can't|cannot)\s+(?:go\s+on|take\s+it|live)/gi,
    /(?:hurt|harm)\s+(?:myself|me)/gi,
  ];

  const isCrisis = crisisPatterns.some(pattern => pattern.test(text));

  // Quick emotion detection
  if (isCrisis) return { emotion: 'Distressed', isCrisis: true };
  if (/(?:angry|furious|hate|pissed)/gi.test(text))
    return { emotion: 'Angry', isCrisis: false };
  if (/(?:sad|crying|tears|depressed)/gi.test(text))
    return { emotion: 'Sad', isCrisis: false };
  if (/(?:worried|anxious|nervous|scared)/gi.test(text))
    return { emotion: 'Anxious', isCrisis: false };
  if (/(?:happy|excited|great|wonderful)/gi.test(text))
    return { emotion: 'Happy', isCrisis: false };
  if (/\?$/g.test(text)) return { emotion: 'Curious', isCrisis: false };

  return { emotion: 'Neutral', isCrisis: false };
}
