<template>
  <AppHeader />
  <RouterView />
  <AppFooter />
  <ScrollTopButton />
</template>

<script>
import AppHeader from './components/AppHeader.vue';
import AppFooter from './components/AppFooter.vue';
import ScrollTopButton from './components/ScrollTopButton.vue';

export default {
  name: 'App',
  components: { AppHeader, AppFooter, ScrollTopButton },
};
</script>
