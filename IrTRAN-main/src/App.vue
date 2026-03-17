<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
    <router-view v-slot="{ Component }">
        <component :is="Component" />
    </router-view>
</template>

<style scoped>

</style>
