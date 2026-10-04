import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ✅ إصلاح مشكلة Vercel Timeout: تعيين الحد الأقصى لمدة الدالة
export const maxDuration = 60;

// ✅ إصلاح مشكلة Vercel Timeout: تقليص النماذج إلى أفضل 3 نماذج سريعة ومستقرة فقط
const FREE_VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
  "inclusionai/ling-3.0-flash-vl:free",
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
    // ✅ تم تصحيح الاسم هنا ليتطابق مع ما ترسله الواجهة
    const base64Image = body.imageBase64; 

    if (!base64Image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 });
    }

    // ✅ تجهيز الصورة بالصيغة التي يفهمها OpenRouter
    const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

    let lastError = null;

    for (const modelId of FREE_VISION_MODELS) {
      try {
        console.log(`🔄 Attempting model: ${modelId}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                    // ✅ نص تعليمي دقيق جداً لإجبار الذكاء الاصطناعي على إرجاع JSON نظيف
                    text: "Extract all products from this receipt image. Return ONLY a valid JSON array. Do not include markdown formatting like ```json. The format must be exactly: [{\"name\": \"Product Name\", \"quantity\": 1, \"totalPrice\": 1.50}]."
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageUrl }
                  }
                ]
              }
            ],
            max_tokens: 1500,
            temperature: 0.1,
          }),
          // ✅ إصلاح مشكلة Vercel Timeout: إضافة مهلة زمنية 5 ثوانٍ لكل طلب
          signal: AbortSignal.timeout(5000),
        });

        // إذا نجح الطلب
        if (response.ok) {
          const data = await response.json();
          let content = data.choices[0].message.content;

          // تنظيف النص من أي علامات Markdown قد يضيفها الذكاء الاصطناعي
          content = content.replace(/```json/g, '').replace(/```/g, '').trim();

          let items = [];
          try {
            items = JSON.parse(content);
          } catch {
            console.error("❌ AI returned invalid JSON:", content);
            lastError = "AI returned invalid JSON format";
            continue; // جرب النموذج التالي
          }

          console.log(`✅ Success with model: ${modelId}`);
          return NextResponse.json({ success: true, model: modelId, items });
        }

        // التعامل مع الأخطاء (مثل 429)
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        console.log(`❌ Model ${modelId} failed: ${status}`);
        lastError = errorData.error?.message || `Status ${status}`;
        
        // إذا كان الخطأ 429 (طلبات كثيرة) أو 5xx، جرب النموذج التالي
        if (status === 429 || status >= 500) continue;
        
      } catch (error) {
        console.error(`Error with ${modelId}:`, error);
        lastError = error instanceof Error ? error.message : "Unknown error";
      }
    }

    return NextResponse.json(
      { error: "All free models are currently unavailable. Please try again later.", details: lastError },
      { status: 503 }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}