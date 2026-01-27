/**
 * Test script to verify Pinecone configuration and index creation
 * Run with: npx tsx scripts/test-pinecone.ts
 */

import { config } from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

// Load environment variables
config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const INDEX_NAME = 'chapal-feedback';
const EMBEDDING_DIMENSION = 768; // gemini-embedding-001 with outputDimensionality=768

async function testPinecone() {
  console.log('=== Pinecone Configuration Test ===\n');

  // Check if API key is configured
  if (!PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY is not set in .env file');
    console.log('\nTo configure Pinecone:');
    console.log('1. Go to https://www.pinecone.io/ and create an account');
    console.log('2. Create a new API key');
    console.log('3. Add PINECONE_API_KEY=your_key_here to your .env file');
    process.exit(1);
  }

  console.log('✓ PINECONE_API_KEY is configured');
  console.log(`  Key prefix: ${PINECONE_API_KEY.substring(0, 8)}...`);

  // Initialize Pinecone client
  const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
  console.log('✓ Pinecone client initialized');

  try {
    // List existing indexes
    console.log('\nChecking existing indexes...');
    const indexList = await pinecone.listIndexes();
    console.log(`✓ Found ${indexList.indexes?.length || 0} indexes:`);
    indexList.indexes?.forEach(idx => {
      console.log(`  - ${idx.name} (${idx.dimension}D, ${idx.metric})`);
    });

    // Check if our index exists
    const existingIndex = indexList.indexes?.find(
      idx => idx.name === INDEX_NAME,
    );

    if (existingIndex) {
      console.log(`\n✓ Index '${INDEX_NAME}' already exists!`);

      // Get index stats
      const index = pinecone.index(INDEX_NAME);
      const stats = await index.describeIndexStats();
      console.log('\nIndex Statistics:');
      console.log(`  - Total vectors: ${stats.totalRecordCount || 0}`);
      console.log(
        `  - Namespaces: ${Object.keys(stats.namespaces || {}).length}`,
      );
    } else {
      console.log(`\n⚠ Index '${INDEX_NAME}' does not exist. Creating...`);

      // Create the index
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: EMBEDDING_DIMENSION,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      console.log(`\n✓ Index '${INDEX_NAME}' creation initiated!`);
      console.log(
        'Note: It may take a few minutes for the index to be fully ready.',
      );

      // Wait for index to be ready
      console.log('\nWaiting for index to be ready...');
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const description = await pinecone.describeIndex(INDEX_NAME);
          if (description.status?.ready) {
            console.log(`✓ Index '${INDEX_NAME}' is ready!`);
            break;
          }
          console.log(`  Waiting... (${attempts + 1}/${maxAttempts})`);
        } catch {
          console.log(
            `  Index not ready yet... (${attempts + 1}/${maxAttempts})`,
          );
        }
        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.log(
          '\n⚠ Index is still initializing. Check Pinecone dashboard for status.',
        );
      }
    }

    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testPinecone();
