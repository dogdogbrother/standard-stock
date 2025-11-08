<template>
  <div class="app-layout">
    <div class="app-content">
      <router-view />
    </div>
    <van-tabbar route class="app-tabbar">
      <van-tabbar-item to="/app/watchlist" icon="star-o">自选</van-tabbar-item>
      <van-tabbar-item to="/app/buddy" icon="friends-o">伙伴</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped lang="less">
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f5f6f8;
}

.app-content {
  flex: 1;
  overflow-y: auto;
}

.app-tabbar {
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
}
</style>
