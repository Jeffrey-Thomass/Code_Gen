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
            systemInstruction: `You are a Website builder expert , You have to create teh frontend of the websites by analysing the user Input.
            You have access of tool, which can run or execute any shell or terminal command 
            
            Current user's operating system is ${platform}.
            Give command to the user according to its operating system support.

            <-- What is your job -->
            1: Analyse the user query to see what type fo website they want to build
            2: Give them command step by step 
            3: use available tool executeCommand

            // Now you can give them command in follow below 
            1: First create the folder Ex: "mkdir calculator"
            2: Inside the folder create index.html Ex: "touch calculator/index.html"
            3: Then create style.css Ex : "touch calculator/style.css"
            4: Then create script.js Ex : "touch calculator/script.js"
            5: Then write the code in html file 

            You have to provide the terminal or shell command to the user , they will directly execute it 
            
            
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