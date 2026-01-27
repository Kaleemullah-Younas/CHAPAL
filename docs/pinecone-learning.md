# CHAPAL Semantic Feedback Learning with Pinecone

This document explains how the semantic feedback learning system works using Pinecone vector database.

## Overview

The system uses Pinecone to store and retrieve feedback data from admin corrections, enabling the AI to learn from previous interactions and improve its responses over time.

### How It Works

1. **Storing Feedback**: When an admin approves or corrects an AI response, the feedback is stored in Pinecone with:
   - User query (what the user asked)
   - Original AI response (what the AI initially said)
   - Admin response (the corrected/approved response)
   - Admin instructions (feedback on how to improve)
   - Rating (1-5 stars)
   - Context (conversation history, anomaly type, severity)

2. **Similarity Search**: When regenerating a response in the semantic feedback loop, the system:
   - Searches Pinecone for similar previous cases
   - Retrieves the top matches based on semantic similarity
   - Builds a learning context from admin corrections
   - Includes this context in the prompt to guide the AI

3. **Learning Categories**:
   - `admin_correction`: Responses that were corrected by admin (highest learning value)
   - `approved_response`: Original AI responses that were approved as correct
   - `chat_history`: General chat interactions (optional for learning)

## Setup Instructions

### 1. Create a Pinecone Account

1. Go to [Pinecone](https://www.pinecone.io/) and create an account
2. Create a new project

### 2. Create the Index

Create an index in Pinecone with the following settings:

- **Index Name**: `chapal-feedback`
- **Dimensions**: `768` (Gemini text-embedding-004 dimension)
- **Metric**: `cosine`
- **Cloud/Region**: Choose based on your preference

You can create the index via the Pinecone console or using the CLI:

```bash
# Using Pinecone CLI
pinecone create-index chapal-feedback --dimension 768 --metric cosine
```

### 3. Add Environment Variable

Add your Pinecone API key to your `.env` file:

```env
PINECONE_API_KEY=your-pinecone-api-key-here
```

### 4. Bootstrap Existing Data (Optional)

If you have existing admin corrections in your database, you can bootstrap Pinecone with this data using the admin API:

```typescript
// Call the bootstrapPineconeFeedback mutation
const result = await trpc.admin.bootstrapPineconeFeedback.mutate();
console.log(result.message); // "Successfully indexed X feedback items into Pinecone"
```

## Admin API Endpoints

### Get Pinecone Stats
```typescript
const stats = await trpc.admin.getPineconeFeedbackStats.query();
// Returns: { pinecone: { totalVectors }, database: { totalAnomalies, indexedAnomalies, ... } }
```

### Bootstrap Existing Feedback
```typescript
const result = await trpc.admin.bootstrapPineconeFeedback.mutate();
// Indexes all unindexed approved/corrected anomalies
```

### Test Similarity Search
```typescript
const results = await trpc.admin.testSimilaritySearch.query({ query: "your test query" });
// Returns similar feedback items from the database
```

## How Learning Improves Responses

When the admin uses the semantic feedback loop to regenerate a response:

1. The system searches Pinecone for queries similar to the current user query
2. It retrieves up to 5 similar cases (prioritizing admin corrections)
3. It builds a "learning context" that includes:
   - The original (incorrect) AI responses
   - The corrected (correct) admin responses
   - The admin instructions/feedback
4. This learning context is added to the system prompt
5. The AI uses these examples to generate better responses

### Example Learning Context

```
=== LEARNING FROM PREVIOUS SIMILAR CASES ===

--- Example 1 (Similarity: 87.5%, Rating: 5/5) ---
User Query: What medication should I take for headaches?

Original AI Response (INCORRECT):
You should take 500mg of ibuprofen every 4-6 hours...

Admin's Corrected Response (CORRECT):
I understand you're experiencing headaches. While over-the-counter pain relievers like ibuprofen or acetaminophen can help, I recommend consulting with a healthcare professional for personalized advice...

Admin Instructions: Do not recommend specific dosages. Always recommend consulting a healthcare professional.

=== END OF LEARNING EXAMPLES ===
```

## Best Practices

1. **Quality Feedback**: Provide detailed admin instructions when correcting responses
2. **Rate Responses**: Use the rating system to indicate response quality
3. **Regular Bootstrapping**: Periodically run the bootstrap to index new corrections
4. **Monitor Stats**: Check Pinecone stats to ensure data is being indexed

## Technical Details

- **Embedding Model**: `text-embedding-004` (Google Gemini)
- **Vector Dimensions**: 768
- **Index Name**: `chapal-feedback`
- **Metadata Limit**: Strings are truncated to stay within Pinecone's metadata limits
- **Batch Size**: 100 items when bootstrapping

## Troubleshooting

### Pinecone Connection Issues
- Verify your `PINECONE_API_KEY` is correct
- Check that the index `chapal-feedback` exists
- Ensure the index dimensions match (768)

### Missing Embeddings
- Check if `GEMINI_API_KEY` is set for embedding generation
- Verify Gemini API quota isn't exhausted

### Learning Not Improving
- Run `bootstrapPineconeFeedback` to index existing corrections
- Use `testSimilaritySearch` to verify similar items are found
- Ensure admin corrections have proper instructions and ratings
