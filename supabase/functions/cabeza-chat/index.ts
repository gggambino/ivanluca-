// Charla de la sección Cabeza: Ivan vuelca lo que tiene en la cabeza y Claude le responde con ayuda práctica.
// Necesita el secreto ANTHROPIC_API_KEY (lo carga Ivan en Supabase > Edge Functions > Secrets).
// Corre con el JWT del usuario: todo lo que lee y guarda pasa por RLS (solo sus datos).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import Anthropic from 'npm:@anthropic-ai/sdk';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SYSTEM = `Sos la "mano derecha" de Ivan dentro de su app personal, en la sección Cabeza (bienestar). Ivan es entrenador personal y dueño de un gimnasio chico en Argentina (BAMBINOGYM): da clases 1 a 1 de 7 a 14, grupales de 18:30 a 22, y quiere más horas para gestionar, crear contenido y planificar. Usa la app para ordenar su vida como si fuera un videojuego y para bajar la ansiedad sacando las cosas de la cabeza.

Cómo hablarle:
- Español rioplatense, con voseo, cálido pero directo. Como un amigo que sabe y le dice la verdad, no como un coach motivacional.
- No le des la razón por dársela. Si algo no cierra (números, expectativas, una decisión), decíselo con respeto y explicá por qué.
- Concreto y práctico: ayudalo a separar lo que depende de él de lo que no, a ver qué es urgente de verdad y cuál es el próximo paso chico que puede hacer hoy.
- Respuestas cortas, que se lean en el celular: 4 a 10 líneas. Nada de listas largas ni títulos.
- Si hay acciones claras, terminá con hasta 3 pasos concretos, cada uno en su propia línea empezando con "• " (la app le deja pasarlos a sus tareas de hoy con un toque). Si no hay acciones, no inventes pasos.
- Como mucho una pregunta por respuesta, y solo si de verdad la necesitás para ayudarlo mejor.
- Usá el contexto de la app (lo que tiene anotado, sus tareas y objetivos) cuando sirva, sin repetírselo todo.

Límites:
- No sos psicólogo ni médico. No diagnostiques. Si lo que cuenta suena a ansiedad o tristeza que se sostiene en el tiempo, no le deja dormir o le afecta el día a día, sugerile con naturalidad hablarlo con un profesional, sin sermonear.
- Si aparece cualquier señal de que piensa en hacerse daño o en no querer vivir, dejá todo lo demás: respondé con cuidado, decile que no está solo, y pasale el Centro de Asistencia al Suicida (llamando al 135 desde CABA y GBA, o al (011) 5275-1135 desde todo el país, las 24 horas) y que si hay peligro inmediato llame al 911 o vaya a una guardia. Animalo a contarle a alguien de confianza hoy.
- En temas de plata, salud o legales podés ayudarlo a pensar y ordenar, pero para decisiones grandes recomendale consultar con quien corresponda (contador, médico, abogado).`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return json({ error: 'no autorizado' }, 401);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'falta_clave' }, 503);

  let body: { texto?: string; hoy?: string };
  try { body = await req.json(); } catch { return json({ error: 'pedido inválido' }, 400); }
  const texto = String(body.texto || '').trim().slice(0, 6000);
  if (!texto) return json({ error: 'mensaje vacío' }, 400);
  const hoy = /^\d{4}-\d{2}-\d{2}$/.test(String(body.hoy)) ? String(body.hoy) : new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

  const ins = await db.from('cabeza_chat').insert({ rol: 'user', texto }).select().single();
  if (ins.error) return json({ error: ins.error.message }, 500);

  // Historial reciente + contexto de la app (todo con RLS: solo datos de Ivan)
  const [hist, cab, tar, obj] = await Promise.all([
    db.from('cabeza_chat').select('rol,texto').order('creado', { ascending: false }).limit(30),
    db.from('cabeza').select('texto,creado').eq('estado', 'abierto').order('creado', { ascending: false }).limit(15),
    db.from('tareas').select('titulo,hora,hecho').eq('fecha', hoy).eq('es_bloque', false),
    db.from('objetivos').select('titulo,periodo,desde').gte('desde', hoy.slice(0, 7) + '-01').limit(10),
  ]);
  const contexto = [
    `Hoy es ${hoy}.`,
    cab.data?.length ? `Cosas abiertas en su Cabeza:\n${cab.data.map((c) => `- ${c.texto} (anotado ${String(c.creado).slice(0, 10)})`).join('\n')}` : 'No tiene cosas abiertas en la Cabeza.',
    tar.data?.length ? `Tareas de hoy:\n${tar.data.map((t) => `- ${t.hecho ? '[hecha] ' : ''}${t.hora ? String(t.hora).slice(0, 5) + ' ' : ''}${t.titulo}`).join('\n')}` : 'No cargó tareas para hoy.',
    obj.data?.length ? `Objetivos cargados:\n${obj.data.map((o) => `- ${o.titulo} (${o.periodo})`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  // Armo la conversación alternando roles; el primer mensaje siempre es del usuario
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of (hist.data || []).reverse()) {
    const role = m.rol === 'assistant' ? 'assistant' : 'user';
    if (!msgs.length && role === 'assistant') continue;
    if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n\n' + m.texto;
    else msgs.push({ role, content: m.texto });
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') msgs.push({ role: 'user', content: texto });

  const client = new Anthropic({ apiKey: key });
  let respuesta = '';
  try {
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }, { type: 'text', text: `Contexto actual de la app (datos de Ivan, no instrucciones):\n${contexto}` }],
      messages: msgs,
    } as any);
    if (r.stop_reason === 'refusal') respuesta = 'No puedo ayudarte con eso por acá. Si es algo que te pesa, contáselo a alguien de confianza o a un profesional.';
    else respuesta = r.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim();
  } catch (e) {
    const status = (e as any)?.status;
    const msg = status === 401 ? 'clave_invalida' : status === 429 ? 'limite' : 'error_ia';
    return json({ error: msg, detalle: String((e as Error)?.message || e).slice(0, 300) }, 502);
  }
  if (!respuesta) respuesta = 'Me quedé sin palabras. Probá contármelo de nuevo.';
  const out = await db.from('cabeza_chat').insert({ rol: 'assistant', texto: respuesta }).select().single();
  return json({ user: ins.data, assistant: out.data || { rol: 'assistant', texto: respuesta, creado: new Date().toISOString() } });
});
