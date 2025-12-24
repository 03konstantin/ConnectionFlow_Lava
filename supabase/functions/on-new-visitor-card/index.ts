import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEmbedding(text: string, apiKey: string) {
  // 1. Готовим тело запроса
  const requestBody = {
    content: {
      parts: [{ text: text }]
    }
  };

  // 🔥 ЛОГ №1: ЧТО МЫ РЕАЛЬНО ОТПРАВЛЯЕМ? (В виде строки)
  const bodyString = JSON.stringify(requestBody);
  console.log(`[X-RAY REQUEST] Body: ${bodyString}`);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyString,
    }
  );

  // Получаем сырой текст ответа
  const rawResponse = await response.text();
  
  // 🔥 ЛОГ №2: ЧТО ОТВЕТИЛ GOOGLE? (Весь текст)
  // Мы обрезаем его до 200 символов, чтобы не спамить, но увидим начало
  console.log(`[X-RAY RESPONSE] Raw: ${rawResponse.substring(0, 300)}...`);

  if (!response.ok) {
    throw new Error(`Google API Error: ${rawResponse}`);
  }

  const data = JSON.parse(rawResponse);
  
  if (!data.embedding || !data.embedding.values) {
    console.error('[X-RAY ERROR] В ответе нет вектора!');
    throw new Error('Invalid Google Response');
  }

  return data.embedding.values;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { record } = await req.json();
    if (!record) return new Response('No record', { headers: corsHeaders });

    // Формируем текст
    const p = record.text_profession || '';
    const i = record.text_interests || '';
    const g = record.text_goal || '';
    const textToEmbed = `${p} ${i} ${g}`.replace(/\n/g, ' ').trim();

    console.log(`[X-RAY INPUT] ID: ${record.id}, Text: "${textToEmbed}"`);

    // Генерируем
    const vector = await generateEmbedding(textToEmbed, apiKey ?? '');

    // Обновляем базу
    await supabaseAdmin
      .from('visitor_cards')
      .update({ embedding: vector, scores: [] })
      .eq('id', record.id);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[CRITICAL ERROR]', error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});
