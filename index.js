import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import * as XLSX from 'xlsx';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';
import process from 'process';

// TTS client
const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// Voice: https://elevenlabs.io/app/api/voice-library?voiceId=uYXf8XasLslADfZ2MB4u
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'fIf7o10He0yWnub1BL80';

//Antoni (male, American)
//Domi (female, American)
//Ethan (male, American)

// Male American Voice: fIf7o10He0yWnub1BL80
// Male American Voice: IITmGTJxaDzkO5w3yYg7

// Paths — pass "answer" as the first CLI argument to switch mode
// Usage: node index.js answer
const mode = process.argv[1] === 'answer' ? 'answer' : 'question';
const xlsxPath = mode === 'answer' ? 'xlsx/828_Answer.xlsx' : 'xlsx/276_Question.xlsx';
const outputDir = mode === 'answer' ? 'mp3/answer/male' : 'mp3/question/male';

// Ensure output folder exists
await fs.promises.mkdir(outputDir, { recursive: true });

// Helper: check if file exists
async function fileExists(filePath) {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

// Generate audio for all words sequentially
async function generateAudio() {

    const workbook = XLSX.read(fs.readFileSync(xlsxPath));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    console.log(`📄 Loaded ${jsonData.length} words from ${xlsxPath}`);

    for (const row of jsonData) {
        const fileName = row["mp3"];
        const en = row["name"];
        const filePath = path.join(outputDir, fileName);

        if (await fileExists(filePath)) {
            console.log(`⏭️ Skipped (already exists): ${filePath}`);
            continue;
        }

        try {

            const response = await elevenlabs.textToSpeech.convert(
                VOICE_ID, // voice_id
                {
                    text: row["name"],
                    modelId: 'eleven_multilingual_v2',
                    outputFormat: 'mp3_44100_128', // output_format
                }
            );

            // response is a Readable stream — pipe it directly to disk
            await pipeline(response, fs.createWriteStream(filePath));

            console.log(`✅ Created: ${filePath}`);

            // Avoid hitting the API rate limit
            await new Promise(r => setTimeout(r, 300));
        } catch (err) {
            console.error(`❌ Error creating audio for "${en}":`, err);
        }
    }

    console.log("🎯 All words processed.");
}

// Run the generator
try {
    await generateAudio();
} catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
}