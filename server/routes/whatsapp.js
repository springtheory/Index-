const express = require('express');
const inventory = require('../services/inventory');
const ai = require('../services/ai');

const router = express.Router();

// Twilio sends WhatsApp messages here
router.post('/webhook', async (req, res) => {
  try {
    const { Body: messageBody, From: from, NumMedia: numMedia, MediaUrl0: mediaUrl } = req.body;

    console.log(`[WhatsApp] Message from ${from}: ${messageBody || '(media)'}`);

    let responseText;

    // Handle voice message
    if (numMedia && parseInt(numMedia) > 0 && mediaUrl) {
      responseText = await handleVoiceMessage(mediaUrl, from);
    }
    // Handle text message
    else if (messageBody) {
      responseText = await handleTextMessage(messageBody, from);
    } else {
      responseText = "I didn't understand that. Send me a text to search, add, or move items, or send a voice note to catalogue new inventory.";
    }

    // Respond with TwiML
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(responseText)}</Message>
</Response>`);
  } catch (err) {
    console.error('[WhatsApp] Error:', err);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, something went wrong. Please try again.</Message>
</Response>`);
  }
});

async function handleTextMessage(text, from) {
  try {
    const command = await ai.processCommand(text, 'whatsapp');

    switch (command.action) {
      case 'search': {
        const results = process.env.OPENAI_API_KEY
          ? await ai.aiSearch(command.params.query || text)
          : { results: inventory.quickSearch(command.params.query || text), message: '' };

        if (results.results.length === 0) {
          return `No items found for "${command.params.query || text}". Try describing what you're looking for differently.`;
        }

        let msg = `Found ${results.results.length} item(s):\n\n`;
        const topResults = results.results.slice(0, 10);
        for (const item of topResults) {
          msg += `* ${item.name}`;
          if (item.container_label) msg += ` - in ${item.container_label}`;
          if (item.location_name) msg += ` (${item.location_name})`;
          if (item.quantity > 1) msg += ` [qty: ${item.quantity}]`;
          msg += '\n';
        }
        if (results.results.length > 10) {
          msg += `\n...and ${results.results.length - 10} more. Check the app for full results.`;
        }
        return msg;
      }

      case 'add_item': {
        const containerLabel = command.params.to_container;
        const locationName = command.params.to_location;

        let containerId = null;
        let locationId = null;

        if (containerLabel) {
          const container = inventory.getContainerByLabel(containerLabel);
          if (container) containerId = container.id;
          else {
            const loc = locationName ? inventory.findOrCreateLocation(locationName) : null;
            const newContainer = inventory.createContainer({
              label: containerLabel,
              location_id: loc ? loc.id : null,
            });
            containerId = newContainer.id;
          }
        }

        if (locationName && !locationId) {
          const loc = inventory.findOrCreateLocation(locationName);
          locationId = loc.id;
        }

        const result = await inventory.createItem(
          {
            name: command.params.item_name,
            description: command.params.item_description,
            category: command.params.category,
            quantity: command.params.quantity || 1,
            container_id: containerId,
            location_id: locationId,
          },
          'whatsapp'
        );

        if (result.duplicate) {
          return `Looks like "${result.existingItemName}" already exists in your inventory (${result.reason}). If this is truly a NEW item, say "add new ${command.params.item_name}" to force add it.`;
        }

        let msg = `Added: ${result.name}`;
        if (result.container_label) msg += ` to ${result.container_label}`;
        if (result.location_name) msg += ` (${result.location_name})`;
        return msg;
      }

      case 'move_item': {
        // Find the item
        const searchResults = process.env.OPENAI_API_KEY
          ? await ai.aiSearch(command.params.item_name)
          : { results: inventory.quickSearch(command.params.item_name) };

        if (searchResults.results.length === 0) {
          return `Couldn't find "${command.params.item_name}" in your inventory.`;
        }

        const item = searchResults.results[0];
        let toContainerId = null;
        let toLocationId = null;

        if (command.params.to_container) {
          const container = inventory.getContainerByLabel(command.params.to_container);
          if (container) toContainerId = container.id;
          else {
            const newContainer = inventory.createContainer({ label: command.params.to_container });
            toContainerId = newContainer.id;
          }
        }

        if (command.params.to_location) {
          const location = inventory.findOrCreateLocation(command.params.to_location);
          toLocationId = location.id;
        }

        const moved = inventory.moveItem(item.id, toContainerId, toLocationId);
        return `Moved "${moved.name}" to ${moved.container_label || moved.location_name || 'new location'}`;
      }

      case 'remove_item': {
        const searchResults = process.env.OPENAI_API_KEY
          ? await ai.aiSearch(command.params.item_name)
          : { results: inventory.quickSearch(command.params.item_name) };

        if (searchResults.results.length === 0) {
          return `Couldn't find "${command.params.item_name}" in your inventory.`;
        }

        const item = searchResults.results[0];
        inventory.deleteItem(item.id);
        return `Removed "${item.name}" from your inventory.`;
      }

      case 'list': {
        let items;
        let label;

        if (command.params.container) {
          const container = inventory.getContainerByLabel(command.params.container);
          if (container) {
            items = inventory.getItemsByContainer(container.id);
            label = container.label;
          }
        } else if (command.params.location) {
          const location = inventory.getLocationByName(command.params.location);
          if (location) {
            items = inventory.getItemsByLocation(location.id);
            label = location.name;
          }
        } else if (command.params.category) {
          items = inventory.getItemsByCategory(command.params.category);
          label = command.params.category;
        }

        if (!items || items.length === 0) {
          return label ? `No items found in "${label}".` : "Couldn't find that location/container.";
        }

        let msg = `Items in ${label} (${items.length}):\n\n`;
        for (const item of items.slice(0, 15)) {
          msg += `* ${item.name}`;
          if (item.quantity > 1) msg += ` [qty: ${item.quantity}]`;
          msg += '\n';
        }
        if (items.length > 15) msg += `\n...and ${items.length - 15} more.`;
        return msg;
      }

      case 'status': {
        const stats = inventory.getStats();
        return `Inventory Summary:\n` +
          `* ${stats.totalItems} items\n` +
          `* ${stats.totalContainers} containers\n` +
          `* ${stats.totalLocations} locations\n` +
          `* ${stats.totalVoiceNotes} voice notes processed\n\n` +
          `Top categories:\n` +
          stats.categories.slice(0, 5).map((c) => `* ${c.category}: ${c.count} items`).join('\n');
      }

      case 'help':
        return `*Index - Inventory Manager*\n\n` +
          `I can help you manage your stuff! Here's what I can do:\n\n` +
          `*Search:* "Where's my drill?" or "Do I have any screws?"\n` +
          `*Add:* "I put a new hammer in Bin 5" or "Add a box of nails to the garage shelf"\n` +
          `*Move:* "I moved the drill to Bin 3"\n` +
          `*Remove:* "Remove the duct tape, I used it up"\n` +
          `*List:* "What's in Bin 1?" or "Show me all tools"\n` +
          `*Status:* "How much stuff do I have?"\n\n` +
          `You can also send voice notes to catalogue items!`;

      default:
        return `I'm not sure what you mean. Try asking "where's my [item]?" to search, or say "help" for options.`;
    }
  } catch (err) {
    console.error('[WhatsApp] Command processing error:', err);
    // Fallback to basic search
    const results = inventory.quickSearch(text);
    if (results.length > 0) {
      let msg = `Found ${results.length} item(s):\n`;
      for (const item of results.slice(0, 5)) {
        msg += `* ${item.name}`;
        if (item.container_label) msg += ` - ${item.container_label}`;
        msg += '\n';
      }
      return msg;
    }
    return "Sorry, I had trouble understanding that. Try rephrasing or say 'help' for options.";
  }
}

async function handleVoiceMessage(mediaUrl, from) {
  return "Voice messages via WhatsApp are received! For large cataloguing sessions, please use the Index web app to upload your voice notes. For quick additions, just type what you want to add.";
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
