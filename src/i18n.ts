import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const LANGUAGE_STORAGE_KEY = 'magic-screen-language'
export const supportedLanguages = ['en', 'pt-BR'] as const
type SupportedLanguage = (typeof supportedLanguages)[number]

export const resources = {
  en: {
    translation: {
      document: { title: 'Magic Screen | Best cinema seats' },
      language: { label: 'Language', en: 'English', 'pt-BR': 'Português (Brasil)' },
      home: {
        subtitle: 'Snap the seat map. Get the best seats.',
        seatMap: 'Seat map',
        selectedSeatMap: 'Selected seat map',
        change: 'Change',
        picker: 'Take a photo, pick a screenshot, or drop the seat map image here',
        partySize: 'Party size',
        seat_one: 'seat',
        seat_other: 'seats together',
        fewerSeats: 'Fewer seats',
        moreSeats: 'More seats',
        findSeats: 'Find my seats',
        loadDemo: 'Try local demo map',
      },
      preferences: {
        title: 'Score priority',
        help: 'Choose any pillars. With none selected, the default weights target the best theoretical experience.',
        distance: 'Distance',
        sound: 'Sound',
        angle: 'Viewing angle (center alignment)',
      },
      analyzing: {
        reading: 'Reading the room…',
        mapping: 'Mapping every seat…',
        scoring: 'Scoring distance, centering and sound…',
        picking: 'Picking your spot…',
      },
      results: {
        title: 'Your seats',
        subtitle_one: 'Best row for {{count}} person, science included.',
        subtitle_other: 'Best row for {{count}} people, science included.',
        row: 'Row {{row}}',
        split: 'No row had {{count}} adjacent seats free, so this block spans a gap or aisle.',
        distance: 'Distance',
        distanceDetail: 'Peaks at about 62% of the way back. That row puts the screen at the ~36° viewing angle THX recommends, wide enough to feel immersive without forcing your eyes to scan. Sitting too close is penalized harder than too far, because steep upward gaze angles cause neck strain.',
        centering: 'Viewing angle',
        centeringDetail: "How close the middle of the block is to the screen's center line. A straight-on view keeps the image geometry undistorted and both speakers equally distant.",
        sound: 'Sound',
        soundDetail: "Cinema audio is mixed and calibrated for a reference listening position: center, about two thirds back. This rewards how close your seats sit to that spot. It's an estimate from your position, not a check of the actual room's speakers or format (Atmos, IMAX and the like aren't visible in a seat map).",
        aislePenalty: 'Blocks that span an aisle lose 10% of their total. Tap an option to compare each criterion with the top pick.',
        options: 'Options',
        topPick: 'Top pick',
        alternative: 'Alternative {{number}}',
        checkAnother: 'Check another session',
        scoreOutOf: '{{label}} {{score}} out of 100',
        versusTopPick: 'vs top pick',
        seatMapDescription: 'Seat map with recommended seats in row {{row}}',
        screen: 'SCREEN',
        correctMap: 'Correct map',
        doneEditing: 'Done',
        undoCorrection: 'Undo',
        correctionHint: 'Tap any seat position to mark it as an aisle/corridor.',
        markAsAisle: 'Mark row {{row}}, position {{col}} as corridor',
        restoreSeat: 'Restore row {{row}}, position {{col}} as seat',
        noSeatsAfterCorrection: 'No row has {{count}} free seats after corrections. Try undoing or changing party size.',
        share: {
          cardTitle: 'Share recommendation',
          share: 'Share',
          sharing: 'Sharing…',
          insecureContext: 'Sharing needs HTTPS or localhost. Open this page from a secure address and try again.',
          unavailable: 'Sharing is not available in this browser.',
          fileUnsupported: 'This image cannot be shared from this page.',
          capabilityCheckFailed: 'We could not verify sharing in this browser. Please try again.',
          failed: 'Could not share the recommendation. Please try again.',
          imageScore: 'Recommended: Row {{row}} ({{seats}}) · {{score}}/100',
          priority: 'Priority: {{priority}}',
          partySize: '👥 Party size: {{count}}',
          topPick: '⭐ Top Pick: Row {{row}} ({{seats}}) · {{score}}/100',
          selectedChoice: '🎯 Selected: Row {{row}} ({{seats}}) · {{score}}/100',
          altRow: '• Alt {{number}}: Row {{row}} ({{seats}}) · {{score}}/100',
          alternativesHeader: '💡 Alternatives:',
          appLink: 'Find the best cinema seats with Magic Screen:',
        },
      },
      errors: {
        noSeats: 'No row has {{count}} free seats. Try fewer seats or another session.',
        generic: 'Something went wrong.',
        imageRead: 'Could not read that image.',
        noSeatMap: "Couldn't find a seat map in that image.",
        requestFailed: 'Request failed ({{status}})',
        visionRead: 'The vision model could not read this image.',
        missingImage: 'The image could not be sent for analysis.',
        missingApiKey: 'The seat-map service is not configured.',
      },
    },
  },
  'pt-BR': {
    translation: {
      document: { title: 'Magic Screen | Melhores lugares no cinema' },
      language: { label: 'Idioma', en: 'English', 'pt-BR': 'Português (Brasil)' },
      home: {
        subtitle: 'Fotografe o mapa de assentos. Encontre os melhores lugares.',
        seatMap: 'Mapa de assentos',
        selectedSeatMap: 'Mapa de assentos selecionado',
        change: 'Trocar',
        picker: 'Tire uma foto, escolha uma captura de tela ou solte a imagem do mapa de assentos aqui',
        partySize: 'Quantidade de pessoas',
        seat_one: 'assento',
        seat_other: 'assentos juntos',
        fewerSeats: 'Menos assentos',
        moreSeats: 'Mais assentos',
        findSeats: 'Encontrar meus lugares',
        loadDemo: 'Testar mapa local de demonstração',
      },
      preferences: {
        title: 'Prioridade do score',
        help: 'Selecione os pilares que quiser. Sem nenhum selecionado, os pesos padrão buscam a melhor experiência teórica.',
        distance: 'Distância',
        sound: 'Som',
        angle: 'Ângulo de visão (centralização)',
      },
      analyzing: {
        reading: 'Lendo a sala…',
        mapping: 'Mapeando cada assento…',
        scoring: 'Avaliando distância, centralização e som…',
        picking: 'Escolhendo seu lugar…',
      },
      results: {
        title: 'Seus lugares',
        subtitle_one: 'Melhor fila para {{count}} pessoa, com ciência incluída.',
        subtitle_other: 'Melhor fila para {{count}} pessoas, com ciência incluída.',
        row: 'Fila {{row}}',
        split: 'Nenhuma fila tinha {{count}} assentos adjacentes livres, então este grupo atravessa um espaço ou corredor.',
        distance: 'Distância',
        distanceDetail: 'A pontuação atinge o máximo a cerca de 62% da distância até o fundo. Essa fila posiciona a tela no ângulo de visão de ~36° recomendado pela THX: amplo o bastante para imersão, sem forçar seus olhos a percorrê-la. Ficar perto demais é mais penalizado do que ficar longe demais, porque ângulos elevados de visão causam tensão no pescoço.',
        centering: 'Ângulo de visão',
        centeringDetail: 'Mede a proximidade entre o meio do grupo e a linha central da tela. Uma visão frontal mantém a geometria da imagem sem distorções e os dois alto-falantes à mesma distância.',
        sound: 'Som',
        soundDetail: 'O áudio do cinema é mixado e calibrado para uma posição de referência: no centro, a cerca de dois terços da distância até o fundo. Isso recompensa lugares próximos desse ponto. É uma estimativa baseada na posição, não uma verificação dos alto-falantes ou do formato real da sala (Atmos, IMAX e similares não aparecem no mapa de assentos).',
        aislePenalty: 'Grupos que atravessam um corredor perdem 10% da pontuação total. Toque em uma opção para comparar cada critério com a melhor escolha.',
        options: 'Opções',
        topPick: 'Melhor escolha',
        alternative: 'Alternativa {{number}}',
        checkAnother: 'Ver outra sessão',
        scoreOutOf: '{{label}} {{score}} de 100',
        versusTopPick: 'vs. melhor escolha',
        seatMapDescription: 'Mapa de assentos com lugares recomendados na fila {{row}}',
        screen: 'TELA',
        correctMap: 'Corrigir mapa',
        doneEditing: 'Concluído',
        undoCorrection: 'Desfazer',
        correctionHint: 'Toque em qualquer assento para marcá-lo como corredor.',
        markAsAisle: 'Marcar fila {{row}}, posição {{col}} como corredor',
        restoreSeat: 'Restaurar fila {{row}}, posição {{col}} como assento',
        noSeatsAfterCorrection: 'Nenhuma fila tem {{count}} assentos livres após as correções. Tente desfazer ou alterar o número de pessoas.',
        share: {
          cardTitle: 'Compartilhar recomendação',
          share: 'Compartilhar',
          sharing: 'Compartilhando…',
          insecureContext: 'O compartilhamento exige HTTPS ou localhost. Abra esta página em um endereço seguro e tente novamente.',
          unavailable: 'O compartilhamento não está disponível neste navegador.',
          fileUnsupported: 'Não é possível compartilhar esta imagem a partir desta página.',
          capabilityCheckFailed: 'Não foi possível verificar o compartilhamento neste navegador. Tente novamente.',
          failed: 'Não foi possível compartilhar a recomendação. Tente novamente.',
          imageScore: 'Recomendação: Fila {{row}} ({{seats}}) · {{score}}/100',
          priority: 'Prioridade: {{priority}}',
          partySize: '👥 Quantidade de pessoas: {{count}}',
          topPick: '⭐ Melhor Escolha: Fila {{row}} ({{seats}}) · {{score}}/100',
          selectedChoice: '🎯 Selecionado: Fila {{row}} ({{seats}}) · {{score}}/100',
          altRow: '• Alt {{number}}: Fila {{row}} ({{seats}}) · {{score}}/100',
          alternativesHeader: '💡 Alternativas:',
          appLink: 'Encontre os melhores lugares no cinema com o Magic Screen:',
        },
      },
      errors: {
        noSeats: 'Nenhuma fila tem {{count}} assentos livres. Tente menos assentos ou outra sessão.',
        generic: 'Algo deu errado.',
        imageRead: 'Não foi possível ler essa imagem.',
        noSeatMap: 'Não foi possível encontrar um mapa de assentos nessa imagem.',
        requestFailed: 'A solicitação falhou ({{status}})',
        visionRead: 'O modelo de visão não conseguiu ler esta imagem.',
        missingImage: 'Não foi possível enviar a imagem para análise.',
        missingApiKey: 'O serviço de mapa de assentos não está configurado.',
      },
    },
  },
} as const

const knownErrorKeys: Record<string, string> = {
  NO_SEATS: 'errors.noSeats',
  'Could not read that image.': 'errors.imageRead',
  "Couldn't find a seat map in that image.": 'errors.noSeatMap',
  'The vision model could not read this image.': 'errors.visionRead',
  'Missing "image" (base64)': 'errors.missingImage',
  'GEMINI_API_KEY secret is not configured': 'errors.missingApiKey',
}

export function errorTranslationKey(message: string): string {
  if (knownErrorKeys[message]) return knownErrorKeys[message]
  return /^Request failed \(\d+\)$/.test(message) ? 'errors.requestFailed' : 'errors.generic'
}

function initialLanguage(): SupportedLanguage {
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return supportedLanguages.includes(stored as SupportedLanguage) ? (stored as SupportedLanguage) : 'en'
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: false,
  interpolation: { escapeValue: false },
})

function syncDocumentLanguage(language: string) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.title = i18n.t('document.title', { lng: language })
}

i18n.on('languageChanged', (language) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  syncDocumentLanguage(language)
})

syncDocumentLanguage(i18n.language)

export default i18n
