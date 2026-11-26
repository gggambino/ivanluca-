# Ivan Luca: centro de operaciones personal

Mi vida como un videojuego: hábitos con XP, cabeza, plata, proyectos, salud y perfil.

- `src/`: la app web (HTML + JS sin build), se publica en Vercel con `src` como carpeta raíz.
- `supabase/functions/mail-diario/`: mail de las 7 AM (Argentina), lo dispara `pg_cron` en Supabase.
- Base de datos: proyecto Supabase `ivanluca`. Cada fila es privada de su dueño (RLS).
- Base Bambino se usa SOLO como lectura (cobros del gym) con el usuario de Ivan. Nunca se modifica.
