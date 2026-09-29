<template>
  <div class="ingredients" :class="{ 'is-disabled': disabled, 'has-items': modelValue.length }">
    <div class="ingredients__body" @click="focus">
      <ul v-if="modelValue.length" class="ingredients__list">
        <li v-for="(item, index) in modelValue" :key="item" class="chip">
          {{ item }}
          <button
            class="chip__remove"
            type="button"
            :disabled="disabled"
            :aria-label="`Убрать ${item}`"
            @click.stop="remove(index)"
          >×</button>
        </li>
      </ul>
      <input
        ref="input"
        v-model="draft"
        class="ingredients__input"
        type="text"
        enterkeyhint="done"
        autocomplete="off"
        :disabled="disabled"
        :placeholder="modelValue.length ? 'Ещё продукт…' : 'Например: картошка, сосиски, помидоры'"
        aria-label="Продукты"
        @input="onInput"
        @keydown.enter.prevent="onEnter"
        @keydown.backspace="onBackspace"
        @blur="commit"
      >
    </div>
    <div v-if="$slots.actions" class="ingredients__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script>
import { mergeIngredients } from '@/utils/ingredients.js';

export default {
  name: 'IngredientInput',
  props: {
    modelValue: { type: Array, required: true },
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'submit'],
  data() {
    return { draft: '' };
  },
  methods: {
    focus() {
      this.$refs.input?.focus();
    },
    add(items) {
      const next = mergeIngredients(this.modelValue, items);
      if (next.length !== this.modelValue.length) this.$emit('update:modelValue', next);
    },
    // Запятая добавляет продукт сразу — удобно и с телефонной клавиатуры
    onInput() {
      if (!this.draft.includes(',')) return;
      const parts = this.draft.split(',');
      this.draft = parts.pop().trimStart();
      this.add(parts);
    },
    commit() {
      if (!this.draft.trim()) return;
      this.add([this.draft]);
      this.draft = '';
    },
    // Enter в пустом поле — то же, что кнопка «Подобрать блюда»
    onEnter() {
      if (this.draft.trim()) this.commit();
      else this.$emit('submit');
    },
    onBackspace() {
      if (this.draft || !this.modelValue.length) return;
      this.remove(this.modelValue.length - 1);
    },
    remove(index) {
      this.$emit('update:modelValue', this.modelValue.filter((_, i) => i !== index));
    },
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/IngredientInput.scss"></style>
