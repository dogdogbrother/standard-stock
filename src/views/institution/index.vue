<script setup lang="ts">
// import { ref } from 'vue'

// 机构数据（示例）
// const institutions = ref([
//   {
//     name: '机构示例',
//     code: 'INST001',
//     description: '这是一个机构示例'
//   }
// ])

</script>

<template>
  <div class="institution-page">
    <div class="page-header">
      <h2>机构</h2>
    </div>
    
    <div class="content">
      <div class="empty-state">
        <van-icon name="chart-trending-o" class="icon" />
        <h3>机构页面</h3>
        <p>敬请期待</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.institution-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f7f8fa;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
}

.page-header {
  padding: 16px;
  background-color: #ffffff;
  border-bottom: 1px solid #ebedf0;
  
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #323233;
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  
  .icon {
    font-size: 64px;
    color: #3b82f6;
    margin-bottom: 16px;
  }
  
  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #323233;
    margin-bottom: 8px;
  }
  
  p {
    font-size: 14px;
    color: #969799;
  }
}
</style>

