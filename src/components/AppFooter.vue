<template>
  <footer class="footer">
    <p class="footer__copy">© {{ year }} «По сусекам». Все права защищены.</p>
  </footer>
</template>

<script>
export default {
  name: 'AppFooter',
  data() {
    return { year: new Date().getFullYear() };
  },
};
</script>

<style scoped lang="scss" src="@/styles/components/AppFooter.scss"></style>
