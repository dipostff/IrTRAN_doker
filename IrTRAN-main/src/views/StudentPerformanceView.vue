<script setup>
import HeaderComponent from "../components/HeaderComponent.vue";
import StudentPerformanceComponent from "../components/StudentPerformanceComponent.vue";
import { updateTitle } from "@/helpers/headerHelper";

updateTitle("Тренажер ЭТРАН - Успеваемость");
</script>

<template>
  <HeaderComponent title="Тренажер ЭТРАН — Успеваемость" />
  <StudentPerformanceComponent />
</template>
