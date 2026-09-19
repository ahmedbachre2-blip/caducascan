import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
});

export interface ReceiptItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

export async function extractReceiptItems(
  imageBase64: string
): Promise<ReceiptItem[]> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not set");
    return [];
  }

  const prompt = "Analiza esta imagen de un ticket de supermercado. Extrae TODOS los productos. Devuelve SOLO un array JSON valido con esta estructura: [{\"name\":\"nombre del producto\",\"quantity\":1,\"totalPrice\":1.20}]. Sin texto adicional, solo el array JSON.";

  try {
    const response = await client.chat.completions.create({
      model:  "inclusionai/ling-3.0-flash-vl:free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: "data:image/jpeg;base64," + imageBase64,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || "";
    console.error("OpenRouter raw response:", content.substring(0, 500));

    if (!content) return [];

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("OpenRouter error:", JSON.stringify(error, null, 2));
    return [];
  }
}