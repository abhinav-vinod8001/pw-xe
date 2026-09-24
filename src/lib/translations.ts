/**
 * Multi-Language Legal Explanations & Plain Language Glossary
 * 
 * Provides instant client-side translations of legal risk concepts into:
 * - 5th-Grade Plain English (Jargon-free)
 * - Spanish (Español)
 * - Hindi (हिन्दी)
 * - French (Français)
 * - German (Deutsch)
 */

export type SupportedLanguage = 'en' | 'simple' | 'es' | 'hi' | 'fr' | 'de';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English (Legal)', flag: '🇺🇸' },
  { code: 'simple', name: '5th-Grade Plain English', flag: '💡' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

export const LEGAL_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  unlimited_liability: {
    en: 'Unlimited Liability: You bear 100% financial responsibility without any cap on damages.',
    simple: 'You have to pay for any problem forever, even if it costs millions of dollars.',
    es: 'Responsabilidad ilimitada: Eres 100% responsable financieramente sin límite de daños.',
    hi: 'असीमित दायित्व: किसी भी नुकसान के लिए आपको बिना किसी सीमा के पूरा भुगतान करना होगा।',
    fr: 'Responsabilité illimitée: Vous assumez 100% des dommages sans plafond financier.',
    de: 'Unbegrenzte Haftung: Sie haften finanziell zu 100% ohne Obergrenze für Schäden.',
  },
  ip_assignment: {
    en: 'Broad IP Assignment: The client claims ownership over your personal and prior inventions.',
    simple: 'Everything you make or think of belongs to the client, even your personal hobby work.',
    es: 'Cesión amplia de PI: El cliente se apropia de tus inventos personales y previos.',
    hi: 'बौद्धिक संपदा का हस्तांतरण: ग्राहक आपके निजी और पुराने आविष्कारों का भी मालिक बन जाता है।',
    fr: 'Cession de PI élargie: Le client s’approprie vos inventions personnelles et antérieures.',
    de: 'Umfassende IP-Abtretung: Der Kunde beansprucht das Eigentum an all Ihren Erfindungen.',
  },
  non_compete: {
    en: 'Draconian Non-Compete: Restricts you from working in your industry after contract ends.',
    simple: 'You are banned from doing your job for any other company after you leave.',
    es: 'No competencia draconiana: Te prohíbe trabajar en tu sector tras finalizar el contrato.',
    hi: 'गैर-प्रतिस्पर्धा खंड: काम खत्म होने के बाद भी आपको इस क्षेत्र में काम करने से रोकता है।',
    fr: 'Clause de non-concurrence: Vous empêche de travailler dans votre secteur après le contrat.',
    de: 'Wettbewerbsverbot: Verbietet Ihnen nach Vertragsende die Arbeit in Ihrer Branche.',
  },
  unilateral_termination: {
    en: 'Unilateral Termination: The client can fire you or cancel immediately without paying.',
    simple: 'The client can quit anytime without paying you, but you are locked in.',
    es: 'Terminación unilateral: El cliente puede despedirte de inmediato sin previo aviso ni pago.',
    hi: 'एकतरफा समाप्ति: ग्राहक बिना किसी नोटिस के तुरंत अनुबंध रद्द कर सकता है।',
    fr: 'Résiliation unilatérale: Le client peut résilier sans préavis ni compensation.',
    de: 'Einseitige Kündigung: Der Kunde kann jederzeit fristlos und ohne Zahlung kündigen.',
  },
  foreign_arbitration: {
    en: 'Foreign Arbitration: Disputes are forced into distant courts where you pay all legal costs.',
    simple: 'If there is a fight, you must travel to another country and pay all their lawyer bills.',
    es: 'Arbitraje extranjero: Te obligan a litigar en tribunales lejanos pagando todos los gastos.',
    hi: 'विदेशी मध्यस्थता: विवाद की स्थिति में आपको दूर के विदेशी न्यायालय में सारा खर्च देना होगा।',
    fr: 'Arbitrage à l’étranger: Litiges jugés à l’étranger avec tous les frais à votre charge.',
    de: 'Ausländisches Schiedsverfahren: Streitigkeiten werden im Ausland verhandelt; Sie zahlen alle Kosten.',
  },
};
