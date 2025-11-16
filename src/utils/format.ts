/**
 * 格式化数字，保留指定小数位并去除末尾的0
 * @param value 要格式化的数值
 * @param decimals 保留的小数位数，默认2位
 * @returns 格式化后的数字
 */
export function formatNumber(value: number | string, decimals: number = 2): number {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 0
  return Number(num.toFixed(decimals))
}

/**
 * 格式化数字为字符串，保留指定小数位并去除末尾的0
 * @param value 要格式化的数值
 * @param decimals 保留的小数位数，默认2位
 * @returns 格式化后的字符串
 */
export function formatNumberStr(value: number | string, decimals: number = 2): string {
  return formatNumber(value, decimals).toString()
}

