<template>
  <section class="search-panel">
    <h1 class="search-panel__title">Что есть в холодильнике?</h1>
    <p class="search-panel__hint">Напишите, продиктуйте или сфотографируйте продукты — подберём блюда из того, что есть.</p>

    <form class="search-panel__form" @submit.prevent="$emit('search')">
      <IngredientInput
        :model-value="modelValue"
        :disabled="busy"
        @update:model-value="$emit('update:modelValue', $event)"
        @submit="$emit('search')"
      >
        <template #actions>
          <button
            v-if="modelValue.length"
            class="search-panel__icon"
            type="button"
            title="Очистить"
            aria-label="Очистить"
            :disabled="busy"
            @click="clear"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <label class="search-panel__icon" :class="{ 'is-disabled': busy }" title="Сфотографировать продукты">
            <input
              class="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Сфотографировать продукты"
              :disabled="busy"
              @change="onPhoto"
            >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h1.6l1.4-2h6l1.4 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
          </label>
          <button
            v-if="speechSupported"
            class="search-panel__icon"
            :class="{ 'is-listening': listening }"
            type="button"
            :title="listening ? 'Готово' : 'Продиктовать продукты'"
            :aria-label="listening ? 'Голосовой ввод: готово' : 'Голосовой ввод'"
            :aria-pressed="listening"
            :disabled="busy && !listening"
            @click="toggleVoice"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
          </button>
        </template>
      </IngredientInput>

      <button class="search-panel__button" type="submit" :disabled="busy">
        <span v-if="loading" class="search-panel__spinner" aria-hidden="true" />
        {{ loading ? 'Подбираем блюда…' : 'Подобрать блюда' }}
      </button>
    </form>

    <p v-if="listening || transcript" class="search-panel__transcript">
      {{ transcript || 'Говорите…' }}
    </p>
    <div v-else-if="photoPreview" class="search-panel__preview">
      <img :src="photoPreview" alt="Фото продуктов">
      <span v-if="recognizing">Распознаём продукты…</span>
      <span v-else>Фото продуктов</span>
    </div>

    <div v-if="!modelValue.length && !busy" class="search-panel__examples">
      <span>Попробуйте:</span>
      <button
        v-for="example in examples"
        :key="example"
        class="search-panel__example"
        type="button"
        @click="$emit('update:modelValue', example.split(', '))"
      >{{ example }}</button>
    </div>

    <p class="search-panel__status" :class="{ 'is-error': status.error }" role="status" aria-live="polite">
      {{ status.text }}
    </p>
  </section>
</template>

<script>
import IngredientInput from './IngredientInput.vue';
import { mergeIngredients } from '@/utils/ingredients.js';
import { prepareImage, recognize } from '@/utils/image.js';
import { listen, speechSupported } from '@/utils/speech.js';

export default {
  name: 'RecipeSearch',
  components: { IngredientInput },
  props: {
    modelValue: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    status: { type: Object, default: () => ({ text: '', error: false }) },
  },
  emits: ['update:modelValue', 'search', 'clear', 'status'],
  data() {
    return {
      examples: ['картошка, сосиски, помидоры', 'яйца, молоко, сыр', 'курица, рис, морковь'],
      speechSupported,
      listening: false,
      recognizing: false,
      transcribing: false,
      transcript: '',
      photoPreview: '',
    };
  },
  computed: {
    busy() {
      return this.loading || this.listening || this.transcribing || this.recognizing;
    },
  },
  methods: {
    // × — единственное, что стирает: продукты, рецепты, фразу и превью
    clear() {
      this.transcript = '';
      this.photoPreview = '';
      this.$emit('clear');
    },

    // Голос и фото только дописывают продукты — искать решает человек кнопкой
    addRecognized(items) {
      const next = mergeIngredients(this.modelValue, items);
      const added = next.slice(this.modelValue.length);
      this.$emit('update:modelValue', next);
      // Пустой ответ распознавания — съедобного не нашлось совсем; иначе всё уже было в списке
      let text = `Добавили: ${added.join(', ')}. Можно добавить ещё или нажать «Подобрать блюда»`;
      if (!items.length) text = 'Съедобных продуктов не нашли — назовите или сфотографируйте продукты';
      else if (!added.length) text = 'Эти продукты уже в списке — можно добавить ещё или нажать «Подобрать блюда»';
      this.$emit('status', { text, error: false });
    },

    async onPhoto(event) {
      const [file] = event.target.files;
      // Сбрасываем, чтобы то же фото можно было выбрать ещё раз
      event.target.value = '';
      if (!file) return;
      this.transcript = '';
      this.recognizing = true;
      this.$emit('status', { text: 'Смотрим, что на фото…', error: false });
      try {
        const { image, mediaType, preview } = await prepareImage(file);
        this.photoPreview = preview;
        this.addRecognized(await recognize({ image, mediaType }));
      } catch (error) {
        this.$emit('status', { text: error.message, error: true });
      } finally {
        this.recognizing = false;
      }
    },
    toggleVoice() {
      if (this.listening) {
        // Повторное нажатие — «Готово»: заканчиваем и отправляем то, что услышали
        this.session?.stop();
        return;
      }
      this.startVoice();
    },

    // Web Speech или запись + Whisper — решает speech.js, компоненту всё равно
    async startVoice() {
      this.transcript = '';
      this.photoPreview = '';
      this.listening = true;
      this.$emit('status', { text: 'Слушаем… Нажмите на микрофон ещё раз, когда закончите', error: false });
      this.session = listen({
        lang: 'ru-RU',
        onInterim: (text) => {
          this.transcript = text;
        },
        onProcessing: () => {
          this.listening = false;
          this.transcribing = true;
          this.$emit('status', { text: 'Распознаём речь…', error: false });
        },
      });
      let text = '';
      try {
        text = await this.session.result;
      } catch (error) {
        this.$emit('status', { text: error.message, error: true });
        return;
      } finally {
        this.session = null;
        this.listening = false;
        this.transcribing = false;
      }
      if (text) this.recognizeText(text);
      else this.$emit('status', { text: 'Ничего не услышали, попробуйте ещё раз', error: true });
    },

    async recognizeText(text) {
      this.recognizing = true;
      this.$emit('status', { text: 'Разбираем продукты…', error: false });
      try {
        this.addRecognized(await recognize({ text: text.slice(0, 1000) }));
      } catch (error) {
        this.$emit('status', { text: error.message, error: true });
      } finally {
        this.recognizing = false;
      }
    },
  },
  beforeUnmount() {
    this.session?.abort();
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/RecipeSearch.scss"></style>
