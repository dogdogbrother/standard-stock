"""
检查基金类型分布 - 用于确定过滤规则
"""

import sys
import akshare as ak

# 设置控制台编码
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("正在获取基金列表...")
fund_list = ak.fund_name_em()

print(f"\n成功获取 {len(fund_list)} 只基金")

# 统计基金类型分布
print("\n所有基金类型分布：")
print("=" * 70)
type_dist = fund_list['基金类型'].value_counts()

for fund_type, count in type_dist.items():
    percentage = (count / len(fund_list)) * 100
    print(f"{fund_type:30s} {count:6d} 只  ({percentage:5.2f}%)")

print("=" * 70)
print(f"总计: {len(fund_list)} 只基金")

# 显示包含"股票"的类型
print("\n\n包含'股票'的基金类型：")
print("=" * 70)
stock_types = fund_list[fund_list['基金类型'].str.contains('股票', na=False)]
for fund_type, count in stock_types['基金类型'].value_counts().items():
    print(f"{fund_type:30s} {count:6d} 只")

# 显示包含"混合"的类型
print("\n\n包含'混合'的基金类型：")
print("=" * 70)
mixed_types = fund_list[fund_list['基金类型'].str.contains('混合', na=False)]
for fund_type, count in mixed_types['基金类型'].value_counts().items():
    print(f"{fund_type:30s} {count:6d} 只")

print("\n\n提示：根据上述分布，可以调整 fund_data_fetcher.py 中的过滤规则")

