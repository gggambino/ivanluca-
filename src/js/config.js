// Proyecto personal (Supabase "ivanluca"). La clave publicable es segura en el navegador:
// la seguridad real la dan las políticas RLS (cada fila solo la ve su dueño).
export const SUPABASE_URL = 'https://bvegileafqnuqasmuxtj.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Brnd5A4DLovl4dIqtbGc7Q_KlT0fTPV';

// Base Bambino: SOLO LECTURA. Se entra con el usuario de Ivan y se leen sus cobros.
// La app nunca escribe ni modifica nada en Base Bambino.
export const BB_URL = 'https://ohbzudwnvcneriisjkcw.supabase.co';
export const BB_KEY = 'sb_publishable_SwnH85zmoMsyriBQb1VlWw_LfyLDE1Y';

export const AREAS = {
  salud:      { l: 'Salud',           ic: '❤', c: '#E5484D' },
  ingresos:   { l: 'Ingresos',        ic: '$', c: '#16A34A' },
  proyectos:  { l: 'Proyectos',       ic: '◆', c: '#2563EB' },
  relaciones: { l: 'Relaciones',      ic: '☺', c: '#DB2777' },
  imagen:     { l: 'Imagen personal', ic: '★', c: '#F59E0B' },
  bienestar:  { l: 'Bienestar',       ic: '☯', c: '#0891B2' },
  negocios:   { l: 'Negocios',        ic: '▲', c: '#7C3AED' },
};

export const CAT_GASTO = ['Comida', 'Súper', 'Uber / transporte', 'Salidas', 'Ropa / imagen', 'Salud / suple', 'Suscripciones', 'Casa', 'Regalos', 'Otros'];
export const CAT_INGRESO = ['Clases 1 a 1', 'Grupales', 'Online', 'BambinoShop', 'Software con Cris', 'Webs', 'Otro'];
