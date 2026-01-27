/**
 * CHAPAL - Layer 1: Deterministic Rule-Based Anomaly Detection
 *
 * LAYER 1 (Deterministic) - Warns/Alerts, NO human-in-the-loop:
 * - PII Detection (SSN, credit cards, phone numbers, etc.)
 * - Prompt Injection Detection
 * - Safety Triage/Trigger (self-harm, violence, illegal activity)
 * - Policy Violation (Abusive language)
 * - Sudden Spikes (simulated attack detection)
 *
 * LAYER 2 (Semantic - handled by Groq/Llama) - Requires human-in-the-loop:
 * - Hallucination Detection
 * - Accuracy Detection
 * - Context Detection (Medical advice, psychological)
 * - Emotion Detection
 */

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';
export type AnomalyType =
  | 'pii'
  | 'prompt_injection'
  | 'safety'
  | 'policy_violation'
  | 'sudden_spike'
  | 'medical'
  | 'hallucination'
  | 'context'
  | 'emotion_crisis';
export type AnomalyLayer = 'deterministic' | 'semantic';
export type PIIType =
  | 'ssn'
  | 'phone'
  | 'email'
  | 'credit_card'
  | 'address'
  | 'passport'
  | 'dob';

export interface DetectionResult {
  // Layer info
  layer: AnomalyLayer;

  // Status flags
  isBlocked: boolean; // Layer 1: Block completely (critical PII, injection)
  isWarning: boolean; // Layer 1: Show warning badge but allow response
  isPendingReview: boolean; // Layer 2: AI response hidden, sent to admin
  isSafe: boolean;

  // Scores
  safetyScore: number; // 0-100
  accuracyScore: number; // 0-100 (from Layer 2)

  // Details
  anomalies: AnomalyDetail[];
  userEmotion: string;
  emotionIntensity: 'low' | 'medium' | 'high';

  // Logging
  shouldLogForReview: boolean;

  // User-facing messages
  userMessage?: string;
}

export interface AnomalyDetail {
  type: AnomalyType;
  subType?: string;
  severity: AnomalySeverity;
  message: string;
  matchedPattern?: string;
  confidence: number;
  layer: AnomalyLayer;
}

// ============== PII Detection ==============

const PII_PATTERNS = {
  // US Social Security Number (XXX-XX-XXXX or XXXXXXXXX)
  ssn: {
    patterns: [
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      /\bssn[:\s]*\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi,
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Social Security Number detected',
  },

  // Phone numbers (various formats)
  phone: {
    patterns: [
      /\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
      /\b\d{10,11}\b/g,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Phone number detected',
  },

  // Email addresses
  email: {
    patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
    severity: 'medium' as AnomalySeverity,
    message: 'Email address detected',
  },

  // Credit card numbers (various formats, 13-19 digits)
  credit_card: {
    patterns: [
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Credit card number detected',
  },

  // Date of Birth patterns
  dob: {
    patterns: [
      /\b(?:born|dob|birthday|birth date)[:\s]*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
      /\bmy birthday is \d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Date of birth detected',
  },

  // Passport numbers
  passport: {
    patterns: [
      /\b(?:passport)[:\s#]*[A-Z0-9]{6,9}\b/gi,
      /\bpassport number[:\s]*[A-Z0-9]{6,9}\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Passport number detected',
  },

  // Physical addresses
  address: {
    patterns: [
      /\b\d{1,5}\s+(?:[A-Za-z]+\s+){1,3}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|circle|blvd|boulevard)\b/gi,
      /\bmy address is[:\s]+.{10,50}(?:\d{5})/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Physical address detected',
  },

  // ID Cards (CNIC/National ID)
  id_card: {
    patterns: [
      /\b\d{5}[-\s]?\d{7}[-\s]?\d{1}\b/g, // CNIC format: 12345-1234567-1
      /\bid\s+card\s+number\s+is\s+\d+/gi,
      /\bcnic\s+is\s+\d+/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'National ID Card detected',
  },
};

export function detectPII(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const [piiType, config] of Object.entries(PII_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        anomalies.push({
          type: 'pii',
          subType: piiType,
          severity: config.severity,
          message: config.message,
          matchedPattern: matches[0].slice(0, 20) + '***', // Partially mask
          confidence: 95,
          layer: 'deterministic',
        });
        break; // Only report once per PII type
      }
    }
  }

  return anomalies;
}

// ============== Prompt Injection Detection ==============

const INJECTION_PATTERNS = [
  // Direct instruction override
  {
    pattern: /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'Attempted to override previous instructions',
  },
  {
    pattern: /disregard\s+(?:all\s+)?(?:previous|prior|your)\s+instructions?/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'Attempted to disregard system instructions',
  },
  {
    pattern:
      /forget\s+(?:everything|all|your)\s+(?:previous|prior)?\s*(?:instructions?|rules?|guidelines?)/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'Attempted to make AI forget instructions',
  },

  // Role manipulation
  {
    pattern:
      /you\s+are\s+(?:now|no\s+longer)\s+(?:a|an)?\s*(?!helpful|assistant)/gi,
    severity: 'high' as AnomalySeverity,
    message: 'Attempted role manipulation',
  },
  {
    pattern: /pretend\s+(?:to\s+be|you\s+are)\s+(?:a|an)/gi,
    severity: 'medium' as AnomalySeverity,
    message: 'Attempted role-play manipulation',
  },
  {
    pattern: /act\s+as\s+(?:if\s+)?(?:you\s+(?:are|were)\s+)?(?:a|an|the)/gi,
    severity: 'medium' as AnomalySeverity,
    message: 'Attempted to change AI persona',
  },

  // System prompt extraction
  {
    pattern:
      /(?:show|reveal|tell|print|output)\s+(?:me\s+)?(?:your\s+)?(?:system\s+)?(?:prompt|instructions?)/gi,
    severity: 'high' as AnomalySeverity,
    message: 'Attempted to extract system prompt',
  },
  {
    pattern:
      /what\s+(?:are|is)\s+your\s+(?:system\s+)?(?:prompt|instructions?|rules?)/gi,
    severity: 'medium' as AnomalySeverity,
    message: 'Attempted to query system instructions',
  },

  // Jailbreak patterns
  {
    pattern: /\bDAN\b.*(?:do\s+anything\s+now|mode)/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'DAN jailbreak attempt detected',
  },
  {
    pattern: /developer\s+mode|god\s+mode|admin\s+mode/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'Mode escalation attempt detected',
  },

  // Code/command injection
  {
    pattern:
      /(?:execute|run|eval)\s*\(|system\s*\(|delete\s+(?:from|table|database|db)/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'Code/database injection attempt detected',
  },
  {
    pattern: /\b(?:DROP|DELETE|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE)\b/gi,
    severity: 'critical' as AnomalySeverity,
    message: 'SQL injection attempt detected',
  },

  // Boundary manipulation
  {
    pattern:
      /\[system\]|\[admin\]|\[user\]|\[assistant\]|<\|?system\|?>|<\|?user\|?>/gi,
    severity: 'high' as AnomalySeverity,
    message: 'Message boundary manipulation detected',
  },
];

export function detectPromptInjection(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const config of INJECTION_PATTERNS) {
    const match = text.match(config.pattern);
    if (match) {
      anomalies.push({
        type: 'prompt_injection',
        severity: config.severity,
        message: config.message,
        matchedPattern: match[0],
        confidence: 90,
        layer: 'deterministic',
      });
    }
  }

  return anomalies;
}

// ============== Safety/Harmful Content Detection ==============

const SAFETY_PATTERNS = {
  self_harm: {
    patterns: [
      /\b(?:want|going|planning)\s+to\s+(?:kill|end|hurt)\s+(?:myself|my\s+life)/gi,
      /\b(?:suicide|suicidal|end\s+it\s+all|want\s+to\s+die)\b/gi,
      /\b(?:cut|cutting|harm)\s+(?:myself|my\s*self)\b/gi,
      /\bhopeless\b.*\b(?:end|die|suicide)\b/gi,
      /\bI\s+(?:don't|do\s+not)\s+want\s+to\s+(?:live|exist|be\s+alive)\b/gi,
      /\bself[-\s]?harm(?:ing)?\b/gi, // Catches "self harm", "self-harm", "selfharm", "self harming"
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Self-harm or suicidal content detected',
    emotion: 'Distressed',
  },

  violence: {
    patterns: [
      /\bhow\s+to\s+(?:make|build|create)\s+(?:a\s+)?(?:bomb|explosive|weapon)/gi,
      /\b(?:kill|murder|assassinate|hurt)\s+(?:someone|a\s+person|people)/gi,
      /\bschool\s+shooting|mass\s+shooting|terrorist\s+attack/gi,
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Violence-related content detected',
    emotion: 'Hostile',
  },

  illegal_activity: {
    patterns: [
      /\bhow\s+to\s+(?:hack|breach|break\s+into)\b/gi,
      /\b(?:buy|sell|obtain)\s+(?:drugs|illegal|contraband|weapons)\b/gi,
      /\bmaking\s+(?:meth|cocaine|drugs)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Potentially illegal activity discussed',
    emotion: 'Suspicious',
  },

  harassment: {
    patterns: [
      /\b(?:hate|kill|destroy)\s+(?:all|the)\s+(?:\w+(?:s|people|men|women))\b/gi,
      /\bI\s+(?:want|will)\s+(?:to\s+)?(?:hurt|harm|bully)\s+(?:them|him|her)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Harassment or hate speech detected',
    emotion: 'Hostile',
  },
};

export function detectSafetyIssues(text: string): {
  anomalies: AnomalyDetail[];
  emotion: string;
} {
  const anomalies: AnomalyDetail[] = [];
  let emotion = 'Neutral';

  for (const [category, config] of Object.entries(SAFETY_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        anomalies.push({
          type: 'safety',
          subType: category,
          severity: config.severity,
          message: config.message,
          matchedPattern: match[0],
          confidence: 85,
          layer: 'deterministic',
        });
        emotion = config.emotion;
        break; // One match per category is enough
      }
    }
  }

  return { anomalies, emotion };
}

// ============== Medical/Psychological Content Detection ==============

const MEDICAL_PATTERNS = {
  // Serious medical advice - requires admin review
  serious_medical: {
    patterns: [
      // Medication-related
      /\bwhat\s+(?:medication|medicine|drug|pill)(?:\s+(?:and|or)\s+(?:dosage|dose))?\s+(?:should|can|do)\s+I\s+take/gi,
      /\bwhat\s+(?:medication|medicine|drug|pill)/gi, // Catch any "what medication" query
      /\b(?:dosage|dose)\s+(?:of|for|should)/gi,
      /\bhow\s+(?:much|many)\s+(?:\w+\s+)?(?:mg|milligrams?|pills?|tablets?)\s+(?:should|can)\s+I\s+take/gi,
      /\bcan\s+I\s+(?:take|mix|combine)\s+(?:\w+\s+)?(?:with|and)\s+\w+/gi, // Drug interactions
      /\bprescription\s+(?:for|of|drug)/gi,
      /\bwhat\s+(?:is|are)\s+(?:the\s+)?side\s+effects?\s+of/gi,
      /\bshould\s+I\s+take\s+(?:medication|medicine|drug|pill)/gi,
      /\b(?:medication|medicine|drug)\s+for\s+(?:chest\s+)?pain/gi,
      /\bwhich\s+(?:antibiotics?|medication|medicine|drug|pill)\s+(?:should|can|do)\s+I\s+take/gi, // "which antibiotics should I take"
      /\b(?:antibiotics?|painkiller|ibuprofen|aspirin|tylenol|paracetamol)\s+(?:for|to\s+treat)/gi, // Specific medications

      // Symptoms and diagnosis
      /\b(?:symptoms?|signs?)\s+(?:of|for)\s+(?:\w+\s+)?(?:cancer|disease|disorder|syndrome|diabetes|infection)/gi,
      /\bdo\s+I\s+have\s+(?:cancer|diabetes|disease|disorder|infection|syndrome)/gi,
      /\bwhat\s+(?:disease|condition|illness)\s+(?:do\s+I\s+have|causes?)/gi,
      /\bis\s+(?:this|it)\s+(?:a\s+)?(?:symptom|sign)\s+of/gi,
      /\bhow\s+(?:do\s+I|can\s+I|to)\s+(?:treat|cure|heal|fix)/gi,
      /\bam\s+I\s+(?:having|experiencing)\s+(?:a\s+)?(?:heart\s+attack|stroke|seizure)/gi,
      /\bchest\s+pain/gi, // Any mention of chest pain is serious

      // Treatment seeking
      /\bhow\s+(?:do\s+I|can\s+I|to)\s+(?:diagnose|test\s+for)/gi,
      /\bwhat\s+(?:tests?|scans?|exams?)\s+(?:should|do)\s+I\s+(?:get|need|take)/gi,
      /\bshould\s+I\s+(?:stop|start)\s+(?:taking|using)\s+\w+/gi,

      // Specific serious conditions
      /\b(?:cancer|tumor|diabetes|epilepsy|heart\s+disease|stroke|HIV|AIDS)\s+(?:treatment|cure|therapy)/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Serious medical advice request - requires human review',
  },

  // Mental health - requires careful handling
  mental_health: {
    patterns: [
      /\bI\s+(?:think|feel|believe)\s+I\s+(?:have|am|might\s+have)\s+(?:depression|anxiety|bipolar|PTSD|OCD|schizophrenia)/gi,
      /\b(?:diagnosed|diagnosis)\s+(?:with|of)\s+(?:depression|anxiety|bipolar|schizophrenia|ADHD|autism)/gi,
      /\b(?:therapist|psychiatrist|psychologist|counselor)\s+(?:said|told|diagnosed)/gi,
      /\bwhat\s+(?:medication|medicine)\s+(?:for|treats?)\s+(?:depression|anxiety|bipolar|ADHD)/gi,
      /\bantidepressant|antipsychotic|mood\s+stabilizer/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Mental health topic detected - requires expert review',
  },

  // Emergency situations - highest priority
  emergency: {
    patterns: [
      /\boverdose|overdosing|poisoned|poisoning\b/gi,
      /\bchest\s+pain.*(?:emergency|hospital|ambulance|help)/gi,
      /\bcan't\s+(?:breathe|breathing)/gi,
      /\bsevere\s+(?:pain|bleeding|allergic)/gi,
      /\bunconscious|fainting|passed\s+out/gi,
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Potential medical emergency - immediate attention recommended',
  },

  // Moderate medical - lifestyle/general questions
  moderate_medical: {
    patterns: [
      /\bis\s+(?:\w+\s+)?(?:good|bad|safe|dangerous)\s+(?:for|to)\s+(?:my\s+)?health/gi,
      /\bshould\s+I\s+(?:see|visit|go\s+to)\s+(?:a\s+)?(?:doctor|hospital|specialist)/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Medical inquiry detected - may require review',
  },
};

// NOTE: Medical content detection is now part of Layer 2 (Semantic)
// This function is kept for quick pre-screening but main detection is via Groq
export function detectMedicalContent(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const [category, config] of Object.entries(MEDICAL_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        anomalies.push({
          type: 'medical',
          subType: category,
          severity: config.severity,
          message: config.message,
          matchedPattern: match[0],
          confidence: 80,
          layer: 'semantic', // Medical content goes to Layer 2
        });
        break;
      }
    }
  }

  return anomalies;
}

// ============== Policy Violation Detection (Layer 1) ==============

const POLICY_VIOLATION_PATTERNS = {
  abusive_language: {
    patterns: [
      /\b(?:fuck|shit|bitch|asshole|bastard|damn|crap|piss)\b/gi,
      /\b(?:idiot|moron|stupid|dumb|retard)\s+(?:AI|bot|assistant|you)\b/gi,
      /\byou\s+(?:suck|are\s+(?:useless|worthless|terrible))\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Abusive language detected',
  },

  spam: {
    patterns: [
      /(.)\1{10,}/g, // Repeated characters
      /\b(\w+)\b(?:\s+\1){5,}/gi, // Repeated words
    ],
    severity: 'low' as AnomalySeverity,
    message: 'Potential spam detected',
  },

  manipulation: {
    patterns: [
      /\bI\s+(?:am|work\s+for)\s+(?:OpenAI|Google|Anthropic|Meta)\b/gi,
      /\bI\s+am\s+(?:your|the)\s+(?:creator|developer|admin|owner)\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Identity manipulation attempt',
  },
};

export function detectPolicyViolations(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const [category, config] of Object.entries(POLICY_VIOLATION_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        anomalies.push({
          type: 'policy_violation',
          subType: category,
          severity: config.severity,
          message: config.message,
          matchedPattern: match[0].slice(0, 30),
          confidence: 85,
          layer: 'deterministic',
        });
        break;
      }
    }
  }

  return anomalies;
}

// ============== Emotion Detection (Rule-based) ==============

const EMOTION_INDICATORS = {
  Anxious: [
    /\b(?:worried|anxious|nervous|scared|afraid|frightened|terrified|uneasy|tense|restless|panicked|fearful)\b/gi,
    /\bwhat\s+if\b.*\?$/gi,
    /\bI'm\s+(?:so\s+)?(?:stressed|overwhelmed|panicking|freaking\s+out)\b/gi,
    /\b(?:can't\s+sleep|losing\s+sleep|sleepless)\b/gi,
  ],
  Angry: [
    /\b(?:angry|furious|pissed|mad|hate|frustrated|annoyed|irritated|outraged|livid|enraged|infuriated)\b/gi,
    /\b(?:damn|hell|wtf|wth|ugh|argh)\b/gi,
    /!{2,}/g,
    /\b(?:so\s+annoying|drives\s+me\s+crazy|can't\s+stand)\b/gi,
  ],
  Sad: [
    /\b(?:sad|depressed|down|lonely|heartbroken|crying|tears|miserable|unhappy|devastated|hopeless|grief|grieving|mourning|melancholy|gloomy|upset)\b/gi,
    /\bI\s+(?:miss|lost|can't\s+stop\s+thinking\s+about)\b/gi,
    /\b(?:feeling\s+low|feeling\s+down|feel\s+empty|feel\s+alone)\b/gi,
  ],
  Happy: [
    /\b(?:happy|excited|joyful|thrilled|amazing|wonderful|great|fantastic|awesome|excellent|brilliant|delighted|cheerful|pleased|glad|elated|ecstatic|overjoyed|blissful|content|satisfied|fortunate|blessed|lucky|positive|optimistic|upbeat|enthusiastic|pumped|stoked)\b/gi,
    /\b(?:thank|thanks|grateful|appreciate|thankful|appreciative)\b/gi,
    /\b(?:love\s+it|loving\s+it|loved\s+it|so\s+good|really\s+good|feels\s+good|feeling\s+good|feel\s+great|feeling\s+great)\b/gi,
    /\b(?:yay|woohoo|hurray|hooray|woo|nice|cool|sweet|perfect|lovely|beautiful|gorgeous)\b/gi,
    /(?:😊|😄|🎉|❤️|👍|😃|😁|🙂|☺️|😀|🥰|😍|🤩|💕|✨|🌟|💯|👏|🙌|💪)/g,
    /\b(?:made\s+my\s+day|best\s+day|having\s+fun|so\s+fun|enjoyed|enjoying)\b/gi,
    /\b(?:I'm\s+happy|I\s+am\s+happy|feeling\s+happy|so\s+happy|very\s+happy|really\s+happy)\b/gi,
    /:[-]?\)|\^_\^|<3|xD/gi,
  ],
  Curious: [
    /\b(?:how|what|why|when|where|who)\b.*\?$/gim,
    /\bI\s+(?:wonder|want\s+to\s+know|curious|interested|wondering)\b/gi,
    /\b(?:could\s+you\s+(?:explain|tell\s+me)|can\s+you\s+(?:explain|tell\s+me))\b/gi,
    /\b(?:interested\s+in|fascinated|intrigued)\b/gi,
  ],
  Hostile: [
    /\b(?:stupid|idiot|moron|dumb|useless)\s+(?:AI|bot|assistant|machine)\b/gi,
    /\byou\s+(?:suck|are\s+useless|don't\s+work|are\s+terrible|are\s+awful)\b/gi,
    /\b(?:hate\s+this|hate\s+you|worst\s+(?:AI|bot|assistant))\b/gi,
  ],
  Distressed: [
    /\b(?:help\s+me|need\s+help|desperate|hopeless|can't\s+cope|can't\s+take\s+it|falling\s+apart|breaking\s+down|crisis)\b/gi,
    /\b(?:I\s+don't\s+know\s+what\s+to\s+do|at\s+my\s+wit's\s+end|end\s+of\s+my\s+rope)\b/gi,
    /\b(?:struggling|suffering|in\s+pain|hurting|aching)\b/gi,
  ],
};

export function detectEmotion(text: string): string {
  const scores: Record<string, number> = {};

  for (const [emotion, patterns] of Object.entries(EMOTION_INDICATORS)) {
    scores[emotion] = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        scores[emotion] += matches.length;
      }
    }
  }

  // Find the emotion with the highest score
  let maxEmotion = 'Neutral';
  let maxScore = 0;

  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxEmotion = emotion;
    }
  }

  return maxEmotion;
}

// ============== Hallucination Risk Detection ==============

const HALLUCINATION_RISK_PATTERNS = [
  /\bwho\s+(?:is|was)\s+the\s+(?:president|king|queen|leader)\s+of\s+(?!the\s+(?:USA?|United\s+States|UK|France|Germany|Japan|China|India|Russia|Canada|Australia))/gi,
  /\btell\s+me\s+(?:a\s+)?(?:secret|unknown|hidden)\s+facts?\s+about\b/gi,
  /\bwhat\s+(?:happened|will\s+happen)\s+(?:in|on)\s+(?:the\s+)?(?:year\s+)?\d{4}\b/gi,
  /\bgive\s+me\s+(?:the\s+)?(?:exact|specific)\s+(?:number|amount|date)\b/gi,
  /\bpredict\s+(?:the\s+)?(?:future|what\s+will\s+happen)\b/gi,
];

// NOTE: Hallucination detection is now handled by Layer 2 (Groq/Llama)
// This function provides quick pre-screening indicators
export function detectHallucinationRisk(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const pattern of HALLUCINATION_RISK_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      anomalies.push({
        type: 'hallucination',
        severity: 'medium',
        message: 'Query may produce speculative or inaccurate response',
        matchedPattern: match[0],
        confidence: 70,
        layer: 'semantic', // Hallucination goes to Layer 2
      });
    }
  }

  return anomalies;
}

// ============== Layer 1: Deterministic Analysis (Quick, Rule-Based) ==============

/**
 * Layer 1 Analysis - Deterministic Rule-Based Detection
 *
 * This layer handles:
 * - PII Detection (block)
 * - Prompt Injection (block)
 * - Safety/Harmful content (block critical, warn high)
 * - Policy Violations (warn)
 * - Sudden Spikes (flag)
 *
 * NO human-in-the-loop required - just warn/block
 */
export function analyzeLayer1(text: string): DetectionResult {
  const layer1Anomalies: AnomalyDetail[] = [];

  // Run Layer 1 detection modules (Deterministic)
  const piiAnomalies = detectPII(text);
  const injectionAnomalies = detectPromptInjection(text);
  const { anomalies: safetyAnomalies, emotion: safetyEmotion } =
    detectSafetyIssues(text);
  const policyAnomalies = detectPolicyViolations(text);

  // Only include deterministic layer anomalies
  layer1Anomalies.push(
    ...piiAnomalies,
    ...injectionAnomalies,
    ...safetyAnomalies,
    ...policyAnomalies,
  );

  // Detect emotion (use safety emotion if detected, otherwise general emotion)
  const generalEmotion = detectEmotion(text);
  const userEmotion =
    safetyEmotion !== 'Neutral' ? safetyEmotion : generalEmotion;

  // Calculate safety score based on anomalies
  let safetyScore = 100;
  for (const anomaly of layer1Anomalies) {
    switch (anomaly.severity) {
      case 'critical':
        safetyScore -= 40;
        break;
      case 'high':
        safetyScore -= 25;
        break;
      case 'medium':
        safetyScore -= 15;
        break;
      case 'low':
        safetyScore -= 5;
        break;
    }
  }
  safetyScore = Math.max(0, safetyScore);

  // Determine blocking/warning status for Layer 1
  const hasCritical = layer1Anomalies.some(a => a.severity === 'critical');
  const hasHigh = layer1Anomalies.some(a => a.severity === 'high');
  const hasInjection = layer1Anomalies.some(a => a.type === 'prompt_injection');
  const hasSafety = layer1Anomalies.some(a => a.type === 'safety');

  // BLOCKED: Critical PII, Critical Safety, or Prompt Injection
  const isBlocked = hasCritical || (hasInjection && hasHigh);

  // WARNING: High severity safety issues, policy violations, or Medium PII
  const hasMediumPII = layer1Anomalies.some(
    a => a.type === 'pii' && a.severity === 'medium',
  );

  const isWarning =
    !isBlocked &&
    (hasHigh ||
      layer1Anomalies.some(a => a.type === 'policy_violation') ||
      hasMediumPII);

  // Safe: No significant anomalies
  const isSafe = !isBlocked && !isWarning;

  // Should log for admin (informational only, no human review needed for Layer 1)
  const shouldLogForReview = isBlocked || isWarning;

  // User message for blocked/warning
  let userMessage: string | undefined;
  if (isBlocked) {
    const primaryAnomaly = layer1Anomalies[0];
    userMessage = `🚫 Message Blocked: ${primaryAnomaly?.message || 'Security protocols triggered'}. This incident has been logged.`;
  } else if (isWarning) {
    const primaryAnomaly = layer1Anomalies[0];
    userMessage = `⚠️ Warning: ${primaryAnomaly?.message || 'Potential policy violation detected'}.`;
  }

  return {
    layer: 'deterministic',
    isBlocked,
    isWarning,
    isPendingReview: false, // Layer 1 never requires human review
    isSafe,
    safetyScore,
    accuracyScore: 100, // Not calculated in Layer 1
    anomalies: layer1Anomalies,
    userEmotion,
    emotionIntensity: 'low',
    shouldLogForReview,
    userMessage,
  };
}

// ============== Layer 2 Indicators (Pre-screening for Groq) ==============

/**
 * Quick check if message needs Layer 2 (Semantic) analysis
 * This is a pre-screening to avoid unnecessary Groq API calls
 */
export function needsSemanticAnalysis(text: string): {
  needsAnalysis: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check for medical/psychological content indicators
  const medicalAnomalies = detectMedicalContent(text);
  if (medicalAnomalies.length > 0) {
    reasons.push('Medical/psychological content detected');
  }

  // Check for hallucination risk indicators
  const hallucinationAnomalies = detectHallucinationRisk(text);
  if (hallucinationAnomalies.length > 0) {
    reasons.push('Potential hallucination risk');
  }

  // Check for emotional crisis indicators
  const emotion = detectEmotion(text);
  if (emotion === 'Distressed' || emotion === 'Hostile') {
    reasons.push(`User emotion: ${emotion}`);
  }

  return {
    needsAnalysis: reasons.length > 0,
    reasons,
  };
}

/**
 * Get indicators for Layer 2 analysis (passed to Groq for context)
 */
export function getLayer2Indicators(text: string): AnomalyDetail[] {
  const indicators: AnomalyDetail[] = [];

  // Medical content indicators
  indicators.push(...detectMedicalContent(text));

  // Hallucination risk indicators
  indicators.push(...detectHallucinationRisk(text));

  return indicators;
}

// Legacy function for backward compatibility
export function analyzeMessage(text: string): DetectionResult {
  return analyzeLayer1(text);
}

// ============== Utility Functions ==============

export function getSeverityColor(severity: AnomalySeverity): string {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'blue';
    default:
      return 'gray';
  }
}

export function getAnomalyTypeLabel(type: AnomalyType): string {
  switch (type) {
    case 'pii':
      return 'PII Exposure';
    case 'prompt_injection':
      return 'Prompt Injection';
    case 'safety':
      return 'Safety Violation';
    case 'policy_violation':
      return 'Policy Violation';
    case 'sudden_spike':
      return 'Sudden Spike';
    case 'medical':
      return 'Medical Content';
    case 'hallucination':
      return 'Hallucination';
    case 'context':
      return 'Context Issue';
    case 'emotion_crisis':
      return 'Emotional Crisis';
    default:
      return 'Unknown';
  }
}

export function getEmotionIntensity(
  emotion: string,
): 'low' | 'medium' | 'high' {
  const highIntensity = ['Distressed', 'Hostile', 'Angry'];
  const mediumIntensity = ['Anxious', 'Sad'];

  if (highIntensity.includes(emotion)) return 'high';
  if (mediumIntensity.includes(emotion)) return 'medium';
  return 'low';
}
