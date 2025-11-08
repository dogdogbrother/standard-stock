<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const ACCOUNT = 'tsdhr1'
const PASSWORD = 'Hejie.110'
const LOGIN_COOKIE_KEY = 'login'
const LOGIN_COOKIE_VALUE = '19910415'

const router = useRouter()

const formState = reactive({
  username: '',
  password: '',
})

const showPassword = ref(false)

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const setLoginCookie = () => {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `${LOGIN_COOKIE_KEY}=${LOGIN_COOKIE_VALUE}; path=/; expires=${expires.toUTCString()}`
}

const onSubmit = () => {
  if (!formState.username || !formState.password) {
    showToast('请输入账号和密码')
    return
  }

  if (formState.username !== ACCOUNT || formState.password !== PASSWORD) {
    showToast('账号或密码错误')
    return
  }

  setLoginCookie()
  showToast('登录成功')
  router.push('/app')
}
</script>

<template>
  <div class="login-page">
    <div class="logo-wrapper">
      <div class="logo-circle">
        <van-icon name="info" />
      </div>
    </div>

    <div class="header">
      <h1>Welcome Back</h1>
      <p>今天又是赚钱的一天啊</p>
    </div>

    <van-form @submit="onSubmit" class="login-form">
      <div class="field-group">
        <van-field
          v-model="formState.username"
          class="custom-field"
          name="username"
          placeholder="请输入用户名"
          :border="false"
          clearable
          label-align="top"
        >
          <template #label>
            <span class="field-label">用户名</span>
          </template>
          <template #left-icon>
            <van-icon name="user-o" />
          </template>
        </van-field>
      </div>

      <div class="field-group">
        <van-field
          v-model="formState.password"
          class="custom-field"
          :type="showPassword ? 'text' : 'password'"
          name="password"
          placeholder="请输入密码"
          :border="false"
          label-align="top"
        >
          <template #label>
            <span class="field-label">密码</span>
          </template>
          <template #left-icon>
            <van-icon name="lock" />
          </template>
          <template #button>
            <van-icon
              :name="showPassword ? 'eye-o' : 'closed-eye'"
              class="toggle-eye"
              @click="togglePassword"
            />
          </template>
        </van-field>
      </div>

      <van-button
        class="login-button"
        block
        round
        type="primary"
        native-type="submit"
      >
        登录
      </van-button>
    </van-form>
  </div>
</template>

<style scoped lang="less">
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 100vh;
  padding: 120px 24px 48px;
  background-color: #ffffff;
}

.logo-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: @spacing-lg;
}

.logo-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: @primary-color;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;

  .van-icon {
    font-size: 28px;
  }
}

.header {
  text-align: center;
  margin-bottom: @spacing-xl;

  h1 {
    font-size: 30px;
    font-weight: 700;
    color: #1f2a37;
    margin-bottom: @spacing-xs;
  }

  p {
    font-size: 14px;
    color: #6b7280;
  }
}

.login-form {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: @spacing-lg;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-field {
  --van-field-padding: 12px 16px;
  --van-field-background-color: transparent;
  --van-field-input-text-color: #111827;
  --van-field-placeholder-text-color: #9ca3af;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;

  .van-field__label {
    padding-bottom: 8px;
  }

  .van-field__left-icon {
    margin-right: 8px;
    display: flex;
    align-items: center;

    .van-icon {
      font-size: 18px;
      color: #9ca3af;
    }
  }

  .van-field__control {
    font-size: 14px;
  }

  .van-field__button {
    display: flex;
    align-items: center;
    padding-left: 8px;

    .van-icon {
      font-size: 18px;
      color: #9ca3af;
    }
  }
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.toggle-eye {
  cursor: pointer;
}

.login-button {
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
}
</style>
