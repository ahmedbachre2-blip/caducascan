import { NextRequest, NextResponse } from "next/server";

// ✅ قائمة موسعة تضم 27 نموذجاً مجانياً يدعم الرؤية (سبتمبر 2026)
// مرتبة من الأفضل إلى الأقل، وسيتم تجربة كل واحد بالتتابع
const FREE_VISION_MODELS = [
  // --- Google Gemini (الأكثر استقراراً) ---
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-flash-1.5-8b:free",
  "google/gemini-2.5-flash-preview:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  
  // --- Qwen (ممتاز للصور والنصوص) ---
  "qwen/qwen2.5-vl-72b-instruct:free",
  "qwen/qwen2.5-vl-32b-instruct:free",
  "qwen/qwen2.5-vl-7b-instruct:free",
  "qwen/qwen-2-vl-7b-instruct:free",
  "qwen/qwen2-vl-7b-instruct:free",
  
  // --- Meta Llama (قوي ومجاني) ---
  "meta-llama/llama-3.2-11b-vision-instruct:free",
  "meta-llama/llama-3.2-90b-vision-instruct:free",
  "meta-llama/llama-3.1-70b-instruct:free",
  
  // --- Nvidia ---
  "nvidia/nemotron-nano-12b-v2-vl:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  
  // --- Microsoft ---
  "microsoft/phi-3.5-vision-instruct:free",
  
  // --- Mistral ---
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "mistralai/mistral-nemo:free",
  
  // --- نماذج أخرى ---
  "inclusionai/ling-3.0-flash-vl:free",
  "dots-studio/dots-3-note-preview:free",
  "z-ai/glm-4.5-air:free",
  "deepseek/deepseek-r1:free",
  "xiaomi/mimo-v2-flash:free",
  
  // --- Router ذكي (يختار أفضل نموذج تلقائياً) ---
  "openrouter/free",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base64Image = body.imageBase64;

    if (!base64Image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    // تجهيز الصورة بالصيغة الصحيحة
    const imageUrl = base64Image.startsWith("data:")
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;

    let lastError: string | null = null;
    let attemptCount = 0;

    // ✅ تجربة كل نموذج بالتتابع
    for (const modelId of FREE_VISION_MODELS) {
      attemptCount++;
      try {
        console.log(
          `🔄 [${attemptCount}/${FREE_VISION_MODELS.length}] Attempting model: ${modelId}`
        );

        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://caducascan-es.vercel.app",
              "X-Title": "CaducaScan",
            },
            body: JSON.stringify({
              model: modelId,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `Analyze this image of a product label or package. Find the expiration date (look for: EXP, Caducidad, Consumir preferentemente antes de, Fecha de caducidad, Best before, Use by, etc.).

Return ONLY a valid JSON object with ONE key: 'expirationDate' in ISO format (YYYY-MM-DD).

Examples of valid responses:
- {"expirationDate": "2026-12-31"}
- {"expirationDate": "2027-03-15"}
- {"expirationDate": null} (if no date found)

Do NOT include any markdown formatting, explanations, or additional text. Only the JSON object.`,
                    },
                    {
                      type: "image_url",
                      image_url: { url: imageUrl },
                    },
                  ],
                },
              ],
              max_tokens: 150,
              temperature: 0.1,
            }),
          }
        );

        // ✅ إذا نجح الطلب
        if (response.ok) {
          const data = await response.json();
          let content = data.choices?.[0]?.message?.content;

          if (!content) {
            console.error(`❌ [${modelId}] Empty response`);
            lastError = "Empty response from AI";
            continue;
          }

          // تنظيف النص من أي علامات Markdown
          content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

          let parsed: { expirationDate?: string | null } | null = null;
          try {
            parsed = JSON.parse(content);
          } catch {
            console.error(`❌ [${modelId}] Invalid JSON:`, content);
            lastError = "AI returned invalid JSON format";
            continue;
          }

          // ✅ التحقق من وجود التاريخ
          if (parsed && parsed.expirationDate) {
            console.log(`✅ Success with model: ${modelId}`);
            console.log(`📅 Date found: ${parsed.expirationDate}`);
            return NextResponse.json({
              success: true,
              model: modelId,
              expirationDate: parsed.expirationDate,
            });
          } else {
            console.log(`⚠️ [${modelId}] No date found in image`);
            lastError = "No date found in the image. Try a clearer photo.";
            continue;
          }
        }

        // ✅ التعامل مع الأخطاء
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        console.log(`❌ Model ${modelId} failed with status: ${status}`);

        lastError =
          errorData.error?.message ||
          errorData.message ||
          `HTTP Status ${status}`;

        // إذا كان الخطأ 429 (Rate Limit) أو 5xx (Server Error)، جرب النموذج التالي
        if (status === 429 || status >= 500) {
          continue;
        }

        // إذا كان الخطأ 401 (مفتاح خاطئ)، توقف فوراً
        if (status === 401) {
          return NextResponse.json(
            { error: "Invalid OpenRouter API key" },
            { status: 401 }
          );
        }

        // لجميع الأخطاء الأخرى، جرب النموذج التالي
        continue;
      } catch (error) {
        console.error(`❌ Error with ${modelId}:`, error);
        lastError = error instanceof Error ? error.message : "Unknown error";
        continue;
      }
    }

    // ✅ إذا فشلت جميع النماذج
    console.error(`❌ All ${FREE_VISION_MODELS.length} models failed`);
    return NextResponse.json(
      {
        error:
          "All free models are currently unavailable. Please try again in a few minutes.",
        details: lastError,
        modelsTried: FREE_VISION_MODELS.length,
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}