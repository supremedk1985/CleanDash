<script setup lang="ts">
/**
 * Bring! lists: what is on them, tap an item to take it off, "Add" to put something on (with the recently
 * bought items as one-tap suggestions). The bring adapter does the rest and reports the new list a moment later.
 */
import { computed, nextTick, ref } from "vue";
import { mdiCartOutline, mdiClose, mdiPlus } from "@mdi/js";
import Icon from "./Icon.vue";
import { addItem, ask, config, removeItem, values } from "../lib/store";
import { items, itemText, parseItem, type Item } from "../lib/tiles";
import type { ShoppingList } from "../lib/config";
import { t } from "../lib/i18n";

const lists = computed(() => config.value?.shoppingLists ?? []);
const content = (l: ShoppingList) => items(values[l.content]);
const listName = (l: ShoppingList) => l.name || t("theList");

function take(l: ShoppingList, i: Item) {
  ask({ text: t("askRemove", { item: itemText(i), list: listName(l) }), run: () => removeItem(l, i) });
}

const adding = ref<ShoppingList | null>(null);
const input = ref("");
const field = ref<HTMLInputElement | null>(null);
async function openAdd(l: ShoppingList) {
  adding.value = l;
  input.value = "";
  await nextTick();
  field.value?.focus();
}
const suggestions = computed(() => {
  const l = adding.value;
  if (!l) return [];
  const on = new Set((content(l) ?? []).map((i) => i.name.toLowerCase()));
  const q = input.value.trim().toLowerCase();
  return (items(values[l.recent]) ?? []).filter((i) => !on.has(i.name.toLowerCase()) && (!q || i.name.toLowerCase().includes(q))).slice(0, 12);
});
function put(i: Item | null) {
  const l = adding.value;
  if (!l || !i) return;
  adding.value = null;
  ask({ text: t("askAdd", { item: itemText(i), list: listName(l) }), run: () => addItem(l, i) });
}
</script>

<template>
  <div class="stack">
  <section v-for="l in lists" :key="l.key" class="card" :data-test="`shopping-${l.key}`">
    <header class="card-head">
      <h2 class="card-title">{{ l.name || t("shopping") }}</h2>
      <button type="button" class="btn small ghost" :data-test="`add-${l.key}`" @click="openAdd(l)"><Icon :path="mdiPlus" :size="16" />{{ t("addItem") }}</button>
    </header>
    <div v-if="content(l)?.length" class="items">
      <button v-for="i in content(l)" :key="i.name" type="button" class="item" @click="take(l, i)">
        <span>{{ i.name }}</span><span v-if="i.specification" class="muted small">{{ i.specification }}</span>
      </button>
    </div>
    <p v-else class="muted small with-icon"><Icon :path="mdiCartOutline" :size="18" />{{ content(l) === null ? "…" : t("listEmpty") }}</p>
  </section>

  <div v-if="adding" class="overlay" @click.self="adding = null" @keydown.esc="adding = null">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="add-title" data-test="add-dialog">
      <header class="dialog-head">
        <h2 id="add-title" class="dialog-title">{{ adding.name || t("shopping") }}</h2>
        <button type="button" class="icon-btn" :aria-label="t('close')" @click="adding = null"><Icon :path="mdiClose" /></button>
      </header>
      <form class="add-form" @submit.prevent="put(parseItem(input))">
        <input id="add-item" ref="field" v-model="input" class="text-input" type="text" autocomplete="off" :placeholder="t('addPlaceholder')" />
        <button type="submit" class="btn primary" :disabled="!input.trim()">{{ t("addItem") }}</button>
      </form>
      <div v-if="suggestions.length" class="list">
        <span class="label">{{ t("recent") }}</span>
        <div class="items">
          <button v-for="s in suggestions" :key="s.name" type="button" class="item suggestion" @click="put({ name: s.name })">{{ s.name }}</button>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
