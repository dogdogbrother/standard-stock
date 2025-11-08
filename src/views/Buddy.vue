<template>
  <div class="buddy-page">
    <div class="placeholder-card">
      <van-icon name="friends-o" class="icon" />
      <h2>伙伴中心</h2>
      <p>在这里与您的投资伙伴保持联系，功能正在建设中。</p>
    </div>
  </div>
</template>

<style scoped lang="less">
.buddy-page {
  min-height: calc(100vh - 50px);
  padding: @spacing-xl @spacing-lg @spacing-xl;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  width: 100%;
  max-width: 480px;
  text-align: center;
  padding: @spacing-xl;
  border-radius: @border-radius-lg;
  background-color: #ffffff;
  box-shadow: 0 12px 32px rgba(31, 45, 61, 0.08);

  .icon {
    font-size: 48px;
    color: @primary-color;
    margin-bottom: @spacing-md;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: @spacing-sm;
  }

  p {
    color: @text-color-secondary;
  }
}
</style>
