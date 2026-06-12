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

        // Välj rätt modell baserat på valet i chatten
        let geminiModel = 'gemini-2.5-flash'; // Standard för 1.0 och 2.0
        if (model === '3.0') geminiModel = 'gemini-2.5-pro'; // För avancerade diskussioner

        // SÄKERHETSÅTGÄRD MOT 500 TIMEOUT: 
        // Vi behåller bara de senaste 12 meddelandena för att servern inte ska krascha vid långa chattar.
        const maxHistory = 12;
        const recentMessages = messages.length > maxHistory 
            ? messages.slice(-maxHistory) 
            : messages;

        // Formatera om historiken till Geminis struktur
        const formattedContents = recentMessages.map((msg, index) => {
            const role = msg.sender === 'user' ? 'user' : 'model';
            const parts = [];
            
            if (msg.text) {
                parts.push({ text: msg.text });
            }
            
            // OPTIMERING: Skicka bara med tunga bilddata om bilden skickades i de absolut senaste meddelandena.
            // Gamla bilder i historiken rensas bort på servernivå för att spara tid och förhindra lagg.
            const isRecentEnoughForFile = (recentMessages.length - index) <= 3;

            if (msg.file && msg.file.base64 && msg.file.mimeType && isRecentEnoughForFile) {
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

        // Skicka förfrågan till Gemini
        const response = await ai.models.generateContent({
            model: geminiModel,
            contents: formattedContents,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.7 // Lägre temperatur = Snabbare, säkrare svar och mindre risk för timeout!
            }
        });

        return res.status(200).json({ text: response.text });

    } catch (error) {
        console.error("Serverfel:", error);
        return res.status(500).json({ error: `Serverfel: ${error.message || JSON.stringify(error)}` });
    }
}
