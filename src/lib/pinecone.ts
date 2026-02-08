/**
 * CHAPAL — Pinecone Integration for Semantic Feedback Learning
 *
 * This module uses Google Gemini's embedding model (gemini-embedding-001)
 * to generate vector embeddings, which are stored in Pinecone for semantic
 * similarity search and continuous learning from admin feedback.
 *
 * Gemini usage in this file:
 *   - generateEmbedding() → Calls Gemini Embedding API (gemini-embedding-001)
 *     via REST at https://generativelanguage.googleapis.com/v1beta/
 *   - Uses GEMINI_API_KEY environment variable for authentication
 *
 * Other functionality:
 *   - Storing feedback data in Pinecone for learning
 *   - Similarity search to retrieve relevant context
 *   - Building AI context from historical admin corrections
 */

import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';

// Check if Pinecone is configured
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const isPineconeConfigured = PINECONE_API_KEY.length > 0;

// Initialize Pinecone client (only if configured)
const pinecone = isPineconeConfigured
  ? new Pinecone({ apiKey: PINECONE_API_KEY })
  : null;

// Index name for CHAPAL feedback data
const INDEX_NAME = 'chapal-feedback';

// Track if index has been verified/created
let indexVerified = false;
let indexCreationInProgress = false;

// Gemini API key for embeddings — uses the same GEMINI_API_KEY env var
// that powers the main Gemini 3 chat generation (first key from rotation pool)
const geminiApiKey = (process.env.GEMINI_API_KEY || '').split(',')[0]?.trim();

// Metadata structure for stored vectors
export interface FeedbackMetadata extends RecordMetadata {
  // Content fields
  userQuery: string;
  originalAiResponse: string;
  adminResponse: string;
  adminInstructions: string;

  // Context fields
  anomalyType: string;
  severity: string;
  chatContext: string; // Serialized conversation context

  // Rating and quality
  rating: number;
  iterationCount: number;

  // Tracking
  userId: string;
  chatId: string;
  anomalyId: string;
  createdAt: string;

  // Category for filtering - distinguishes response source
  // 'human_response' = Admin wrote the response manually
  // 'ai_regenerated_approved' = AI regenerated with feedback, admin approved
  // 'ai_original_approved' = Original AI response approved without changes
  // 'chat_history' = Regular chat interaction (not reviewed)
  category:
    | 'human_response'
    | 'ai_regenerated_approved'
    | 'ai_original_approved'
    | 'chat_history';

  // Source tracking
  responseSource: 'human' | 'ai'; // Whether the final response was written by human or AI
  wasRegenerated: boolean; // Whether AI regenerated with feedback before approval
}

// Result type for similarity search
export interface SimilarFeedback {
  id: string;
  score: number;
  metadata: FeedbackMetadata;
}

/**
 * Generate embeddings using Gemini's embedding model via REST API
 * Using gemini-embedding-001 with 768 dimensions for storage efficiency
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
          output_dimensionality: 768,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.embedding.values;
  } catch (error) {
    console.error('[Pinecone] Error generating embedding:', error);
    throw error;
  }
}

/**
 * Ensure the Pinecone index exists, create it if it doesn't
 */
async function ensureIndexExists(): Promise<boolean> {
  if (!pinecone) {
    console.warn('[Pinecone] Not configured - PINECONE_API_KEY is missing');
    return false;
  }

  if (indexVerified) {
    return true;
  }

  // Prevent multiple simultaneous creation attempts
  if (indexCreationInProgress) {
    // Wait for the creation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    return indexVerified;
  }

  try {
    indexCreationInProgress = true;

    // List existing indexes
    const indexList = await pinecone.listIndexes();
    const existingIndex = indexList.indexes?.find(
      idx => idx.name === INDEX_NAME,
    );

    if (existingIndex) {
      console.log(`[Pinecone] Index '${INDEX_NAME}' already exists`);
      indexVerified = true;
      return true;
    }

    // Create the index if it doesn't exist
    console.log(`[Pinecone] Creating index '${INDEX_NAME}'...`);
    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: 768, // Gemini text-embedding-004 dimension
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });

    // Wait for index to be ready (can take a few seconds)
    console.log(`[Pinecone] Waiting for index '${INDEX_NAME}' to be ready...`);
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait (increased from 30)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const description = await pinecone.describeIndex(INDEX_NAME);
        if (description.status?.ready) {
          console.log(`[Pinecone] Index '${INDEX_NAME}' is ready!`);
          indexVerified = true;
          return true;
        }
      } catch {
        // Index might not be queryable yet, continue waiting
        console.log(
          `[Pinecone] Index not ready yet, waiting... (${attempts + 1}/${maxAttempts})`,
        );
      }
      attempts++;
    }

    console.warn(
      `[Pinecone] Index creation timed out, but may still be initializing`,
    );
    indexVerified = true; // Assume it will be ready soon
    return true;
  } catch (error: unknown) {
    // Check if error is because index already exists
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('ALREADY_EXISTS') ||
      errorMessage.includes('already exists')
    ) {
      console.log(
        `[Pinecone] Index '${INDEX_NAME}' already exists (from error)`,
      );
      indexVerified = true;
      return true;
    }
    console.error('[Pinecone] Error ensuring index exists:', error);
    return false;
  } finally {
    indexCreationInProgress = false;
  }
}

/**
 * Get the Pinecone index (ensures it exists first)
 */
async function getIndex() {
  if (!pinecone) {
    throw new Error('Pinecone is not configured - PINECONE_API_KEY is missing');
  }

  // Ensure index exists before returning
  const exists = await ensureIndexExists();
  if (!exists) {
    throw new Error('Failed to ensure Pinecone index exists');
  }

  return pinecone.index(INDEX_NAME);
}

/**
 * Store admin correction/feedback in Pinecone for learning
 * This is called when admin approves or corrects a response
 */
export async function storeFeedback(data: {
  userQuery: string;
  originalAiResponse: string;
  adminResponse: string;
  adminInstructions: string;
  anomalyType: string;
  severity: string;
  chatContext: Array<{ role: string; content: string }>;
  rating: number;
  iterationCount: number;
  userId: string;
  chatId: string;
  anomalyId: string;
  // New fields to differentiate response types
  responseSource: 'human' | 'ai';
  wasRegenerated: boolean;
}): Promise<string> {
  // Check if Pinecone is configured
  if (!isPineconeConfigured) {
    console.warn('[Pinecone] Not configured - skipping storeFeedback');
    return '';
  }

  try {
    const index = await getIndex();

    // Create combined text for embedding
    // We embed the user query + admin response together for semantic similarity
    const sourceLabel =
      data.responseSource === 'human'
        ? 'Admin Response'
        : 'AI Response (Approved)';
    const embeddingText = `Query: ${data.userQuery}\n\n${sourceLabel}: ${data.adminResponse}\n\nInstructions: ${data.adminInstructions}`;

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Create unique ID for this feedback
    const vectorId = `feedback-${data.anomalyId}-${Date.now()}`;

    // Determine category based on response source and regeneration
    let category: FeedbackMetadata['category'];
    if (data.responseSource === 'human') {
      category = 'human_response';
    } else if (data.wasRegenerated) {
      category = 'ai_regenerated_approved';
    } else {
      category = 'ai_original_approved';
    }

    // Prepare metadata (truncate long strings to stay within Pinecone limits)
    const metadata: FeedbackMetadata = {
      userQuery: data.userQuery.slice(0, 2000),
      originalAiResponse: data.originalAiResponse.slice(0, 3000),
      adminResponse: data.adminResponse.slice(0, 3000),
      adminInstructions: data.adminInstructions.slice(0, 1000),
      anomalyType: data.anomalyType,
      severity: data.severity,
      chatContext: JSON.stringify(data.chatContext).slice(0, 3000),
      rating: data.rating,
      iterationCount: data.iterationCount,
      userId: data.userId,
      chatId: data.chatId,
      anomalyId: data.anomalyId,
      createdAt: new Date().toISOString(),
      category,
      responseSource: data.responseSource,
      wasRegenerated: data.wasRegenerated,
    };

    // Upsert to Pinecone
    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata,
      },
    ]);

    console.log(`[Pinecone] Stored feedback: ${vectorId}`);
    return vectorId;
  } catch (error) {
    console.error('[Pinecone] Error storing feedback:', error);
    throw error;
  }
}

/**
 * Store approved AI response in Pinecone (original AI response approved without changes)
 * This helps the AI learn from responses that were approved as correct
 */
export async function storeApprovedResponse(data: {
  userQuery: string;
  aiResponse: string;
  anomalyType: string;
  severity: string;
  chatContext: Array<{ role: string; content: string }>;
  userId: string;
  chatId: string;
  anomalyId: string;
}): Promise<string> {
  // Check if Pinecone is configured
  if (!isPineconeConfigured) {
    console.warn('[Pinecone] Not configured - skipping storeApprovedResponse');
    return '';
  }

  try {
    const index = await getIndex();

    // Create combined text for embedding
    const embeddingText = `Query: ${data.userQuery}\n\nApproved AI Response: ${data.aiResponse}`;

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Create unique ID
    const vectorId = `approved-${data.anomalyId}-${Date.now()}`;

    // Prepare metadata - this is an AI response approved without changes
    const metadata: FeedbackMetadata = {
      userQuery: data.userQuery.slice(0, 2000),
      originalAiResponse: data.aiResponse.slice(0, 3000),
      adminResponse: data.aiResponse.slice(0, 3000), // Same as original since it was approved
      adminInstructions: 'Original AI response approved without changes',
      anomalyType: data.anomalyType,
      severity: data.severity,
      chatContext: JSON.stringify(data.chatContext).slice(0, 3000),
      rating: 5, // Approved responses get top rating
      iterationCount: 0,
      userId: data.userId,
      chatId: data.chatId,
      anomalyId: data.anomalyId,
      createdAt: new Date().toISOString(),
      category: 'ai_original_approved', // Original AI response approved
      responseSource: 'ai',
      wasRegenerated: false,
    };

    // Upsert to Pinecone
    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata,
      },
    ]);

    console.log(`[Pinecone] Stored approved response: ${vectorId}`);
    return vectorId;
  } catch (error) {
    console.error('[Pinecone] Error storing approved response:', error);
    throw error;
  }
}

/**
 * Store chat history for learning from all user interactions
 */
export async function storeChatHistory(data: {
  userQuery: string;
  aiResponse: string;
  chatContext: Array<{ role: string; content: string }>;
  userId: string;
  chatId: string;
  messageId: string;
}): Promise<string> {
  // Check if Pinecone is configured
  if (!isPineconeConfigured) {
    console.warn('[Pinecone] Not configured - skipping storeChatHistory');
    return '';
  }

  try {
    const index = await getIndex();

    // Create combined text for embedding
    const embeddingText = `Query: ${data.userQuery}\n\nResponse: ${data.aiResponse}`;

    // Generate embedding
    const embedding = await generateEmbedding(embeddingText);

    // Create unique ID
    const vectorId = `chat-${data.messageId}-${Date.now()}`;

    // Prepare metadata
    const metadata: FeedbackMetadata = {
      userQuery: data.userQuery.slice(0, 2000),
      originalAiResponse: data.aiResponse.slice(0, 3000),
      adminResponse: data.aiResponse.slice(0, 3000),
      adminInstructions: '',
      anomalyType: 'none',
      severity: 'none',
      chatContext: JSON.stringify(data.chatContext).slice(0, 3000),
      rating: 3, // Default rating for non-reviewed content
      iterationCount: 0,
      userId: data.userId,
      chatId: data.chatId,
      anomalyId: data.messageId,
      createdAt: new Date().toISOString(),
      category: 'chat_history',
      responseSource: 'ai',
      wasRegenerated: false,
    };

    // Upsert to Pinecone
    await index.upsert([
      {
        id: vectorId,
        values: embedding,
        metadata,
      },
    ]);

    console.log(`[Pinecone] Stored chat history: ${vectorId}`);
    return vectorId;
  } catch (error) {
    console.error('[Pinecone] Error storing chat history:', error);
    throw error;
  }
}

/**
 * Search for similar feedback/corrections based on a user query
 * Returns relevant examples to help improve AI responses
 */
export async function searchSimilarFeedback(
  userQuery: string,
  options: {
    topK?: number;
    category?: FeedbackMetadata['category'] | 'all';
    minRating?: number;
    includeHumanResponses?: boolean; // Admin-written responses
    includeAiApproved?: boolean; // AI responses approved by admin
    includeChatHistory?: boolean;
  } = {},
): Promise<SimilarFeedback[]> {
  // Check if Pinecone is configured
  if (!isPineconeConfigured) {
    console.warn('[Pinecone] Not configured - skipping searchSimilarFeedback');
    return [];
  }

  const {
    topK = 5,
    category = 'all',
    minRating = 3,
    includeHumanResponses = true,
    includeAiApproved = true,
    includeChatHistory = false,
  } = options;

  try {
    const index = await getIndex();

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userQuery);

    // Build filter based on options
    const filter: Record<string, unknown> = {};

    // Category filter
    if (category !== 'all') {
      filter.category = { $eq: category };
    } else {
      // Build category filter based on include flags
      const categories: string[] = [];
      if (includeHumanResponses) categories.push('human_response');
      if (includeAiApproved) {
        categories.push('ai_regenerated_approved');
        categories.push('ai_original_approved');
      }
      if (includeChatHistory) categories.push('chat_history');

      if (categories.length > 0 && categories.length < 4) {
        filter.category = { $in: categories };
      }
    }

    // Rating filter
    if (minRating > 0) {
      filter.rating = { $gte: minRating };
    }

    // Query Pinecone
    const results = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });

    // Transform results
    const similarFeedback: SimilarFeedback[] = results.matches
      .filter(match => match.metadata)
      .map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as FeedbackMetadata,
      }));

    console.log(
      `[Pinecone] Found ${similarFeedback.length} similar feedback items`,
    );
    return similarFeedback;
  } catch (error) {
    console.error('[Pinecone] Error searching similar feedback:', error);
    // Return empty array on error to allow graceful degradation
    return [];
  }
}

/**
 * Build context prompt from similar feedback for AI regeneration
 * This creates a learning context based on previous admin corrections
 */
export function buildLearningContext(
  similarFeedback: SimilarFeedback[],
  maxExamples: number = 3,
): string {
  if (similarFeedback.length === 0) {
    return '';
  }

  // Sort by score and rating, prioritizing human responses over AI responses
  const sortedFeedback = [...similarFeedback]
    .sort((a, b) => {
      // Priority order: human_response > ai_regenerated_approved > ai_original_approved
      const priorityOrder = {
        human_response: 3,
        ai_regenerated_approved: 2,
        ai_original_approved: 1,
        chat_history: 0,
      };
      const priorityA = priorityOrder[a.metadata.category] || 0;
      const priorityB = priorityOrder[b.metadata.category] || 0;

      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      // Then sort by score and rating
      const scoreA = a.score * (a.metadata.rating / 5);
      const scoreB = b.score * (b.metadata.rating / 5);
      return scoreB - scoreA;
    })
    .slice(0, maxExamples);

  let context = `\n\n=== LEARNING FROM PREVIOUS SIMILAR CASES ===
The following examples show how similar queries were handled by admin reviewers.
Use these as guidance to improve your response:\n`;

  sortedFeedback.forEach((feedback, index) => {
    const meta = feedback.metadata;
    const sourceLabel =
      meta.responseSource === 'human'
        ? '👤 HUMAN (Admin-Written)'
        : '🤖 AI (Admin-Approved)';

    context += `
--- Example ${index + 1} (${sourceLabel}, Similarity: ${(feedback.score * 100).toFixed(1)}%, Rating: ${meta.rating}/5) ---
User Query: ${meta.userQuery}

`;

    if (meta.category === 'human_response') {
      // Human-written response - highest learning value
      context += `Original AI Response (REPLACED):
${meta.originalAiResponse}

Admin's Written Response (USE THIS AS MODEL):
${meta.adminResponse}

Admin Instructions: ${meta.adminInstructions}
`;
    } else if (meta.category === 'ai_regenerated_approved') {
      // AI regenerated with feedback and approved
      context += `Original AI Response (NEEDED IMPROVEMENT):
${meta.originalAiResponse}

Improved AI Response (APPROVED after ${meta.iterationCount} iterations):
${meta.adminResponse}

Admin Instructions that led to improvement: ${meta.adminInstructions}
`;
    } else {
      // Original AI response approved without changes
      context += `AI Response (APPROVED as correct):
${meta.adminResponse}
`;
    }
  });

  context += `
=== END OF LEARNING EXAMPLES ===
Based on these examples, generate an improved response. Prioritize patterns from HUMAN (Admin-Written) responses as they represent the gold standard.
`;

  return context;
}

/**
 * Check if Pinecone is properly configured
 */
export function isPineconeEnabled(): boolean {
  return isPineconeConfigured;
}

/**
 * Get statistics about stored feedback
 */
export async function getFeedbackStats(): Promise<{
  totalVectors: number;
  approximateCount: number;
  isConfigured: boolean;
}> {
  if (!isPineconeConfigured) {
    return { totalVectors: 0, approximateCount: 0, isConfigured: false };
  }

  try {
    const index = await getIndex();
    const stats = await index.describeIndexStats();

    return {
      totalVectors: stats.totalRecordCount || 0,
      approximateCount: stats.totalRecordCount || 0,
      isConfigured: true,
    };
  } catch (error) {
    console.error('[Pinecone] Error getting stats:', error);
    return { totalVectors: 0, approximateCount: 0, isConfigured: true };
  }
}

/**
 * Delete feedback vector by ID
 */
export async function deleteFeedback(vectorId: string): Promise<void> {
  if (!isPineconeConfigured) {
    console.warn('[Pinecone] Not configured - skipping delete');
    return;
  }

  try {
    const index = await getIndex();
    await index.deleteOne(vectorId);
    console.log(`[Pinecone] Deleted feedback: ${vectorId}`);
  } catch (error) {
    console.error('[Pinecone] Error deleting feedback:', error);
    throw error;
  }
}

/**
 * Batch index existing data from database
 * Call this to bootstrap Pinecone with existing admin corrections
 */
export async function batchIndexExistingFeedback(
  feedbackItems: Array<{
    userQuery: string;
    originalAiResponse: string;
    adminResponse: string;
    adminInstructions: string;
    anomalyType: string;
    severity: string;
    chatContext: Array<{ role: string; content: string }>;
    rating: number;
    iterationCount: number;
    userId: string;
    chatId: string;
    anomalyId: string;
    responseSource: 'human' | 'ai';
    wasRegenerated: boolean;
  }>,
): Promise<number> {
  // Check if Pinecone is configured
  if (!isPineconeConfigured) {
    console.warn(
      '[Pinecone] Not configured - skipping batchIndexExistingFeedback',
    );
    return 0;
  }

  let indexedCount = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < feedbackItems.length; i += batchSize) {
    const batch = feedbackItems.slice(i, i + batchSize);

    const promises = batch.map(async item => {
      try {
        await storeFeedback(item);
        return true;
      } catch (error) {
        console.error(
          `[Pinecone] Failed to index item ${item.anomalyId}:`,
          error,
        );
        return false;
      }
    });

    const results = await Promise.all(promises);
    indexedCount += results.filter(Boolean).length;

    console.log(
      `[Pinecone] Batch indexed ${indexedCount}/${feedbackItems.length} items`,
    );
  }

  return indexedCount;
}
