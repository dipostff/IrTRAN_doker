<script setup>
import { ref, onMounted } from "vue";
import router from "../router";
import { login, isAuthenticated, initKeycloak } from "../helpers/keycloak.js";

const auth_err = ref(false);

onMounted(async () => {
    // Check if already authenticated (Keycloak should be initialized in main.js)
    // Don't try to initialize again, just check status
    try {
        // Wait a bit for initialization from main.js to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (isAuthenticated()) {
            // User is already authenticated, redirect to menu
            router.push("/menu");
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
    }
});

async function logIn() {
    auth_err.value = false;
    try {
        // Use Keycloak login (redirects to Keycloak login page)
        await login();
    } catch (error) {
        console.error('Login error:', error);
        auth_err.value = true;
    }
}
</script>

<template>
    <div class="background">
        <div class="container-fluid" style="height: 100vh; display: flex; justify-content: center; align-items: center">
            <div class="container pt-5 pb-5">
                <h2 class="card-title text-center mb-4">Авторизация</h2>
                <div v-if="auth_err" class="alert alert-danger" role="alert">
                    Ошибка авторизации. Попробуйте снова.
                </div>
                <div class="form-group">
                    <p class="text-center text-white">Для входа нажмите кнопку "Войти"</p>
                    <p class="text-center text-white small">Вы будете перенаправлены на страницу авторизации Keycloak</p>
                </div>
                <div class="text-center">
                    <button @click="logIn()" class="btn btn-custom w-100">Войти</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.background {
    height: 100vh;
    width: 100%;
    background-image: url("@/assets/back_2.jpg");
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    position: absolute;
    top: 0px;
    right: 0px;
    bottom: 0px;
    left: 0px;
}
.container {
    width: 400px;
    background-color: #a3bfff;
    padding: 20px;
    border-radius: 8px;
}
.input-group-text {
    cursor: pointer;
}
.btn-custom {
    background-color: #3e6cb4;
    color: white;
}
.card-title {
    color: white;
}
</style>
