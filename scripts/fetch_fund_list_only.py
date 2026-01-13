"""
基金列表获取脚本（简化版）
只获取基金列表并存入 fund_list 表，不获取持仓和规模数据
"""

print("[DEBUG] 正在导入模块...")
import os
import sys

print("[DEBUG] 设置编码...")
# 设置控制台编码为 UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

print("[DEBUG] 导入 akshare...")
import akshare as ak

print("[DEBUG] 导入 pandas...")
import pandas as pd

print("[DEBUG] 导入 requests...")
import requests

from datetime import datetime
from dotenv import load_dotenv

print("[DEBUG] 模块导入完成！\n")

# 加载环境变量
print("[DEBUG] 加载环境变量...")
load_dotenv()

# Supabase 配置
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("请在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY")

print(f"[DEBUG] Supabase URL: {SUPABASE_URL}")
print(f"[DEBUG] 配置加载完成！\n")

# Supabase REST API 请求头
HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}


def fetch_fund_list():
    """获取所有公募基金列表"""
    print("正在请求 AKShare 基金列表接口...")
    print("(如果卡住超过 30 秒，请按 Ctrl+C 中断)")
    try:
        fund_list = ak.fund_name_em()
        print(f"[OK] 成功获取 {len(fund_list)} 只基金")
        return fund_list
    except KeyboardInterrupt:
        print("\n[中断] 用户取消操作")
        return None
    except Exception as e:
        print(f"[ERROR] 获取基金列表失败: {e}")
        return None


def filter_fund_list(fund_list):
    """过滤基金类型"""
    print("\n正在过滤基金类型...")
    original_count = len(fund_list)
    
    fund_type_col = fund_list['基金类型'].fillna('')
    
    # 排除的基金类型关键字
    exclude_keywords = ['指数型', '债券型', '债务型', '货币型', 'QDII', 'FOF', '理财', '偏债', 'Reits', 'REITs', '商品']
    
    # 保留：以"股票型"或"混合型"开头的，且不包含排除关键字
    keep_mask = (
        (fund_type_col.str.startswith('股票型', na=False) | 
         fund_type_col.str.startswith('混合型', na=False))
    )
    
    for keyword in exclude_keywords:
        keep_mask = keep_mask & ~fund_type_col.str.contains(keyword, case=False, na=False)
    
    fund_list = fund_list[keep_mask]
    fund_list = fund_list.reset_index(drop=True)
    
    filtered_count = len(fund_list)
    excluded_count = original_count - filtered_count
    
    print(f"原始基金数量: {original_count} 只")
    print(f"过滤后数量: {filtered_count} 只")
    print(f"已排除: {excluded_count} 只")
    
    # 显示保留的基金类型
    if filtered_count > 0:
        type_dist = fund_list['基金类型'].value_counts().head(10)
        print("\n保留的基金类型（Top 10）:")
        for fund_type, count in type_dist.items():
            print(f"  - {fund_type}: {count} 只")
    
    return fund_list


def clear_fund_list_table():
    """清空 fund_list 表"""
    print("\n正在清空 fund_list 表...")
    try:
        url = f"{SUPABASE_URL}/rest/v1/fund_list?id=gte.0"
        response = requests.delete(url, headers=HEADERS)
        if response.status_code in [200, 204]:
            print("[OK] fund_list 表已清空")
            return True
        else:
            print(f"[WARN] 清空失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"[ERROR] 清空失败: {e}")
        return False


def save_fund_list_to_db(fund_list):
    """保存基金列表到数据库"""
    if fund_list is None or len(fund_list) == 0:
        print("基金列表为空，跳过保存")
        return False
    
    print("\n正在保存基金列表到数据库...")
    
    records = []
    for _, row in fund_list.iterrows():
        record = {
            'fund_code': str(row.get('基金代码', '')),
            'fund_name': str(row.get('基金简称', '')),
            'fund_type': str(row.get('基金类型', '')),
            'updated_at': datetime.now().isoformat()
        }
        records.append(record)
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/fund_list"
        response = requests.post(url, json=records, headers=HEADERS)
        
        if response.status_code in [200, 201, 204]:
            print(f"[OK] 成功保存 {len(records)} 条基金记录")
            return True
        else:
            print(f"[ERROR] 保存失败: {response.status_code}")
            print(f"响应内容: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"[ERROR] 保存失败: {e}")
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("基金列表获取脚本（仅获取并保存基金列表）")
    print("=" * 60)
    
    # 步骤1：获取基金列表
    print("\n[步骤 1/4] 获取基金列表")
    fund_list = fetch_fund_list()
    
    if fund_list is None or len(fund_list) == 0:
        print("[ERROR] 获取基金列表失败，退出")
        return
    
    # 步骤2：过滤基金类型
    print("\n[步骤 2/4] 过滤基金类型")
    fund_list = filter_fund_list(fund_list)
    
    if len(fund_list) == 0:
        print("[ERROR] 过滤后无数据，退出")
        return
    
    # 步骤3：清空表
    print("\n[步骤 3/4] 清空 fund_list 表")
    clear_fund_list_table()
    
    # 步骤4：保存数据
    print("\n[步骤 4/4] 保存到数据库")
    result = save_fund_list_to_db(fund_list)
    
    # 完成
    print("\n" + "=" * 60)
    if result:
        print("[完成] 基金列表已成功保存到数据库！")
        print(f"总计: {len(fund_list)} 只基金")
        print("\n下一步：运行完整脚本获取持仓数据")
        print("  命令: .\\run_full.bat")
    else:
        print("[失败] 基金列表保存失败")
    print("=" * 60)


if __name__ == "__main__":
    main()

