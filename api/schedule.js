export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { rawSchedule, imageBase64, imageMimeType } = body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.Schedule_API || process.env.API_KEY;

    if (!rawSchedule && !imageBase64) {
      return res.status(400).json({ error: 'Ingen text eller bild skickades.' });
    }
    if (!apiKey) return res.status(500).json({ error: 'API-nyckel saknas i Vercel.' });

    // Världsklass-prompt som fixar alla språk, förkortningar och snygg sortering
    const promptText = `You are a world-class universal schedule organizer and OCR expert. 
Extract the schedule from the provided input (text or image) regardless of international layout or language.

Strict Rules:
1. LANGUAGE & ABBREVIATIONS: Detect the input language automatically. Expand all local abbreviations into full formal words in that SAME language (e.g., in Swedish expand "tis" -> "Tisdag", "mån" -> "Måndag", "ma" -> "Matematik"; in English expand "Mon" -> "Monday", "Tue" -> "Tuesday", etc.).
2. TIME NORMALIZATION: Standardize times into clean formats (e.g. "08:00 - 09:30" or "14:00").
3. STRUCTURE: Every object in the list MUST have these exact 4 keys:
   - "day": Full day name or date (e.g., "Tisdag", "Monday").
   - "time": Clean time range or "N/A".
   - "activity": Full name of the subject/meeting/event.
   - "location": Room, building, address, or "N/A".
4. CHRONOLOGICAL ORDER: Sort the objects strictly by day of the week and start time, like a realistic schedule.
5. OUTPUT: Return ONLY a valid raw JSON array of these objects. No preamble, no Markdown wrapping.

Input Text (if provided):
${rawSchedule || 'Analyze attached image.'}`;

    let parts = [{ text: promptText }];
    
    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: imageMimeType,
          data: imageBase64
        }
      });
    }

    const models = ['gemini-3.5-flash-lite', 'gemini-2.5-flash'];
    let response, data;

    for (const model of models) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      data = await response.json();
      if (response.ok) break;
    }

    if (!response.ok) {
      return res.status(500).json({ error: `Gemini Fel (${response.status}): ${data.error?.message || 'Fel från AI'}` });
    }

    let rawJson = data.candidates[0].content.parts[0].text;
    const parsedSchedule = JSON.parse(rawJson);

    return res.status(200).json({ schedule: parsedSchedule });
  } catch (error) {
    return res.status(500).json({ error: `Serverfel: ${error.message}` });
  }
}
