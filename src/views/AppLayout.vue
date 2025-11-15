<template>
  <div class="app-layout">
    <div class="app-content">
      <router-view />
    </div>
    <van-tabbar route class="app-tabbar">
      <van-tabbar-item to="/app/watchlist" icon="star-o">自选</van-tabbar-item>
      <van-tabbar-item to="/app/buddy" icon="friends-o">伙伴</van-tabbar-item>
      <van-tabbar-item to="/app/profile" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped lang="less">
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; // 动态视口高度，更精确（现代浏览器支持）
}

.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  // 禁止橡皮筋效果
  overscroll-behavior: none;
}

.app-tabbar {
  flex-shrink: 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
  // 适配安全区域
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
