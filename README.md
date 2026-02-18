# Index - AI-Powered Inventory Management

Index is a smart inventory management system designed for people with lots of stuff in bins, boxes, shelves, and containers across their home and garage. Upload a voice note describing everything, and AI catalogs it all into a searchable database. Then find anything instantly through the app or WhatsApp.

## How It Works

### Setup Phase
1. **Record a voice note** describing what's in each bin/box/shelf - take your time, up to 2 hours supported
2. **AI transcribes** the audio using OpenAI Whisper (handles long recordings via automatic chunking)
3. **AI parses** the transcript into structured data: items, containers, locations, categories, tags
4. **Everything is catalogued** in a local SQLite database with AI-generated search terms

### Day-to-Day Phase
- **Search**: Find anything by describing it naturally ("something to cut wire with", "holiday stuff")
- **Add**: Add new items via the app or WhatsApp ("I put a new hammer in Bin 5")
- **Move**: Move items between locations ("I moved the drill to the garage shelf")
- **Remove**: Remove used-up items ("remove the duct tape, I used it all")
- **Browse**: View everything by container, location, or category

### Smart Features
- **AI Search**: Doesn't depend on exact keywords - understands synonyms, related terms, and natural language
- **Deduplication**: Won't create duplicates even if you describe items differently; only adds new items when explicitly told to
- **WhatsApp Integration**: Full inventory management via text messages
- **Voice Recording**: Record directly in the browser or upload audio files
- **Large File Support**: Handles recordings up to 2 hours via automatic audio chunking

## Quick Start

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Set up environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# 3. Run in development
npm run dev

# 4. Open http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for transcription (Whisper) and AI features (GPT-4o) |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID for WhatsApp integration |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | No | Twilio WhatsApp sandbox number |
| `PORT` | No | Server port (default: 3001) |

## Architecture

```
Index/
├── server/
│   ├── index.js              # Express server entry point
│   ├── db/
│   │   ├── schema.js         # SQLite schema (items, containers, locations, etc.)
│   │   └── index.js          # Database connection
│   ├── services/
│   │   ├── ai.js             # AI engine: transcription, parsing, search, dedup
│   │   └── inventory.js      # Database operations for all entities
│   └── routes/
│       ├── voice.js           # Voice upload & processing endpoints
│       ├── items.js           # Item CRUD + AI search
│       ├── containers.js      # Container management
│       ├── locations.js       # Location management
│       ├── whatsapp.js        # Twilio WhatsApp webhook
│       └── stats.js           # Dashboard statistics
├── client/
│   └── src/
│       ├── App.jsx            # Main app with sidebar navigation
│       ├── services/api.js    # API client with all endpoints
│       ├── components/        # Reusable UI components
│       └── pages/             # Dashboard, Search, Voice, Inventory, etc.
└── uploads/                   # Voice note file storage
```

## API Endpoints

### Voice Notes
- `POST /api/voice/upload` - Upload audio file (up to 500MB)
- `POST /api/voice/:id/process` - Start AI processing
- `GET /api/voice/:id/status` - Check processing status
- `GET /api/voice` - List all voice notes

### Items
- `GET /api/items` - List items (paginated)
- `GET /api/items/search?q=query` - AI-powered search
- `POST /api/items` - Add item (with duplicate detection)
- `PUT /api/items/:id` - Update item
- `POST /api/items/:id/move` - Move item to different container/location
- `DELETE /api/items/:id` - Remove item

### Containers & Locations
- `GET /api/containers` - List all containers
- `GET /api/locations` - List all locations
- `POST /api/containers` - Create container
- `POST /api/locations` - Create location

### WhatsApp
- `POST /api/whatsapp/webhook` - Twilio webhook for incoming messages

### Other
- `GET /api/stats` - Inventory statistics
- `POST /api/command` - Natural language command processing

## WhatsApp Commands

Once WhatsApp is configured, you can send messages like:
- "Where's my drill?" - Search
- "I put a new hammer in Bin 5" - Add item
- "I moved the drill to the garage shelf" - Move item
- "Remove the duct tape" - Remove item
- "What's in Bin 1?" - List items
- "How much stuff do I have?" - Get summary
- "help" - Show all commands

## Tech Stack

- **Backend**: Node.js, Express, SQLite (better-sqlite3)
- **Frontend**: React 18, React Router, Vite
- **AI**: OpenAI GPT-4o (parsing, search, dedup), Whisper (transcription)
- **WhatsApp**: Twilio API
- **Audio**: ffmpeg for chunking large files

## Production Deployment

```bash
# Build the frontend
npm run build

# Start production server (serves both API and static files)
NODE_ENV=production npm start
```

The production build serves the React app from the Express server on a single port.
