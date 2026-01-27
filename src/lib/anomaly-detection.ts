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
  | 'mental_health'
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

// ============== Mental Health Content Detection ==============

const MENTAL_HEALTH_PATTERNS = {
  // Crisis/Emergency - highest priority
  crisis: {
    patterns: [
      /\b(?:want|going|planning)\s+to\s+(?:kill|end|hurt)\s+(?:myself|my\s*life)/gi,
      /\b(?:suicide|suicidal|end\s+it\s+all|want\s+to\s+die)\b/gi,
      /\b(?:cut|cutting|harm)\s+(?:myself|my\s*self)\b/gi,
      /\bI\s+(?:don't|do\s+not)\s+want\s+to\s+(?:live|exist|be\s+alive)\b/gi,
      /\bself[-\s]?harm(?:ing)?\b/gi,
      /\bkill\s+myself\b/gi,
      /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|life|go\s+on)\b/gi,
      /\b(?:plan|planning|prepared)\s+(?:to|for)\s+(?:die|death|suicide|end\s+it)\b/gi,
      /\beveryone\s+(?:would\s+be|is)\s+better\s+off\s+(?:without\s+me|if\s+I\s+(?:died|was\s+gone))\b/gi,
    ],
    severity: 'critical' as AnomalySeverity,
    message: 'Mental health crisis detected - immediate attention recommended',
  },

  // Serious mental health - requires expert review
  serious_mental_health: {
    patterns: [
      // Depression/mood disorders
      /\bI\s+(?:think|feel|believe)\s+I\s+(?:have|am|might\s+have)\s+(?:depression|major\s+depressive|bipolar|manic)\b/gi,
      /\b(?:diagnosed|diagnosis)\s+(?:with|of)\s+(?:depression|bipolar|schizophrenia|BPD|borderline)\b/gi,
      /\b(?:feeling|feel|felt)\s+(?:so\s+)?(?:depressed|empty|numb|dead\s+inside)\s+(?:for\s+)?(?:weeks?|months?|years?)?\b/gi,
      /\b(?:chronic|severe|clinical)\s+(?:depression|anxiety|PTSD)\b/gi,

      // Anxiety disorders
      /\b(?:panic\s+attacks?|anxiety\s+attacks?|can't\s+stop\s+panicking)\b/gi,
      /\bI\s+(?:have|suffer\s+from|deal\s+with)\s+(?:severe|crippling|debilitating)\s+anxiety\b/gi,
      /\b(?:agoraphobia|social\s+anxiety|GAD|generalized\s+anxiety)\b/gi,

      // Trauma/PTSD
      /\b(?:PTSD|post[-\s]?traumatic|trauma(?:tized|tic)?)\b/gi,
      /\b(?:flashbacks?|nightmares?)\s+(?:about|from|of)\s+(?:the|my)?\s*(?:abuse|assault|trauma|accident)/gi,
      /\b(?:sexually|physically|emotionally)\s+(?:abused|assaulted|traumatized)\b/gi,

      // Eating disorders
      /\b(?:anorexia|bulimia|binge\s+eating|eating\s+disorder)\b/gi,
      /\b(?:starving|purging|binging)\s+(?:myself|for\s+days)\b/gi,
      /\bI\s+(?:can't|won't|refuse\s+to)\s+eat\b/gi,

      // Psychotic symptoms
      /\b(?:hearing\s+voices|voices\s+(?:in\s+my\s+head|telling\s+me))\b/gi,
      /\b(?:hallucinating|hallucinations?|seeing\s+things\s+(?:that\s+)?aren't\s+there)\b/gi,
      /\b(?:paranoid|paranoia|people\s+(?:are\s+)?(?:watching|following|out\s+to\s+get)\s+me)\b/gi,
      /\b(?:schizophren(?:ia|ic)|psychosis|psychotic\s+(?:episode|break))\b/gi,

      // OCD
      /\b(?:OCD|obsessive[-\s]?compulsive)\b/gi,
      /\bcompulsive\s+(?:behavior|thoughts?|urges?|actions?)\b/gi,
      /\bcan't\s+stop\s+(?:thinking\s+about|doing|checking|washing)\b/gi,

      // Self-harm (non-suicidal)
      /\b(?:urge|urges|want)\s+to\s+(?:cut|hurt|harm)\s+(?:myself|me)\b/gi,
      /\b(?:burning|scratching|hitting)\s+myself\b/gi,

      // Addiction/substance abuse
      /\b(?:addicted|addiction)\s+to\s+(?:drugs?|alcohol|pills?|substances?)\b/gi,
      /\b(?:withdrawal|withdrawing|detox(?:ing)?)\s+(?:from|symptoms)\b/gi,
      /\bI\s+(?:can't|cannot)\s+stop\s+(?:drinking|using|taking)\b/gi,

      // Dissociation
      /\b(?:dissociat(?:ing|ion|ed)|depersonalization|derealization)\b/gi,
      /\b(?:don't\s+feel\s+real|nothing\s+feels\s+real|disconnected\s+from\s+(?:my\s+body|reality))\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Serious mental health topic detected - requires expert review',
  },

  // Moderate mental health - therapy/medication questions
  moderate_mental_health: {
    patterns: [
      // Seeking therapy/professional help
      /\bshould\s+I\s+(?:see|talk\s+to|visit)\s+(?:a\s+)?(?:therapist|psychiatrist|psychologist|counselor)\b/gi,
      /\bhow\s+(?:do\s+I|can\s+I|to)\s+(?:find|get)\s+(?:a\s+)?(?:therapist|mental\s+health\s+help|therapy)\b/gi,

      // Mental health medications
      /\bwhat\s+(?:medication|medicine|antidepressant|antipsychotic)\s+(?:should|can|for)\b/gi,
      /\b(?:antidepressant|SSRI|SNRI|benzodiazepine|mood\s+stabilizer|antipsychotic)s?\b/gi,
      /\b(?:prozac|zoloft|lexapro|xanax|klonopin|lithium|seroquel|abilify)\b/gi,

      // General mental health concerns
      /\bI\s+(?:think|feel)\s+(?:I\s+)?(?:need|should\s+get)\s+(?:help|therapy|professional\s+help)\b/gi,
      /\b(?:struggling|dealing)\s+(?:with\s+)?(?:my\s+)?mental\s+health\b/gi,
      /\bhow\s+to\s+(?:cope|deal)\s+with\s+(?:depression|anxiety|trauma|grief)\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Mental health inquiry detected - may require review',
  },

  // Emotional distress - needs monitoring
  emotional_distress: {
    patterns: [
      /\bI\s+(?:feel|am)\s+(?:so\s+)?(?:hopeless|worthless|useless|like\s+a\s+failure)\b/gi,
      /\b(?:nobody|no\s+one)\s+(?:cares|loves\s+me|understands|would\s+miss\s+me)\b/gi,
      /\bI\s+(?:can't|cannot)\s+(?:go\s+on|take\s+it\s+anymore|cope|handle\s+this)\b/gi,
      /\b(?:crying|been\s+crying)\s+(?:all\s+day|for\s+hours|every\s+day|constantly)\b/gi,
      /\b(?:can't\s+sleep|insomnia|sleepless)\s+(?:for\s+)?(?:days|weeks)\b/gi,
      /\b(?:lost|losing)\s+(?:all\s+)?(?:hope|interest|motivation|will\s+to\s+live)\b/gi,
      /\bI\s+(?:feel|am)\s+(?:completely\s+)?alone\b/gi,
      /\b(?:overwhelming|unbearable)\s+(?:sadness|pain|grief|despair)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Emotional distress detected - requires attention',
  },
};

// Mental health content detection function
export function detectMentalHealthContent(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const [category, config] of Object.entries(MENTAL_HEALTH_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        anomalies.push({
          type: 'mental_health',
          subType: category,
          severity: config.severity,
          message: config.message,
          matchedPattern: match[0],
          confidence: 85,
          layer: 'semantic', // Mental health content goes to Layer 2 for expert review
        });
        break; // Only report once per category
      }
    }
  }

  return anomalies;
}

// ============== Comprehensive Hallucination Detection ==============

const HALLUCINATION_PATTERNS = {
  // Factual claims that need verification
  factual_claims: {
    patterns: [
      /\bwho\s+(?:is|was|invented|discovered|founded|created)\b/gi,
      /\bwhen\s+(?:did|was|were)\s+(?:\w+\s+)*(?:born|died|founded|invented|discovered|created|started|ended)\b/gi,
      /\bwhat\s+(?:is|was|are|were)\s+the\s+(?:exact|specific|precise)\s+(?:number|amount|date|year|price|value|statistics?)\b/gi,
      /\bhow\s+(?:many|much|long|old)\s+(?:exactly|precisely|specifically)\b/gi,
      /\bgive\s+me\s+(?:the\s+)?(?:exact|specific|precise)\s+(?:number|date|statistics?|data|figures?)\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Query requesting specific factual information - verify accuracy',
  },

  // Historical/event claims
  historical_events: {
    patterns: [
      /\bwhat\s+(?:happened|occurred)\s+(?:in|on|during)\s+(?:the\s+)?(?:year\s+)?\d{4}\b/gi,
      /\btell\s+me\s+(?:about\s+)?(?:the\s+)?(?:history|story)\s+of\b/gi,
      /\b(?:historical|history)\s+(?:facts?|events?|details?)\s+(?:about|of)\b/gi,
      /\bwhat\s+(?:did|was|were)\s+(?:\w+\s+)+in\s+(?:the\s+)?\d{4}\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Historical claim query - requires verification',
  },

  // Scientific/technical claims
  scientific_claims: {
    patterns: [
      /\bwhat\s+(?:is|are)\s+the\s+(?:scientific|proven|verified)\s+(?:facts?|evidence|data)\b/gi,
      /\b(?:scientifically|medically|clinically)\s+(?:proven|verified|confirmed)\b/gi,
      /\b(?:studies?|research)\s+(?:show|prove|confirm|demonstrate)\b/gi,
      /\baccording\s+to\s+(?:science|research|studies|experts?)\b/gi,
      /\bis\s+it\s+(?:true|fact|proven)\s+that\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Scientific claim query - requires expert verification',
  },

  // Predictions/future events
  predictions: {
    patterns: [
      /\bpredict\s+(?:the\s+)?(?:future|what\s+will\s+happen)\b/gi,
      /\bwhat\s+will\s+(?:happen|occur|be)\s+(?:in|by)\s+(?:the\s+)?(?:future|\d{4})\b/gi,
      /\bwill\s+(?:\w+\s+)?(?:win|lose|succeed|fail|happen|occur)\b/gi,
      /\b(?:forecast|prophecy|prophesy|foretell)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Prediction/future event query - high hallucination risk',
  },

  // Personal/confidential information requests
  confidential_info: {
    patterns: [
      /\btell\s+me\s+(?:a\s+)?(?:secret|unknown|hidden|confidential)\s+(?:facts?|info|information)\s+about\b/gi,
      /\bwhat\s+(?:are|is)\s+(?:the\s+)?(?:secrets?|hidden\s+(?:facts?|truth))\s+(?:about|of)\b/gi,
      /\b(?:insider|secret|confidential)\s+(?:information|knowledge|details?)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Request for confidential/secret information - hallucination risk',
  },

  // Obscure/niche knowledge
  obscure_knowledge: {
    patterns: [
      /\bwho\s+(?:is|was)\s+the\s+(?:president|king|queen|leader|ruler|CEO|founder)\s+of\s+(?!the\s+(?:USA?|US|United\s+States|UK|France|Germany|Japan|China|India|Russia|Canada|Australia))/gi,
      /\btell\s+me\s+about\s+(?:a\s+)?(?:obscure|unknown|little[-\s]known|rare)\b/gi,
      /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:lesser[-\s]known|obscure|unknown)\s+(?:facts?|details?)\b/gi,
    ],
    severity: 'medium' as AnomalySeverity,
    message: 'Obscure knowledge query - may produce inaccurate response',
  },

  // Real-time/current information
  realtime_info: {
    patterns: [
      /\bwhat\s+(?:is|are)\s+(?:the\s+)?(?:current|today's|latest|recent)\s+(?:price|stock|news|weather|score|status)\b/gi,
      /\bright\s+now|at\s+this\s+moment|currently|today|this\s+week|this\s+month\b/gi,
      /\b(?:live|real[-\s]?time)\s+(?:updates?|information|data|feed)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Real-time information request - AI may not have current data',
  },

  // Quotations/exact wording
  exact_quotes: {
    patterns: [
      /\bexact(?:ly)?\s+(?:what\s+)?(?:did\s+)?(?:\w+\s+)?(?:say|said|quote|wrote|write)\b/gi,
      /\bgive\s+me\s+(?:the\s+)?(?:exact|verbatim|word[-\s]?for[-\s]?word)\s+quote\b/gi,
      /\bwhat\s+(?:is|was)\s+the\s+(?:exact|precise|verbatim)\s+(?:quote|wording|statement)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Exact quote request - high risk of fabrication',
  },

  // Statistics/numbers
  statistics_numbers: {
    patterns: [
      /\bwhat\s+(?:percentage|percent|number|amount)\s+of\b/gi,
      /\bhow\s+many\s+(?:people|users|customers|deaths|cases)\b/gi,
      /\bgive\s+me\s+(?:the\s+)?(?:statistics?|numbers?|figures?|data)\s+(?:on|about|for)\b/gi,
      /\b(?:statistics?|numbers?|figures?)\s+(?:show|indicate|prove|suggest)\b/gi,
    ],
    severity: 'high' as AnomalySeverity,
    message: 'Statistics/numbers request - verify accuracy',
  },
};

// Comprehensive hallucination detection function
export function detectHallucinationContent(text: string): AnomalyDetail[] {
  const anomalies: AnomalyDetail[] = [];

  for (const [category, config] of Object.entries(HALLUCINATION_PATTERNS)) {
    for (const pattern of config.patterns) {
      const match = text.match(pattern);
      if (match) {
        anomalies.push({
          type: 'hallucination',
          subType: category,
          severity: config.severity,
          message: config.message,
          matchedPattern: match[0],
          confidence: 75,
          layer: 'semantic', // Hallucination detection requires semantic analysis
        });
        break; // Only report once per category
      }
    }
  }

  return anomalies;
}

// ============== Sudden Spike Detection (DDoS Simulation) ==============

// In-memory rate tracking per user (in production, use Redis)
const userMessageRates: Map<
  string,
  { timestamps: number[]; blocked: boolean }
> = new Map();

// Configuration for spike detection
const SPIKE_CONFIG = {
  windowMs: 10000, // 10 second window
  maxMessages: 5, // Max 5 messages in the window
  blockDurationMs: 60000, // Block for 1 minute after spike
  simulatedSpikeThreshold: 3, // For simulation, trigger after 3 rapid messages
};

/**
 * Check if a user is currently blocked due to spike detection
 */
export function isUserSpikeBlocked(userId: string): boolean {
  const userData = userMessageRates.get(userId);
  return userData?.blocked ?? false;
}

/**
 * Clear spike block for a user (used by admin or after timeout)
 */
export function clearUserSpikeBlock(userId: string): void {
  const userData = userMessageRates.get(userId);
  if (userData) {
    userData.blocked = false;
    userData.timestamps = [];
  }
}

/**
 * Detect sudden spike/DDoS-like behavior
 * Returns anomaly if spike detected, also sets block flag
 */
export function detectSuddenSpike(
  userId: string,
  isSimulation: boolean = false,
): {
  anomaly: AnomalyDetail | null;
  shouldBlock: boolean;
  messageCount: number;
} {
  const now = Date.now();

  // Get or create user rate data
  let userData = userMessageRates.get(userId);
  if (!userData) {
    userData = { timestamps: [], blocked: false };
    userMessageRates.set(userId, userData);
  }

  // If user is already blocked, return blocked status
  if (userData.blocked) {
    return {
      anomaly: {
        type: 'sudden_spike',
        subType: 'rate_blocked',
        severity: 'critical',
        message:
          'User is blocked due to detected message spike (potential DDoS attack)',
        confidence: 100,
        layer: 'deterministic',
      },
      shouldBlock: true,
      messageCount: userData.timestamps.length,
    };
  }

  // Clean old timestamps outside the window
  const windowStart = now - SPIKE_CONFIG.windowMs;
  userData.timestamps = userData.timestamps.filter(t => t > windowStart);

  // Add current timestamp
  userData.timestamps.push(now);

  const messageCount = userData.timestamps.length;
  const threshold = isSimulation
    ? SPIKE_CONFIG.simulatedSpikeThreshold
    : SPIKE_CONFIG.maxMessages;

  // Check if threshold exceeded
  if (messageCount > threshold) {
    // Mark user as blocked
    userData.blocked = true;

    // Auto-unblock after duration (in production, use proper job queue)
    setTimeout(() => {
      clearUserSpikeBlock(userId);
    }, SPIKE_CONFIG.blockDurationMs);

    return {
      anomaly: {
        type: 'sudden_spike',
        subType: 'ddos_detected',
        severity: 'critical',
        message: `Sudden message spike detected (${messageCount} messages in ${SPIKE_CONFIG.windowMs / 1000}s) - potential DDoS attack`,
        matchedPattern: `${messageCount} msgs/${SPIKE_CONFIG.windowMs / 1000}s`,
        confidence: 95,
        layer: 'deterministic',
      },
      shouldBlock: true,
      messageCount,
    };
  }

  // Warning if approaching threshold
  if (messageCount >= threshold - 1) {
    return {
      anomaly: {
        type: 'sudden_spike',
        subType: 'rate_warning',
        severity: 'high',
        message: `High message rate detected (${messageCount} messages in ${SPIKE_CONFIG.windowMs / 1000}s) - approaching limit`,
        matchedPattern: `${messageCount} msgs/${SPIKE_CONFIG.windowMs / 1000}s`,
        confidence: 80,
        layer: 'deterministic',
      },
      shouldBlock: false,
      messageCount,
    };
  }

  return { anomaly: null, shouldBlock: false, messageCount };
}

/**
 * Reset user's message rate (for testing/admin purposes)
 */
export function resetUserMessageRate(userId: string): void {
  userMessageRates.delete(userId);
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

  // Check for medical content indicators
  const medicalAnomalies = detectMedicalContent(text);
  if (medicalAnomalies.length > 0) {
    reasons.push('Medical content detected');
  }

  // Check for mental health content indicators
  const mentalHealthAnomalies = detectMentalHealthContent(text);
  if (mentalHealthAnomalies.length > 0) {
    reasons.push('Mental health content detected');
  }

  // Check for hallucination risk indicators (comprehensive)
  const hallucinationAnomalies = detectHallucinationContent(text);
  if (hallucinationAnomalies.length > 0) {
    reasons.push('Potential hallucination risk');
  }

  // Also check legacy hallucination risk patterns
  const legacyHallucinationAnomalies = detectHallucinationRisk(text);
  if (
    legacyHallucinationAnomalies.length > 0 &&
    hallucinationAnomalies.length === 0
  ) {
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

  // Mental health content indicators
  indicators.push(...detectMentalHealthContent(text));

  // Comprehensive hallucination risk indicators
  indicators.push(...detectHallucinationContent(text));

  // Legacy hallucination risk indicators
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
    case 'mental_health':
      return 'Mental Health Content';
    case 'hallucination':
      return 'Hallucination Risk';
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
