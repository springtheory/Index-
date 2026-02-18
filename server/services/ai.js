const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Transcribe audio using Whisper - handles chunking for long files
async function transcribeAudio(filePath) {
  const client = getOpenAI();
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);

  // Whisper API limit is 25MB per request
  if (fileSizeMB <= 24) {
    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      language: 'en',
    });
    return {
      text: response.text,
      duration: response.duration,
      segments: response.segments,
    };
  }

  // For larger files, split them
  const chunkDir = path.join(path.dirname(filePath), 'chunks_' + Date.now());
  fs.mkdirSync(chunkDir, { recursive: true });

  try {
    const { execSync } = require('child_process');

    const durationOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim();
    const totalDuration = parseFloat(durationOutput);

    const chunkDuration = 600; // 10 minutes
    const numChunks = Math.ceil(totalDuration / chunkDuration);
    const chunkFiles = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkDuration;
      const chunkPath = path.join(chunkDir, `chunk_${i}.mp3`);
      execSync(
        `ffmpeg -i "${filePath}" -ss ${start} -t ${chunkDuration} -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${chunkPath}" -y 2>/dev/null`
      );
      if (fs.existsSync(chunkPath) && fs.statSync(chunkPath).size > 0) {
        chunkFiles.push(chunkPath);
      }
    }

    let fullText = '';
    let totalTranscribedDuration = 0;
    const allSegments = [];

    for (let i = 0; i < chunkFiles.length; i++) {
      const response = await client.audio.transcriptions.create({
        file: fs.createReadStream(chunkFiles[i]),
        model: 'whisper-1',
        response_format: 'verbose_json',
        language: 'en',
      });

      fullText += (i > 0 ? ' ' : '') + response.text;
      totalTranscribedDuration += response.duration || chunkDuration;

      if (response.segments) {
        const offset = i * chunkDuration;
        for (const seg of response.segments) {
          allSegments.push({
            ...seg,
            start: seg.start + offset,
            end: seg.end + offset,
          });
        }
      }
    }

    return {
      text: fullText,
      duration: totalTranscribedDuration,
      segments: allSegments,
    };
  } finally {
    if (fs.existsSync(chunkDir)) {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    }
  }
}

// Parse transcript into structured inventory data
async function parseTranscriptToInventory(transcript) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an inventory cataloguing AI. You parse voice transcripts describing items stored in bins, boxes, containers, shelves, and various locations in a home or garage.

Your job is to extract EVERY item mentioned and organize them into a structured format.

Rules:
1. Each item must have a name, description, and location info
2. Group items by their container (bin, box, shelf, drawer, etc.)
3. Containers belong to locations (garage, room, area, zone)
4. Generate useful aliases for each item (common alternate names, abbreviations, related terms)
5. Generate search tags for each item (material, use-case, category, color, brand if mentioned)
6. Assign sensible categories (tools, electronics, holiday, sports, kitchen, clothing, documents, hardware, automotive, garden, toys, office, cleaning, seasonal, craft, etc.)
7. If quantity is mentioned, capture it. Default to 1.
8. If the speaker says things like "a bunch of", "several", "a few" - estimate quantity
9. Capture any identifying details: color, brand, size, condition
10. If the same item appears to be mentioned twice with different descriptions, merge them as ONE item with combined info

Return JSON with this structure:
{
  "locations": [{ "name": "string", "description": "string or null" }],
  "containers": [{ "label": "string", "type": "string", "color": "string or null", "size": "string or null", "description": "string", "location": "string" }],
  "items": [{ "name": "string", "description": "string", "category": "string", "quantity": "number", "container": "string", "location": "string", "tags": ["string"], "aliases": ["string"], "notes": "string" }]
}`,
      },
      {
        role: 'user',
        content: `Parse this voice transcript into a structured inventory:\n\n${transcript}`,
      },
    ],
    max_tokens: 16000,
  });

  return JSON.parse(response.choices[0].message.content);
}

// For very long transcripts, process in sections
async function parseTranscriptChunked(transcript) {
  if (transcript.length < 12000) {
    return parseTranscriptToInventory(transcript);
  }

  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
  const chunks = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 10000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      const lastSentences = currentChunk.match(/[^.!?]+[.!?]+/g) || [];
      currentChunk = lastSentences.slice(-2).join('') + sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const allResults = { locations: [], containers: [], items: [] };

  for (const chunk of chunks) {
    const result = await parseTranscriptToInventory(chunk);
    allResults.locations.push(...(result.locations || []));
    allResults.containers.push(...(result.containers || []));
    allResults.items.push(...(result.items || []));
  }

  const locMap = new Map();
  for (const loc of allResults.locations) {
    const key = loc.name.toLowerCase().trim();
    if (!locMap.has(key)) locMap.set(key, loc);
  }
  allResults.locations = Array.from(locMap.values());

  const contMap = new Map();
  for (const cont of allResults.containers) {
    const key = cont.label.toLowerCase().trim();
    if (!contMap.has(key)) contMap.set(key, cont);
  }
  allResults.containers = Array.from(contMap.values());

  return allResults;
}

// Smart search using AI to understand intent
async function aiSearch(query) {
  const db = getDb();
  const client = getOpenAI();

  const items = db
    .prepare(
      `SELECT i.*, c.label as container_label, c.type as container_type,
              l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id`
    )
    .all();

  if (items.length === 0) {
    return { results: [], message: 'No items in inventory yet.' };
  }

  const itemList = items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    tags: item.tags,
    aliases: item.aliases,
    container: item.container_label,
    location: item.location_name,
    quantity: item.quantity,
  }));

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an inventory search assistant. Given a user's search query and a list of inventory items, find ALL relevant matches.

Rules:
1. Be GENEROUS with matching - if something could possibly be what the user is looking for, include it
2. Understand synonyms, related terms, and common associations
3. "screwdriver" should match "Phillips head screwdriver", "flathead screwdriver", etc.
4. "Christmas stuff" should match "Christmas lights", "ornaments", "wreath", "tree stand", etc.
5. "something to cut with" should match "scissors", "knife", "saw", "box cutter", etc.
6. Rank results by relevance (1.0 = exact match, lower = less relevant)
7. Include items even if only tangentially related, but with lower relevance scores
8. If the query mentions a location or container, prioritize items from there

Return JSON:
{
  "results": [{ "item_id": number, "relevance": number, "reason": "string" }],
  "message": "string - friendly summary of what was found"
}`,
      },
      {
        role: 'user',
        content: `Search query: "${query}"\n\nInventory items:\n${JSON.stringify(itemList, null, 1)}`,
      },
    ],
    max_tokens: 4000,
  });

  const searchResult = JSON.parse(response.choices[0].message.content);

  const enrichedResults = searchResult.results
    .sort((a, b) => b.relevance - a.relevance)
    .map((r) => {
      const item = items.find((i) => i.id === r.item_id);
      return item ? { ...item, relevance: r.relevance, matchReason: r.reason } : null;
    })
    .filter(Boolean);

  return { results: enrichedResults, message: searchResult.message };
}

// Check if an item already exists (deduplication)
async function checkDuplicate(newItem) {
  const db = getDb();
  const client = getOpenAI();

  const existing = db
    .prepare(
      `SELECT i.id, i.name, i.description, i.category, i.tags, i.aliases,
              c.label as container_label, l.name as location_name
       FROM items i
       LEFT JOIN containers c ON i.container_id = c.id
       LEFT JOIN locations l ON COALESCE(i.location_id, c.location_id) = l.id`
    )
    .all();

  if (existing.length === 0) return { isDuplicate: false };

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a deduplication engine for a home inventory system.

Given a new item someone wants to add and the existing inventory, determine if this item already exists.

Rules:
1. "Phillips screwdriver" and "Phillips head screwdriver" are the SAME item
2. "drill" and "power drill" are the SAME item
3. "red toolbox" and "toolbox (red)" are the SAME item
4. "Christmas lights" and "holiday string lights" are the SAME item
5. BUT "Phillips screwdriver #1" and "Phillips screwdriver #2" are DIFFERENT if explicitly numbered
6. Different sizes of the same item are DIFFERENT (e.g., "small wrench" vs "large wrench")
7. If user explicitly says "new" or "another" or "additional", treat as a new item
8. When in doubt, flag as potential duplicate and let the user decide

Return JSON:
{
  "isDuplicate": boolean,
  "confidence": number (0.0 to 1.0),
  "matchedItemId": number or null,
  "matchedItemName": string or null,
  "reason": "string explaining the decision"
}`,
      },
      {
        role: 'user',
        content: `New item to add: ${JSON.stringify(newItem)}\n\nExisting inventory:\n${JSON.stringify(
          existing.map((e) => ({ id: e.id, name: e.name, description: e.description, category: e.category })),
          null,
          1
        )}`,
      },
    ],
    max_tokens: 500,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Process a natural language command (from WhatsApp or app)
async function processCommand(text, source = 'app') {
  const client = getOpenAI();
  const db = getDb();

  const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
  const containerCount = db.prepare('SELECT COUNT(*) as count FROM containers').get().count;
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM items').get().count;

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are Index, an AI inventory management assistant. Parse the user's message into an actionable command.

Current inventory: ${locationCount} locations, ${containerCount} containers, ${itemCount} items.

Available actions:
1. "search" - User is looking for something
2. "add_item" - User wants to add a NEW item
3. "move_item" - User wants to move an item
4. "update_item" - User wants to update item details
5. "remove_item" - User wants to remove/delete an item
6. "list" - User wants to see items in a specific location/container/category
7. "status" - User wants an inventory summary
8. "help" - User needs help

IMPORTANT: Default to "search" unless the user explicitly says they want to add, move, update, or remove.

Return JSON:
{
  "action": "string",
  "params": {
    "query": "search query",
    "item_name": "item name",
    "item_description": "description",
    "category": "category",
    "quantity": number or null,
    "from_container": "source container",
    "to_container": "target container",
    "to_location": "target location",
    "container": "container to list",
    "location": "location to list",
    "updates": {}
  },
  "is_new_item": boolean,
  "original_text": "the original message"
}`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 1000,
  });

  return JSON.parse(response.choices[0].message.content);
}

// Generate search terms for an item (for the search index)
async function generateSearchTerms(item) {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Generate search terms for an inventory item. Include:
1. The exact name and each word in it
2. Common synonyms and alternate names
3. Category-related terms
4. Material/use-case terms
5. Abbreviated forms
6. Common misspellings

Return JSON: { "terms": [{"term": "string", "weight": number (0.1 to 1.0)}] }
Generate 10-30 terms per item.`,
      },
      {
        role: 'user',
        content: JSON.stringify(item),
      },
    ],
    max_tokens: 1000,
  });

  return JSON.parse(response.choices[0].message.content).terms;
}

module.exports = {
  transcribeAudio,
  parseTranscriptToInventory,
  parseTranscriptChunked,
  aiSearch,
  checkDuplicate,
  processCommand,
  generateSearchTerms,
};
