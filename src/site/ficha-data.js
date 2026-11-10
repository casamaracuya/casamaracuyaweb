// Ficha de registro de huéspedes: textos de la ficha en papel (npm run pdfs → public/ficha-registro-casa-maracuya.pdf)
// y opciones que el panel usa al pasarla (src/admin/sheets.jsx, FichaSheet).
// Las opciones se guardan siempre en español (v), que es el idioma del panel; en inglés solo cambia lo que se ve en el PDF.

export const OPCIONES = {
  alergias: [{ v: "Mariscos", en: "Shellfish" }, { v: "Lactosa", en: "Lactose" }, { v: "Gluten", en: "Gluten" }, { v: "Frutos secos", en: "Nuts" }],
  bebidas: [{ v: "Café negro", en: "Black coffee" }, { v: "Café con leche", en: "Coffee with milk" }, { v: "Té", en: "Tea" }, { v: "Jugos naturales", en: "Fresh juices" }],
  requerimientos: [{ v: "Platos bajos en calorías", en: "Low-calorie dishes" }, { v: "Menú infantil", en: "Kids' menu" }],
  motivo: [{ v: "Cumpleaños", en: "Birthday" }, { v: "Aniversario", en: "Anniversary" }, { v: "Descanso", en: "Rest" }, { v: "Kitesurf", en: "Kitesurfing" }]
};

export const FICHA_PDF = { es: "/ficha-registro-casa-maracuya.pdf", en: "/guest-registration-casa-maracuya.pdf" };

export const FICHA = {
  es: {
    doc: "Ficha de registro · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · Adícora, Falcón",
    title: "Ficha de registro",
    titleEm: "de huéspedes",
    s1: "Datos del titular de la reserva",
    nombre: "Nombre y apellido", documento: "C.I. / Pasaporte", telefono: "Teléfono / WhatsApp", email: "Correo electrónico", ciudad: "Ciudad de origen",
    s2: "Detalles de la estancia y transporte",
    checkin: "Check-in", checkout: "Check-out", checkinH: "3:00 PM", checkoutH: "11:00 AM",
    hora: "Hora estimada de llegada", adultos: "Adultos", ninos: "Niños", total: "Total de huéspedes", max: "Máximo 12 personas",
    vehiculos: "Vehículos (placa / modelo)", vehiculoPh: "Ej.: AB123CD · Toyota Fortuner",
    s3: "Registro de acompañantes",
    s3note: "Solo pueden pernoctar las personas registradas aquí. Máximo 12 en total, incluido el titular.",
    n: "#", acNombre: "Nombre y apellido", acDoc: "C.I. / Documento", acEdad: "Edad (si es menor)", titular: "Titular",
    s4: "Perfil gastronómico y alergias", s4note: "Para cocina y servicio.",
    alergias: "Alergias o intolerancias", ninguna: "Ninguna", detalle: "Detalle / otras especificaciones",
    bebidas: "Preferencias de bebidas", otrasBebidas: "Otras bebidas de preferencia",
    req: "Requerimientos especiales", otrosReq: "Otros requerimientos",
    s5: "Mascotas y ocasiones especiales",
    mascota: "Mascotas (pet friendly)", noMascota: "No trae mascota", siMascota: "Sí trae mascota", mascotaNombre: "Nombre", mascotaRaza: "Raza",
    motivo: "Motivo de la visita / celebración", otro: "Otro",
    s6: "Declaración de conocimiento y aceptación de normas",
    declara: "Al firmar este documento, el titular declara haber leído y aceptado las normas de Casa Maracuyá:",
    normas: [
      ["Capacidad", "límite máximo de 12 personas. No pernoctan visitantes ajenos al registro."],
      ["Horarios", "check-in 3:00 PM · check-out 11:00 AM · horario de servicio del personal: 7:30 AM a 9:30 PM."],
      ["Cuidado patrimonial", "acepta la responsabilidad por el cuidado de las instalaciones y antigüedades (más de 200 años). Cualquier daño o faltante será cargado a la cuenta."],
      ["Seguridad", "es obligatoria la supervisión directa de niños y mascotas en la caminería estilo muelle frente al mar y en la piscina. Prohibidos los recipientes de vidrio en el área de piscina. Los vasos Yeti extraviados tienen un cargo de $100 USD c/u."],
      ["Mascotas", "son bienvenidas, pero no está permitido que duerman en las camas."],
      ["Gastronomía", "las comidas se coordinan con el equipo con 24 horas de anticipación."]
    ],
    firmaPdf: "Firma del huésped titular", recibido: "Recibido por (Casa Maracuyá)", fecha: "Fecha"
  },
  en: {
    doc: "Guest registration · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · Adícora, Falcón",
    title: "Guest",
    titleEm: "registration form",
    s1: "Main guest details",
    nombre: "Full name", documento: "ID / Passport", telefono: "Phone / WhatsApp", email: "Email", ciudad: "Home city",
    s2: "Stay and transport details",
    checkin: "Check-in", checkout: "Check-out", checkinH: "3:00 PM", checkoutH: "11:00 AM",
    hora: "Estimated arrival time", adultos: "Adults", ninos: "Children", total: "Total guests", max: "12 guests maximum",
    vehiculos: "Vehicles (plate / model)", vehiculoPh: "E.g.: AB123CD · Toyota Fortuner",
    s3: "Guest register",
    s3note: "Only the people registered here may stay overnight. 12 maximum, including the main guest.",
    n: "#", acNombre: "Full name", acDoc: "ID / Document", acEdad: "Age (if under 18)", titular: "Main guest",
    s4: "Food profile and allergies", s4note: "For the kitchen and service team.",
    alergias: "Allergies or intolerances", ninguna: "None", detalle: "Details / other",
    bebidas: "Drink preferences", otrasBebidas: "Other favourite drinks",
    req: "Special requirements", otrosReq: "Other requirements",
    s5: "Pets and special occasions",
    mascota: "Pets (pet friendly)", noMascota: "No pet", siMascota: "Bringing a pet", mascotaNombre: "Name", mascotaRaza: "Breed",
    motivo: "Reason for the visit / celebration", otro: "Other",
    s6: "Acknowledgement and acceptance of the house rules",
    declara: "By signing this form, the main guest confirms having read and accepted the rules of Casa Maracuyá:",
    normas: [
      ["Capacity", "12 guests maximum. No one outside the register may stay overnight."],
      ["Times", "check-in 3:00 PM · check-out 11:00 AM · staff hours: 7:30 AM to 9:30 PM."],
      ["Caring for the heritage", "accepts responsibility for the care of the house and its antiques (over 200 years old). Any damage or missing item will be charged to the account."],
      ["Safety", "direct supervision of children and pets is mandatory on the seafront boardwalk and at the pool. No glass containers in the pool area. Lost Yeti tumblers are charged at $100 USD each."],
      ["Pets", "they are welcome, but they are not allowed to sleep on the beds."],
      ["Meals", "meals are arranged with the team 24 hours in advance."]
    ],
    firmaPdf: "Main guest signature", recibido: "Received by (Casa Maracuyá)", fecha: "Date"
  }
};
