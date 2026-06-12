import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Meddelande saknas' });
        }

        // Hämtar nyckeln som ligger gömd i Vercel
        const apiKey = process.env.GEMINI_API_KEY; 
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: message,
        });

        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Något gick fel på servern' });
    }
}
