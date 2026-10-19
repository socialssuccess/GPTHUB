import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { generateVoice } from './voice.js';

const server = new McpServer({ name: 'gpthub-voice', version: '1.0.0' });
server.registerTool('generate_voiceover', {
  title: 'Generate channel voice-over',
  description: 'Generate local WAV audio using the single configured reference voice. Preserve the user’s script. Choose a delivery value automatically from the context when requested. Accept bracketed delivery, pause, and reaction cues. The tool parses them and keeps them out of spoken text. Emotions are approximate; unsupported cues return warnings. Reaction cues need configured local sound samples. Accents are unsupported. Maximum 1,500 characters; split long scripts at natural sentence boundaries. Returns a file path on the machine running this MCP server. No paid speech API. Voice similarity and emotional delivery vary.',
  inputSchema: {
    text: z.string().trim().min(1).max(1500).describe('The spoken script with optional bracketed cues, such as [calm], [short pause], or [excited].'),
    delivery: z.enum(['natural', 'calm', 'expressive']).default('natural').describe('Choose delivery automatically from script context, or follow the user’s preference.'),
    filename: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).optional().describe('Optional readable filename prefix, without an extension.'),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
}, async (input) => {
  try {
    const result = await generateVoice(input);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});
await server.connect(new StdioServerTransport());
