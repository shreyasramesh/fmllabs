export interface ModalTranslations {
  back: string;
  next: string;
  generateRelevantMessage: string;
  translateTo: string;
  translating: string;
  deleteCustomConcept: string;
  deleteButton: string;
  deleteCustomConceptConfirm: string;
  deleteFromLtm: string;
  autoTagGroups: string;
  createAndAddGroup: string;
  close: string;
  generating: string;
}

const EN: ModalTranslations = {
  back: "Back",
  next: "Next",
  generateRelevantMessage: "Generate Relevant Message",
  translateTo: "Translate to",
  translating: "Translating…",
  deleteCustomConcept: "Delete custom concept",
  deleteButton: "Delete",
  deleteCustomConceptConfirm: "Delete custom concept?",
  deleteFromLtm: "Delete from long-term memory",
  autoTagGroups: "Auto tag groups",
  createAndAddGroup: "Create & add",
  close: "Close",
  generating: "Generating...",
};

export function getModalTranslations(language: string): ModalTranslations {
  return EN;
}
