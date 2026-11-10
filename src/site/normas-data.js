// Normas de la casa: una sola fuente para la página web (/normas, /en/house-rules) y para el PDF
// (npm run pdfs → public/normas-casa-maracuya.pdf). Al cambiar algo aquí, vuelve a generar el PDF.
// Texto plano a propósito, sin JSX: el script del PDF lo lee con Node.

export const NORMAS = {
  es: {
    doc: "Normas de la casa · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · Normas de la casa",
    title: "¡Bienvenidos a",
    titleEm: "Casa Maracuyá!",
    sub: "Tu refugio de historia, confort y mar en Adícora",
    welcome: [
      "Nos llena de alegría abrirles las puertas de nuestro hogar. Casa Maracuyá no es solo un lugar para descansar; es una joya viva con historia, donde el encanto del pasado se combina con la belleza y la brisa de nuestro mar. Cada rincón ha sido pensado para brindarles una experiencia inolvidable de serenidad, gastronomía y desconexión.",
      "Les invitamos a disfrutar de cada espacio con el mismo amor y cuidado con el que lo hemos preparado para ustedes. Para garantizar su seguridad, el bienestar del grupo y la preservación de nuestro patrimonio, les pedimos consultar las siguientes normas y políticas operativas."
    ],
    rulesT: "Normas, políticas y cuidado de la casa",
    keyT: "Lo esencial",
    key: [["Check-in", "desde las 3:00 PM"], ["Check-out", "hasta las 11:00 AM"], ["Capacidad", "12 personas máximo"], ["Equipo", "7:30 AM a 9:30 PM"]],
    index: "En esta página",
    pdf: "Descargar PDF",
    askT: "¿Alguna duda antes de llegar?",
    ask: "Escríbenos y te ayudamos con gusto.",
    write: "Escribir un correo",
    parts: [
      { id: "reservaciones", n: "I", h: "Reservaciones, horarios y capacidad", note: "Bases de la estadía", rules: [
        ["Horarios de entrada y salida", [
          "<b>Check-in:</b> a partir de las 3:00 PM.",
          "<b>Check-out:</b> hasta las 11:00 AM. Agradecemos la puntualidad en el check-out para permitir que nuestro equipo prepare la casa con los estándares de excelencia para los siguientes huéspedes."]],
        ["Políticas de reservación y cancelación", [
          "La reserva se confirma con la cancelación del 100% del monto total. De no realizarse el pago, la fecha quedará automáticamente disponible.",
          "Las tarifas no son reembolsables.",
          "Se permiten cambios de fecha informando con un mínimo de 15 días de anticipación a la llegada. La nueva fecha quedará sujeta a la disponibilidad futura de la casa."]],
        ["Capacidad máxima y ocupación", [
          "La capacidad máxima de la casa es de 12 personas.",
          "Por razones de espacio y confort, no se permiten camas adicionales de ningún tipo.",
          "Está estrictamente prohibido que pernocten en la propiedad personas que no hayan sido registradas en el grupo inicial."]],
        ["Reserva del derecho de admisión", [
          "Casa Maracuyá se reserva el derecho de admisión y permanencia en la propiedad en caso de incumplimiento de las normas de convivencia o seguridad."]]
      ] },
      { id: "patrimonio", n: "II", h: "Valor histórico, seguridad y cuidado del patrimonio", rules: [
        ["Aprecio por el valor histórico y cuidado de la casa", [
          "Casa Maracuyá alberga una valiosa historia de antigüedad; en ella encontrarán piezas y objetos decorativos que datan de más de 200 años. Les invitamos a valorar y tratar con delicadeza cada objeto, mueble e instalación, entendiendo que forman parte de la identidad de la casa."]],
        ["Seguridad en la caminería costera y áreas exteriores", [
          "Como parte de nuestro atractivo histórico, contamos con una caminería de madera estilo muelle ubicada justo frente al mar. Debido a que se encuentra a cierta altura sobre un rompeolas de piedras y protegida por una cerca baja con cuerdas, es de carácter obligatorio la <b>supervisión permanente y directa de niños y mascotas</b> en esta área. La casa no se hace responsable por accidentes derivados del descuido en dicha zona."]],
        ["Seguridad en el área de la piscina", [
          "Los niños deben estar acompañados en todo momento por un adulto responsable en el área de la piscina.",
          "Por razones estrictas de seguridad física, está totalmente prohibido el uso de vasos, botellas o recipientes de vidrio en el área de la piscina y sus alrededores."]],
        ["Política pet friendly", [
          "Amamos a las mascotas y son muy bienvenidas. Deben permanecer bajo la supervisión y cuidado continuo de sus dueños.",
          "Aunque somos un espacio pet friendly, <b>no está permitido que las mascotas duerman en las camas</b> ni se suban a ellas.",
          "Cualquier daño a la propiedad, vegetación o mobiliario causado por la mascota será responsabilidad de su dueño y cargado a la cuenta del grupo."]],
        ["Cuidado de lencería, equipamiento y cargos por daños", [
          "La lencería de cama, las toallas (de baño y piscina), los dispositivos electrónicos y el mobiliario en general deben ser devueltos en perfecto estado.",
          "Cualquier daño, mancha irreparable o extravío de objetos decorativos, equipos o lencería será cargado a la cuenta del huésped por un valor acorde al precio de reemplazo o reparación en el mercado."]],
        ["Uso de vasos térmicos (Yeti)", [
          "Los vasos térmicos estilo Yeti dispuestos para su confort son propiedad de la casa y deben ser devueltos al finalizar la estancia. En caso de pérdida o no devolución, se aplicará un cargo de <b>$100 USD por cada vaso</b>."]]
      ] },
      { id: "convivencia", n: "III", h: "Convivencia, experiencia y servicios boutique", rules: [
        ["Horarios de atención del personal", [
          "Nuestro equipo de servicio estará complacido de atenderles y asistirles en un horario de 7:30 AM a 9:30 PM."]],
        ["Planificación gastronómica", [
          "Para coordinar la compra de insumos frescos y ofrecerles el mejor servicio de cocina, todas las comidas deben planificarse con el equipo el día anterior."]],
        ["Política libre de humo", [
          "Por la conservación de la casa y el confort de todos, está prohibido fumar dentro de las habitaciones y áreas cerradas. Se permite fumar únicamente en las áreas abiertas al aire libre, haciendo uso de los ceniceros."]],
        ["Niveles de ruido y horarios de descanso", [
          "Agradecemos moderar el volumen de la música a partir de las 11:00 PM para garantizar un ambiente de paz y respetar la tranquilidad del entorno."]],
        ["Uso responsable de agua y energía", [
          "Adícora es un paraíso natural con recursos valiosos. Les pedimos hacer un uso consciente del agua dulce y mantener cerradas las puertas y ventanas mientras el aire acondicionado esté encendido."]],
        ["Pertenencias de valor", [
          "Casa Maracuyá no se hace responsable por la pérdida o extravío de dinero u objetos de valor dejados sin custodia en las áreas comunes."]],
        ["Propinas al personal", [
          "Las propinas no están incluidas en las tarifas de la casa. Si desean premiar la atención de nuestro equipo, queda totalmente a la discreción y voluntariedad de su grupo."]]
      ] }
    ]
  },
  en: {
    doc: "House rules · Casa Maracuyá",
    eyebrow: "Casa Maracuyá · House rules",
    title: "Welcome to",
    titleEm: "Casa Maracuyá!",
    sub: "Your haven of history, comfort and sea in Adícora",
    welcome: [
      "It fills us with joy to open the doors of our home to you. Casa Maracuyá is not just a place to rest; it is a living gem with a history, where the charm of the past meets the beauty and the breeze of our sea. Every corner has been designed to give you an unforgettable experience of calm, good food and disconnection.",
      "We invite you to enjoy every space with the same love and care with which we have prepared it for you. To ensure your safety, the wellbeing of the group and the preservation of our heritage, please read the following rules and policies."
    ],
    rulesT: "Rules, policies and caring for the house",
    keyT: "The essentials",
    key: [["Check-in", "from 3:00 PM"], ["Check-out", "by 11:00 AM"], ["Capacity", "12 guests maximum"], ["Staff", "7:30 AM to 9:30 PM"]],
    index: "On this page",
    pdf: "Download PDF",
    askT: "Any questions before you arrive?",
    ask: "Write to us and we'll be happy to help.",
    write: "Send an email",
    parts: [
      { id: "reservaciones", n: "I", h: "Bookings, times and capacity", note: "The basics of your stay", rules: [
        ["Check-in and check-out times", [
          "<b>Check-in:</b> from 3:00 PM.",
          "<b>Check-out:</b> by 11:00 AM. We appreciate a punctual check-out so our team can prepare the house to our standards of excellence for the next guests."]],
        ["Booking and cancellation policy", [
          "A booking is confirmed upon payment of 100% of the total amount. If payment is not made, the date automatically becomes available again.",
          "Rates are non-refundable.",
          "Date changes are allowed with at least 15 days' notice before arrival. The new date is subject to the house's availability."]],
        ["Maximum capacity and occupancy", [
          "The house's maximum capacity is 12 guests.",
          "For reasons of space and comfort, no extra beds of any kind are allowed.",
          "Anyone not registered in the original group is strictly not allowed to stay overnight on the property."]],
        ["Right of admission", [
          "Casa Maracuyá reserves the right of admission and to remain on the property if the rules of conduct or safety are not followed."]]
      ] },
      { id: "patrimonio", n: "II", h: "History, safety and caring for our heritage", rules: [
        ["Respecting the history of the house", [
          "Casa Maracuyá holds a rich history: you will find pieces and decorative objects that are more than 200 years old. Please treat every object, piece of furniture and fixture with care, as they are part of the identity of the house."]],
        ["Safety on the seafront boardwalk and outdoor areas", [
          "As part of its historic charm, the house has a wooden pier-style boardwalk right on the sea. Because it sits at a height above a stone breakwater and is protected by a low rope fence, <b>constant, direct supervision of children and pets</b> is mandatory in this area. The house is not responsible for accidents caused by lack of supervision there."]],
        ["Pool safety", [
          "Children must be accompanied by a responsible adult at all times in the pool area.",
          "For strict safety reasons, glasses, bottles or containers made of glass are completely forbidden in and around the pool area."]],
        ["Pet-friendly policy", [
          "We love pets and they are very welcome. They must remain under their owners' continuous supervision and care.",
          "Although we are pet friendly, <b>pets are not allowed to sleep on the beds</b> or get on them.",
          "Any damage to the property, plants or furniture caused by a pet is the owner's responsibility and will be charged to the group's account."]],
        ["Linen, equipment and damage charges", [
          "Bed linen, towels (bath and pool), electronic devices and furniture in general must be returned in perfect condition.",
          "Any damage, permanent stain or loss of decorative objects, equipment or linen will be charged to the guest at the market cost of replacement or repair."]],
        ["Insulated tumblers (Yeti)", [
          "The Yeti-style insulated tumblers provided for your comfort belong to the house and must be returned at the end of your stay. If lost or not returned, a charge of <b>$100 USD per tumbler</b> will apply."]]
      ] },
      { id: "convivencia", n: "III", h: "Living together, experience and boutique service", rules: [
        ["Staff hours", [
          "Our service team will be happy to look after you from 7:30 AM to 9:30 PM."]],
        ["Meal planning", [
          "So we can buy fresh ingredients and offer you the best kitchen service, all meals must be planned with the team the day before."]],
        ["Smoke-free policy", [
          "To preserve the house and for everyone's comfort, smoking is not allowed in the bedrooms or any enclosed area. Smoking is only allowed in open-air areas, using the ashtrays."]],
        ["Noise and quiet hours", [
          "Please keep the music down after 11:00 PM to keep the peace and respect the calm of the surroundings."]],
        ["Responsible use of water and energy", [
          "Adícora is a natural paradise with precious resources. Please use fresh water mindfully and keep doors and windows closed while the air conditioning is on."]],
        ["Valuables", [
          "Casa Maracuyá is not responsible for the loss of money or valuables left unattended in common areas."]],
        ["Tips for the staff", [
          "Tips are not included in the house rates. If you wish to reward our team's service, it is entirely at your group's discretion."]]
      ] }
    ]
  }
};

// Dónde queda el PDF de cada idioma (lo escribe scripts/pdfs.mjs en public/).
export const PDF_URL = { es: "/normas-casa-maracuya.pdf", en: "/house-rules-casa-maracuya.pdf" };
