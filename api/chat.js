import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
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

        // Här kopplar vi dina coola Nexus-namn till Googles riktiga modeller
        let geminiModel = 'gemini-2.5-flash'; // Standard för Nexus 2.0
        if (model === '1.0') geminiModel = 'gemini-1.5-flash'; // Snabbare, lättare
        if (model === '3.0') geminiModel = 'gemini-2.5-pro';   // Den tyngsta och smartaste

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
