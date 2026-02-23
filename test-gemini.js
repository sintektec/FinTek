import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API key found in .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, world!");
        const response = await result.response;
        console.log("Response:", response.text());
    } catch (error) {
        console.error("ERROR 1.5-Flash:", error.message);
    }

    try {
        const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result2 = await model2.generateContent("Hello, world!");
        const response2 = await result2.response;
        console.log("Response pro:", response2.text());
    } catch (error) {
        console.error("ERROR pro:", error.message);
    }
}

run();
