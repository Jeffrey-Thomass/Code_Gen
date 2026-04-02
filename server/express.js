import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import { promisify } from "util";
import os from 'os';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allows React frontend to make requests
app.use(express.json()); // Parses incoming JSON data

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const asyncExecute = promisify(exec);
const platform = os.platform();

// Store chat histories per session/user in memory
const chatHistories = new Map();

// --- Tool Setup ---
const availableTools = {
    executeCommand: async ({ command }) => {
        try {
            const { stdout, stderr } = await asyncExecute(command);
            if (stderr) return `Error : ${stderr}`;
            return `Success : ${stdout} || Task executed successfully`;
        } catch (err) {
            return `Execution Error: ${err.message}`;
        }
    },
    writeFile: async ({ filePath, content }) => {
        try {
            // Ensure the directory exists before writing the file
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf8');
            return `Success: Wrote file to ${filePath}`;
        } catch (err) {
            return `File Write Error: ${err.message}`;
        }
    }
};

const toolsConfig = [{
    functionDeclarations: [
        {
            name: "executeCommand",
            description: "Execute a single terminal/shell command like mkdir.",
            parameters: {
                type: "OBJECT",
                properties: { command: { type: "STRING", description: 'e.g. "mkdir my-folder"' } },
                required: ["command"],
            }
        },
        {
            name: "writeFile",
            description: "Write code or content directly into a file. Use this instead of echo or cat.",
            parameters: {
                type: "OBJECT",
                properties: {
                    filePath: { type: "STRING", description: "The full path to the file" },
                    content: { type: "STRING", description: "The exact code/content to write" }
                },
                required: ["filePath", "content"],
            }
        }
    ]
}];

// --- API Endpoint ---
app.post('/api/chat', async (req, res) => {
    const { message, sessionId = `project-${Date.now()}` } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    // Define where this specific session's files will be saved
    const projectFolderPath = path.join(process.cwd(), sessionId);

    // Initialize history for this session if it doesn't exist
    if (!chatHistories.has(sessionId)) {
        chatHistories.set(sessionId, []);
    }
    const history = chatHistories.get(sessionId);

    // Add user message to history
    history.push({ role: "user", parts: [{ text: message }] });

    try {
        // The AI Loop
        while (true) {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash", // Use a valid model (e.g., gemini-2.0-flash or 2.5)
                contents: history,
                config: {
                    systemInstruction: `You are an expert AI Website Builder.
                    
                    CRITICAL RULE: You MUST create all folders and files inside this exact directory path: ${projectFolderPath}
                    Target OS: ${platform}.
        
                    <-- Workflow -->
                    1. Analyze the requested website.
                    2. Create the main project folder using executeCommand.
                    3. Write the necessary HTML, CSS, and JS files using the writeFile tool. 
                    4. Ensure all code is complete and functional. Do not use placeholders.
                    5. Once all files are written, reply with a short success message. Do not ask for further confirmation.`,
                    tools: toolsConfig
                }
            });

            // Handle Tool Calls
            if (response.functionCalls && response.functionCalls.length > 0) {
                const functionCall = response.functionCalls[0];
                const { name, args, id } = functionCall;

                console.log(`\n⚙️ Executing tool: ${name} ...`);
                const tool = availableTools[name];
                const result = await tool(args);

                // Add model's tool call to history
                history.push({ role: "model", parts: response.candidates[0].content.parts });

                // Add tool's result to history
                history.push({
                    role: "user",
                    parts: [{ functionResponse: { name, response: { result }, id } }]
                });

            } else {
                // The AI is done and returned text
                const reply = response.text;
                history.push({ role: "model", parts: [{ text: reply }] });
                console.log("\n🤖 AI finished building. Zipping files...");
                
                // Check if the AI actually created the folder
                if (fs.existsSync(projectFolderPath)) {
                    // Create a zip file
                    const zip = new AdmZip();
                    zip.addLocalFolder(projectFolderPath);
                    const zipBuffer = zip.toBuffer();

                    // Cleanup: Delete the unzipped folder to save server space
                    fs.rmSync(projectFolderPath, { recursive: true, force: true });

                    // Send the zip file back to the React client
                    res.set('Content-Type', 'application/zip');
                    res.set('Content-Disposition', `attachment; filename=${sessionId}.zip`);
                    return res.send(zipBuffer);
                } else {
                    return res.status(500).json({ error: "AI failed to generate the files." });
                }
            }
        }
    } catch (error) {
        console.error("AI Error:", error);
        return res.status(500).json({ error: "Something went wrong processing your request." });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});