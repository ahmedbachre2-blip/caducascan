import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ✅ إصلاح مشكلة Vercel Timeout: تعيين الحد الأقصى لمدة الدالة
export const maxDuration = 60;

// ✅ إصلاح مشكلة Vercel Timeout: تقليص النماذج إلى أفضل 3 نماذج سريعة ومستقرة فقط
const FREE_VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "google/gemini-flash-1.5-8b:free",
];

export async function POST(req: NextRequest) {
  try {
    // ✅ إصلاح ثغرة API Abuse: التحقق من هوية المستخدم عبر Supabase
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value },
          set(name, value, options) { cookieStore.set({ name, value, ...options }) },
          remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to use this feature." }, 
        { status: 401 }
      );
    }

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
            // ✅ إصلاح مشكلة Vercel Timeout: إضافة مهلة زمنية 5 ثوانٍ لكل طلب
            signal: AbortSignal.timeout(5000),
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