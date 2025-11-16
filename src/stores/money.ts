import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface MoneyRecord {
  id: number
  money: number // 单位：元
  usedMoney?: number // 单位：元（持仓市值）
  created_at: string
}

export const useMoneyStore = defineStore('money', () => {
  const moneyData = ref<MoneyRecord | null>(null)
  const loading = ref(false)
  const error = ref('')

  // 获取可用资金（元）
  const availableMoney = computed(() => moneyData.value?.money || 0)

  // 获取持仓市值（元）
  const usedMoney = computed(() => moneyData.value?.usedMoney || 0)

  // 获取总资产（可用资金 + 持仓市值）
  const totalAssets = computed(() => availableMoney.value + usedMoney.value)

  // 获取 money 数据
  const fetchMoney = async (force = false) => {
    // 如果已有缓存且不是强制刷新，则不重复请求
    if (!force && moneyData.value) {
      return
    }

    loading.value = true
    error.value = ''
    
    try {
      const { data, error: fetchError } = await supabase
        .from('money')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (fetchError) {
        throw fetchError
      }
      
      // 将分转换为元显示
      if (data) {
        moneyData.value = {
          id: data.id,
          money: data.money / 100,
          usedMoney: data.usedMoney ? data.usedMoney / 100 : 0,
          created_at: data.created_at
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 更新可用资金（修正金额）
  const updateMoney = async (amountInYuan: number) => {
    if (!moneyData.value || !moneyData.value.id) {
      throw new Error('没有可用的资金数据')
    }

    try {
      // 将元转换为分存储到数据库
      const amountInCents = Math.round(amountInYuan * 100)
      
      // 更新最新的记录
      const { error: updateError } = await supabase
        .from('money')
        .update({ money: amountInCents })
        .eq('id', moneyData.value.id)
      
      if (updateError) throw updateError
      
      // 更新本地缓存（保持元为单位）
      moneyData.value.money = amountInYuan
      
      return true
    } catch (err) {
      throw err
    }
  }

  // 更新可用资金（用于录入持股、减仓等场景）
  const updateMoneyByAmount = async (changeAmountInYuan: number) => {
    try {
      // 获取今天的开始和结束时间
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowISO = tomorrow.toISOString()
      
      // 查找今天是否已有记录
      const { data: todayMoney, error: todayError } = await supabase
        .from('money')
        .select('*')
        .gte('created_at', todayISO)
        .lt('created_at', tomorrowISO)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (todayError) throw todayError
      
      // 计算新的资金数据（金额单位：分）
      const changeAmountInCents = Math.round(changeAmountInYuan * 100)
      
      if (todayMoney) {
        // 今天已有记录，更新它
        const newMoney = todayMoney.money + changeAmountInCents
        
        const { error: updateError } = await supabase
          .from('money')
          .update({ money: newMoney })
          .eq('id', todayMoney.id)
        
        if (updateError) throw updateError

        // 更新本地缓存
        if (moneyData.value && moneyData.value.id === todayMoney.id) {
          moneyData.value.money = newMoney / 100
        } else {
          // 如果缓存的不是今天的记录，重新获取
          await fetchMoney(true)
        }
      } else {
        // 今天没有记录，获取最新记录并插入新记录
        const { data: latestMoney, error: fetchError } = await supabase
          .from('money')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        if (fetchError) throw fetchError
        
        const newMoney = latestMoney.money + changeAmountInCents
        
        const { data: insertedData, error: insertError } = await supabase
          .from('money')
          .insert({ money: newMoney })
          .select()
          .single()
        
        if (insertError) throw insertError
        
        // 更新本地缓存为新插入的记录
        if (insertedData) {
          moneyData.value = {
            id: insertedData.id,
            money: insertedData.money / 100,
            usedMoney: insertedData.usedMoney ? insertedData.usedMoney / 100 : 0,
            created_at: insertedData.created_at
          }
        }
      }
      
      return true
    } catch (err) {
      throw err
    }
  }

  // 强制刷新
  const refreshMoney = async () => {
    await fetchMoney(true)
  }

  return {
    moneyData,
    loading,
    error,
    availableMoney,
    usedMoney,
    totalAssets,
    fetchMoney,
    updateMoney,
    updateMoneyByAmount,
    refreshMoney
  }
})

