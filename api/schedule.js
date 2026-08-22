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
    // Nu letar vi efter antingen text ELLER en bild (i base64-format)
    const { rawSchedule, imageBase64, imageMimeType } = body;
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.Schedule_API || process.env.API_KEY;

    if (!rawSchedule && !imageBase64) {
      return res.status(400).json({ error: 'Ingen text eller bild skickades.' });
    }
    if (!apiKey) return res.status(500).json({ error: 'API-nyckel saknas i Vercel.' });

    const promptText = `You are a schedule organizer. Extract the schedule from the provided text or image and convert it into a clean JSON array of objects.
Strict rules:
1. LANGUAGE: Detect automatically. Write output in the EXACT same language as input.
2. STRUCTURE: Every object must have these keys: "day", "time", "activity", "location".
3. MISSING DATA: Use "N/A".
4. OUTPUT: Return only valid raw JSON array.

Text (if any):
${rawSchedule || 'Se bifogad bild.'}`;

    // Bygg upp det som ska skickas till Gemini
    let parts = [{ text: promptText }];
    
    // Om en bild skickades med från hemsidan, lägg till den!
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
