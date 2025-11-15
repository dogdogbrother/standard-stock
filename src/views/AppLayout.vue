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
  min-height: 100vh;
}

.app-content {
  flex: 1;
  overflow-y: auto;
  // 为底部导航栏预留空间
  padding-bottom: 50px;
  // 禁止橡皮筋效果
  overscroll-behavior: none;
}

.app-tabbar {
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
  // 适配安全区域
  padding-bottom: env(safe-area-inset-bottom);
}

// 调整 Vant Tabbar 内部项的位置
:deep(.van-tabbar-item) {
  padding-bottom: 0;
}
</style>
