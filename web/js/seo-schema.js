/**
 * Desvalls Cultura - SEO Structured Data (JSON-LD)
 * Aquest script injecta les dades estructurades per ajudar a Google a entendre millor l'entitat i els esdeveniments.
 */

const seoSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://desvallscultura.cat/#organization",
      "name": "Associació Desvalls Cultura",
      "url": "https://desvallscultura.cat/",
      "logo": "https://desvallscultura.cat/img/logo.jpg",
      "sameAs": [
        "https://www.instagram.com/desvallscultura",
        "https://www.instagram.com/plujadelletres",
        "https://www.instagram.com/firaplujadart"
      ],
      "location": {
        "@type": "Place",
        "name": "Sant Jordi Desvalls",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Sant Jordi Desvalls",
          "addressRegion": "Girona",
          "addressCountry": "ES"
        }
      }
    },
    {
      "@type": "Event",
      "name": "Pluja de Lletres 2026",
      "startDate": "2026-04-10T10:00:00",
      "endDate": "2026-04-11T21:00:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": {
        "@type": "Place",
        "name": "Plaça de l'U d'Octubre",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Sant Jordi Desvalls",
          "postalCode": "17144"
        }
      },
      "description": "El cap de setmana on els carrers de Sant Jordi Desvalls esclaten de literatura i cultura.",
      "organizer": { "@id": "https://desvallscultura.cat/#organization" }
    },
    {
      "@type": "Event",
      "name": "Pluja d'Art 2026",
      "startDate": "2026-09-01T10:00:00",
      "endDate": "2026-09-30T21:00:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "location": {
        "@type": "Place",
        "name": "Sant Jordi Desvalls",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Sant Jordi Desvalls",
          "postalCode": "17144"
        }
      },
      "description": "El gran altaveu per a creadors multidisciplinaris a Sant Jordi Desvalls.",
      "organizer": { "@id": "https://desvallscultura.cat/#organization" }
    }
  ]
};

const script = document.createElement('script');
script.type = 'application/ld+json';
script.text = JSON.stringify(seoSchema);
document.head.appendChild(script);
