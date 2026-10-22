import { cookies } from "next/headers";

export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];

const messages = {
  en: {
    skip: "Skip to main content",
    home: "Home",
    search: "Search",
    report: "Report",
    my: "My items",
    staff: "Staff",
    admin: "Admin",
    signIn: "Sign in",
    signOut: "Sign out",
    signedInAs: "Signed in as ",
    navLabel: "Main",
    language: "Language",
    footer: "Lost and found for York University's Keele campus.",
    eyebrow: "York University · Keele campus",
    heroTitle: "Find what was lost. Return what was found.",
    heroBody:
      "FindrYU is the lost-and-found for students, faculty, and staff at York's Keele campus. Finders hand items to a desk. Owners search, claim, and pick up with photo ID.",
    searchLost: "Search for a lost item",
    reportFound: "Report a found item",
    how: "How it works",
    step: "Step",
    step1Title: "Report a found item",
    step1Body: "Describe what you found, add a photo, and choose the Keele desk where you will drop it off.",
    step2Title: "Search where you lost it",
    step2Body: "Start with the building, then look through items already received at a drop-off point.",
    step3Title: "Claim it with a hidden detail",
    step3Body: "Photo ID shows who you are. A detail that is never listed publicly shows the item is yours.",
    forbidden: "That page is only available for your assigned role.",
    loginTitle: "Sign in",
    loginIntro: "Use your York email, ending in @yorku.ca or @my.yorku.ca. FindrYU will email you a sign-in link.",
  },
  fr: {
    skip: "Aller au contenu principal",
    home: "Accueil",
    search: "Recherche",
    report: "Signaler",
    my: "Mes objets",
    staff: "Personnel",
    admin: "Admin",
    signIn: "Connexion",
    signOut: "Déconnexion",
    signedInAs: "Connecté en tant que ",
    navLabel: "Principal",
    language: "Langue",
    footer: "Objets trouvés pour le campus Keele de l'Université York.",
    eyebrow: "Université York · campus Keele",
    heroTitle: "Retrouver ce qui a été perdu. Rendre ce qui a été trouvé.",
    heroBody:
      "FindrYU est le service d'objets trouvés pour les étudiants, le corps professoral et le personnel du campus Keele. Les personnes qui trouvent un objet le déposent à un comptoir. Les propriétaires cherchent, réclament et récupèrent l'objet avec une pièce d'identité avec photo.",
    searchLost: "Chercher un objet perdu",
    reportFound: "Signaler un objet trouvé",
    how: "Comment ça marche",
    step: "Étape",
    step1Title: "Signaler un objet trouvé",
    step1Body: "Décrivez l'objet, ajoutez une photo et choisissez le comptoir Keele où vous le déposerez.",
    step2Title: "Chercher là où vous l'avez perdu",
    step2Body: "Commencez par le bâtiment, puis parcourez les objets déjà reçus à un comptoir.",
    step3Title: "Le réclamer avec un détail caché",
    step3Body: "La pièce d'identité avec photo montre qui vous êtes. Un détail jamais affiché publiquement montre que l'objet est le vôtre.",
    forbidden: "Cette page est réservée à votre rôle.",
    loginTitle: "Connexion",
    loginIntro: "Utilisez votre courriel York, qui se termine par @yorku.ca ou @my.yorku.ca. FindrYU vous enverra un lien de connexion.",
  },
} as const;

export type MessageKey = keyof (typeof messages)["en"];

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("findryu-locale")?.value;
  return value === "fr" ? "fr" : "en";
}

export function t(locale: Locale, key: MessageKey) {
  return messages[locale][key];
}
