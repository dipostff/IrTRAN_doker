<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import HeaderComponent from "../components/HeaderComponent.vue";
import BeginnerInstructionsFillingRulesDetailComponent from "../components/BeginnerInstructionsFillingRulesDetailComponent.vue";
import { getFillingRulesContent } from "@/config/beginnerFillingRules";

const route = useRoute();
const title = computed(() => {
  const c = getFillingRulesContent(String(route.params.docType || ""));
  return c?.pageTitle
    ? `Тренажер ЭТРАН — Правила — ${c.pageTitle}`
    : 'Тренажер ЭТРАН — Правила заполнения';
});
</script>

<template>
  <HeaderComponent :title="title" />
  <BeginnerInstructionsFillingRulesDetailComponent />
</template>
