// Completá estos valores con tu proyecto de Supabase (Project Settings → API).
// En Vercel también podés regenerar este archivo en el deploy, o pegar acá directo.
window.HOGAR_CONFIG = {
  // Sin /rest/v1 al final — solo la URL del proyecto
  supabaseUrl: "https://uqnxalsjlljnzdlljbwm.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbnhhbHNqbGxqbnpkbGxqYndtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMTIyNTUsImV4cCI6MjEwNjc4ODI1NX0.sDEZl8BP-TiJBOvR0GamhIB2baHz9QohIDWkGOd0E1E",
  // En pantalla se elige Guada / Ema; por detrás usan estos emails de Auth
  users: {
    guadalupe: {
      email: "guada@hogar.app",
      name: "Guadalupe",
      short: "Guada",
    },
    emanuel: {
      email: "ema@hogar.app",
      name: "Emanuel",
      short: "Ema",
    },
  },
};
