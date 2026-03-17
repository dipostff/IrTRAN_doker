<script setup>
import HeaderComponent from '../components/HeaderComponent.vue';
import ScenariosComponent from '../components/ScenariosComponent.vue';
import { updateTitle } from '@/helpers/headerHelper';

updateTitle('Тренажер ЭТРАН - Сценарии');
</script>

<template>
  <HeaderComponent />
  <ScenariosComponent />
</template>

