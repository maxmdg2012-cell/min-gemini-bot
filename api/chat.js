import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // 1. Sätt CORS-headers så att din Neocities-sida tillåts prata med servern
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // 2. Släpp igenom webbläsarens säkerhetskontroll (OPTIONS) direkt med status 200 OK
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Hantera det vanliga chattmeddelandet (POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, model } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Meddelande saknas' });
        }

        const apiKey = process.env.GEMINI_API_KEY; 
        const ai = new GoogleGenAI({ apiKey: apiKey });

        let geminiModel = 'gemini-2.5-flash'; 
        if (model === '1.0') geminiModel = 'gemini-1.5-flash'; 
        if (model === '3.0') geminiModel = 'gemini-2.5-pro';   

        const response = await ai.models.generateContent({
            model: geminiModel,
            contents: message,
        });

        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Något gick fel på servern' });
    }
}
