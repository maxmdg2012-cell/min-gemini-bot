export default async function handler(req, res) {
  // Tillåt anrop från Neocities (CORS)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Hantera webbläsarens säkerhetsanrop (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Endast POST är tillåtet' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { rawSchedule } = body;
    
    // Hämtar nyckeln från Vercel
    const apiKey = process.env.GEMINI_API_KEY || process.env.Schedule_API || process.env.API_KEY;

    if (!rawSchedule) {
      return res.status(400).json({ error: 'Ingen text skickades.' });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'API-nyckel saknas i Vercel (GEMINI_API_KEY).' });
    }

    const promptText = `You are a schedule organizer. Take this messy text and convert it into a clean JSON array of objects.
Strict rules:
1. LANGUAGE: Detect automatically. Write output (day, activity, location) in the EXACT same language as input.
2. STRUCTURE: Every object must have these keys: "day", "time", "activity", "location".
3. MISSING DATA: Use "N/A".
4. OUTPUT: Return only valid raw JSON array.

Text:
${rawSchedule}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();

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
