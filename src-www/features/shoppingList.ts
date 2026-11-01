import { computed } from "vue";
import { inhalt, LISTEN } from "./bring";

export type { ShoppingItem } from "./bring";

/**
 * Die Liste „Einkaufen" für die Kachel. Seit 04.10.2026 liest bring.ts alle drei Listen in einem Abruf (getBulk)
 * samt „zuletzt verwendet" -- das braucht das Fenster zum Hinzufügen.
 */
export const shoppinglist = computed(() => (LISTEN[0] ? inhalt.value[LISTEN[0].id] : undefined) ?? []);
