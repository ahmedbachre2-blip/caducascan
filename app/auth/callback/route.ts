import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // 1. إصلاح ثغرة Open Redirect: التأكد من أن الرابط داخلي فقط
  const rawNext = searchParams.get('next') ?? '/'
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/'

  // 2. إصلاح مشكلة Proxy على Vercel: استخراج النطاق الحقيقي
  const forwardedHost = request.headers.get('x-forwarded-host')
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const siteUrl = forwardedHost ? `${proto}://${forwardedHost}` : origin

  if (code) {
    // 3. إصلاح Next.js 15: cookies() أصبحت غير متزامنة وتحتاج إلى await
    const cookieStore = await cookies()
    
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
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/auth/auth-code-error`)
}