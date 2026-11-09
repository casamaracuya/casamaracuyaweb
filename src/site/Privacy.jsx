import { useEffect } from "react";
import "./site.css";

// Política de privacidad. Es un texto base: la dueña debe revisarlo (idealmente con un abogado)
// antes de darlo por definitivo. Fecha de la última revisión en UPDATED.
const UPDATED = { es: "8 de noviembre de 2026", en: "November 8, 2026" };
const EMAIL = "reservas@casa-maracuya.com";

const TXT = {
  es: {
    title: "Política de privacidad",
    back: "Volver a la página",
    updated: "Última actualización",
    sections: [
      ["Quiénes somos", `Casa Maracuyá es una casa de descanso en Adícora, estado Falcón, Venezuela. Para cualquier pregunta sobre tus datos escríbenos a ${EMAIL}.`],
      ["Qué datos guardamos", "Cuando pides una estadía desde esta página guardamos tu nombre, tu número de WhatsApp, el plan, las fechas, cuántas personas vienen, si viajas con mascota y los comentarios que escribas. Si nos visitas, también podemos anotar lo que tú nos cuentes para atenderte mejor: alergias, gustos o fechas especiales."],
      ["Para qué los usamos", "Solo para responder tu solicitud, organizar tu estadía y recibirte como te gusta la próxima vez. No vendemos ni compartimos tus datos con terceros para publicidad."],
      ["Quién los ve", "Tus datos se guardan en un servicio en la nube con acceso protegido. Solo el equipo de la casa entra, cada persona con su propio usuario y viendo únicamente lo que necesita para su trabajo."],
      ["Cuánto tiempo los guardamos", "Mientras tengamos una relación contigo como huésped. Puedes pedirnos que los borremos cuando quieras."],
      ["Tus derechos", `Puedes pedirnos ver, corregir o borrar tus datos escribiendo a ${EMAIL}. Te respondemos lo antes posible.`],
      ["Cookies y medición", "No usamos cookies de publicidad. Tu navegador recuerda el idioma y el modo día o noche que elijas. Medimos las visitas de forma anónima, sin cookies."]
    ]
  },
  en: {
    title: "Privacy policy",
    back: "Back to the website",
    updated: "Last updated",
    sections: [
      ["Who we are", `Casa Maracuyá is a holiday home in Adícora, Falcón, Venezuela. For any question about your data, write to ${EMAIL}.`],
      ["What we keep", "When you request a stay on this website we keep your name, your WhatsApp number, the stay, your dates, how many guests are coming, whether you bring a pet and any comments you write. If you stay with us, we may also note what you tell us so we can take better care of you: allergies, preferences or special dates."],
      ["What we use it for", "Only to answer your request, organize your stay and welcome you the way you like next time. We don't sell or share your data with third parties for advertising."],
      ["Who can see it", "Your data is stored in a cloud service with protected access. Only the house team can sign in, each person with their own account and seeing only what they need for their work."],
      ["How long we keep it", "For as long as we have a relationship with you as a guest. You can ask us to delete it at any time."],
      ["Your rights", `You can ask us to see, correct or delete your data by writing to ${EMAIL}. We'll reply as soon as possible.`],
      ["Cookies and analytics", "We don't use advertising cookies. Your browser remembers the language and the day or night mode you choose. We count visits anonymously, without cookies."]
    ]
  }
};

export default function Privacy() {
  const lang = (() => { try { return localStorage.getItem("maracuya-idioma") || ((navigator.language || "").toLowerCase().startsWith("en") ? "en" : "es"); } catch { return "es"; } })();
  const d = TXT[lang] || TXT.es;
  useEffect(() => { document.documentElement.lang = lang; document.title = `${d.title} · Casa Maracuyá`; window.scrollTo(0, 0); }, []);
  return (
    <main className="privacy">
      <div className="wrap">
        <a className="brand" href="/" aria-label="Casa Maracuyá"><img src="/logo/logo-dorado.svg" alt="Maracuyá Relaxing Getaway" width="131" height="52" /></a>
        <h1>{d.title}</h1>
        <p className="fine">{d.updated}: {UPDATED[lang] || UPDATED.es}</p>
        {d.sections.map(([h, p]) => <section key={h}><h2>{h}</h2><p>{p}</p></section>)}
        <p><a className="btn btn-primary" href="/">{d.back}</a></p>
      </div>
    </main>
  );
}
