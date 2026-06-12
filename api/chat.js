import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
    // Sätt CORS-headers så att din Neocities-sida tillåts kommunicera med Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Släpp igenom webbläsarens säkerhetskontroll direkt
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages, model } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Ingen konversationshistorik skickades' });
        }

        const apiKey = process.env.GEMINI_API_KEY; 
        if (!apiKey) {
            return res.status(500).json({ error: 'Systemfel: Gemini API-nyckel saknas på servern' });
        }
        
        const ai = new GoogleGenAI({ apiKey: apiKey });

        // Här använder vi de moderna 2.5-modellerna som stöds fullt ut av det nya biblioteket
        let geminiModel = 'gemini-2.5-flash'; // Standard för 1.0 och 2.0
        if (model === '3.0') geminiModel = 'gemini-2.5-pro'; // För avancerade fildiskussioner

        // Formatera om historiken till Geminis struktur
        const formattedContents = messages.map(msg => {
            const role = msg.sender === 'user' ? 'user' : 'model';
            const parts = [];
            
            if (msg.text) {
                parts.push({ text: msg.text });
            }
            
            if (msg.file && msg.file.base64 && msg.file.mimeType) {
                const base64Data = msg.file.base64.includes(',') 
                    ? msg.file.base64.split(',')[1] 
                    : msg.file.base64;

                parts.push({
                    inlineData: {
                        mimeType: msg.file.mimeType,
                        data: base64Data
                    }
                });
            }

            return { role, parts };
        });

        // Systeminstruktioner för namn och strikta språkregler
        const systemInstruction = `Du är en avancerad AI-assistent som heter Nexus. 
Du måste svara på det språk som konversationen inleddes med (det allra första meddelandet i historiken).
Om användaren under konversationens gång ber om att byta språk eller börjar skriva på ett annat språk, måste du neka detta språkbyte och informera användaren om att de behöver starta en ny chatt i sidomenyn för att byta samtalsspråk.`;

        // Skicka förfrågan med de nya inställningarna
        const response = await ai.models.generateContent({
            model: geminiModel,
            contents: formattedContents,
            config: {
                systemInstruction: systemInstruction
            }
        });

        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error("Serverfel:", error);
        return res.status(500).json({ error: `Serverfel: ${error.message || JSON.stringify(error)}` });
    }
}
