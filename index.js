import dotenv from 'dotenv'
import readlineSync from 'readline-sync'
import { FunctionResponse, GoogleGenAI } from "@google/genai";
import {exec} from "child_process"
import {promisify} from "util"
import { deserialize } from 'v8';
import os from 'os'

dotenv.config()

const history = [];
const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

const asyncExecute = promisify(exec);
const platform = os.platform();

// tool creating 

async function executeCommand({command}){
    try{
        const {stdout, stderr} = await asyncExecute(command);

        if(stderr){
            return `Error : ${stderr}`
        }
        return `Success : ${stdout} || Task executed successfully`;
    }
    catch(err){
        console.log(err);
        return err;
    }
    finally{
        console.log("command executed");

    }
}

const executeCommandDeclaration = {
    name : "executeCommand",
    description : "Execute a single terminal/shell command. A command can be to crate a folder, file, write on a file, edit he file or delete the file",
    parameters : {
        type : "OBJECT",
        properties : {
            command : {
                type : "STRING",
                description : 'It will be a single terminal command. Ex : "mkdir calculator" '
            }
        },
        required: ["command"],
    }
}

const availableTools = {
    executeCommand
}

async function runAgent(userQuery){
    history.push({
        role: "user",
        parts:[{text: userQuery}]
    })
    while(true){
    const response = await ai.models.generateContent({
        model : "gemini-2.5-flash",
        contents : history,
        config : {
            systemInstruction: `
You are a Website Builder AI.

Your job is to generate a COMPLETE frontend project setup using terminal commands.

⚠️ IMPORTANT RULES:
- DO NOT call any tools
- DO NOT generate step-by-step responses
- DO NOT wait for user confirmation
- DO NOT loop

✅ Instead:
- Analyse the user request
- Generate ALL required terminal commands in ONE response
- Include:
  1. Folder creation
  2. File creation
  3. Writing full code into files

💻 Output format:
- Return a clean list of shell commands
- Commands must be executable directly in terminal
- Use OS: ${platform}

Example structure:
mkdir project-name
touch project-name/index.html
touch project-name/style.css
touch project-name/script.js

# then writing code
echo "<html>...</html>" > project-name/index.html

🎯 Goal:
User should copy-paste and run everything at once without needing multiple steps.

⚠️ CODE QUALITY RULES:
- All JavaScript must be syntactically correct
- Use proper quotes for strings (' or ")
- Do NOT omit quotes anywhere
- Ensure code runs without errors
- Do NOT leave incomplete variables (e.g., let x = ;)
- Validate logic before output

⚠️ HTML/CSS/JS must be fully functional and tested logically before output
`,
            tools :[ 
                {
                functionDeclarations : [executeCommandDeclaration]
                }
            ]
        }
    })

    // if(response.functionCalls&&response.functionCalls.length>0){
    //     const {name , args} = response.functionCalls[0]
    //     const funCall = availableTools[name]
    //     const result = await funCall(args)

    //     // const functionRes = {
    //     //     name : name,
    //     //     response : {
    //     //         result : result
    //     //     }
    //     // }
    //     const functionRes = {
    //         name: name,
    //         response: {
    //             result: result
    //         },
    //         id: response.functionCalls[0].id   // 🔥 ADD THIS
    //     };

    //     history.push({
    //         role : "model",
    //         parts : [{
    //             functionCall : response.functionCalls[0],
    //         }]
    //     })
    //     history.push({
    //         role : "user",
    //         parts : [{
    //             functionResponse : functionRes
    //         }]

    //     })
    // }
    if (response.functionCalls && response.functionCalls.length > 0) {

        const functionCall = response.functionCalls[0];
        const { name, args, id } = functionCall;
    
        const tool = availableTools[name];
        const result = await tool(args);
    
        const functionRes = {
            name,
            response: { result },
            id
        };
    
        // ✅ CRITICAL: use FULL original parts
        history.push({
            role: "model",
            parts: response.candidates[0].content.parts
        });
    
        // ✅ send function response
        history.push({
            role: "user",
            parts: [{
                functionResponse: functionRes
            }]
        });
    
    } else {
        history.push({
            role: "model",
            parts: [{ text: response.text }]
        });
    
        console.log("🤖", response.text);
        break;
    }
    // else{
    //     history.push({
    //         role : "model",
    //         parts : [{text : response.text}]
    //     })
    //     console.log(response.text)
    //     break
    // }
}
}

async function main() {
    console.log("Let's create a website");
    while (true) {
        const userInput = readlineSync.question("You --> ");

        // 🛑 exit condition
        if (userInput.toLowerCase() === "exit") {
            console.log("👋 Bye!");
            break;
        }

        await runAgent(userInput);
    }
}

main();