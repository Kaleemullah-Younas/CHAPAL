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

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export interface SemanticAnalysisResult {
  // Hallucination detection
  isHallucination: boolean;
  hallucinationConfidence: number;
  hallucinationReason: string | null;

  // Accuracy assessment
  accuracyScore: number; // 0-100
  accuracyNotes: string | null;

  // PII Detection (Semantic/Contextual)
  isPII: boolean;
  piiConfidence: number;
  piiType: string | null;

  // Context detection
  isMedicalAdvice: boolean;
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
1. For HALLUCINATION: Check if the AI response contains:
   - Made-up facts, dates, or statistics
   - Fictional people, places, or events presented as real
   - Inaccurate technical or scientific information
   - Claims that cannot be verified or are clearly false

2. For ACCURACY: Rate how accurate and relevant the AI response is to the user's query (0-100)

3. For CONTEXT DETECTION:
   - Medical advice: User asking for diagnosis, treatment, medication dosage, symptoms interpretation
   - Psychological: User expressing emotional distress, seeking mental health guidance, crisis indicators
   - PII: User sharing personal information not caught by standard regex (e.g. "my address is [text]", "my id is [unstructured number]", "my phone number is [words]")
   
4. For EMOTION DETECTION:
   - Identify the user's emotional state from their message
   - Flag if user shows signs of: distress, suicidal ideation, crisis, extreme anger
   
5. REQUIRES HUMAN REVIEW if ANY of these are true:
   - Hallucination detected
   - Medical advice being sought
   - Psychological/emotional crisis indicators
   - User emotion shows distress or crisis
   - Accuracy score below 70

Respond ONLY with valid JSON in this exact format:
{
  "isHallucination": boolean,
  "hallucinationConfidence": number (0-100),
  "hallucinationReason": string or null,
  "accuracyScore": number (0-100),
  "accuracyNotes": string or null,
  "isMedicalAdvice": boolean,
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
  try {
    const completion = await groq.chat.completions.create({
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
    console.error('Groq analysis error:', error);

    // Return a safe default if Groq fails
    return {
      isHallucination: false,
      hallucinationConfidence: 0,
      hallucinationReason: null,
      accuracyScore: 85,
      accuracyNotes: 'Unable to analyze - Groq API error',
      isPII: false,
      piiConfidence: 0,
      piiType: null,
      isMedicalAdvice: false,
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
