"""
基金持仓获取脚本（简化版 - 不获取规模数据）
只获取基金的持仓数据，基金列表从数据库读取
"""

print("[DEBUG] 正在导入模块...")
import os
import sys

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

import akshare as ak
import pandas as pd
import requests
from datetime import datetime
from dotenv import load_dotenv

print("[DEBUG] 模块导入完成！\n")

# 加载环境变量
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("请在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY")

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}


def fetch_fund_list_from_db():
    """从数据库读取基金列表（支持分页获取所有数据）"""
    print("正在从数据库读取基金列表...")
    all_data = []
    offset = 0
    page_size = 1000
    
    try:
        while True:
            # 使用 Range header 分页获取
            headers_with_range = HEADERS.copy()
            headers_with_range['Range'] = f'{offset}-{offset + page_size - 1}'
            
            url = f"{SUPABASE_URL}/rest/v1/fund_list?select=fund_code,fund_name,fund_type&order=fund_code.asc"
            response = requests.get(url, headers=headers_with_range)
            
            if response.status_code == 200 or response.status_code == 206:
                data = response.json()
                if len(data) == 0:
                    break  # 没有更多数据了
                
                all_data.extend(data)
                print(f"  已读取 {len(all_data)} 只基金...")
                
                if len(data) < page_size:
                    break  # 最后一页了
                
                offset += page_size
            else:
                print(f"[ERROR] 读取失败: {response.status_code}")
                break
        
        if len(all_data) == 0:
            print("[ERROR] 数据库中没有基金数据")
            print("[提示] 请先运行: .\\run_list_only.bat")
            return None
        
        fund_list = pd.DataFrame(all_data)
        print(f"[OK] 成功读取全部 {len(fund_list)} 只基金")
        return fund_list
    except Exception as e:
        print(f"[ERROR] 读取失败: {e}")
        return None


def fetch_fund_holdings(fund_code):
    """获取单只基金的持仓数据"""
    try:
        holdings = ak.fund_portfolio_hold_em(symbol=fund_code, date="")
        return holdings
    except Exception as e:
        return None


def save_fund_holdings_to_db(fund_code, holdings_df):
    """保存基金持仓数据"""
    if holdings_df is None or len(holdings_df) == 0:
        return False
    
    records = []
    for _, row in holdings_df.iterrows():
        record = {
            'fund_code': fund_code,
            'stock_code': str(row.get('股票代码', '')),
            'stock_name': str(row.get('股票名称', '')),
            'holding_ratio': float(row.get('占净值比例', 0)),
            'holding_shares': float(row.get('持股数', 0)) if '持股数' in row else 0,
            'holding_value': float(row.get('持仓市值', 0)) if '持仓市值' in row else 0,
            'report_date': str(row.get('季度', '')),
            'updated_at': datetime.now().isoformat()
        }
        records.append(record)
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/fund_holdings"
        response = requests.post(url, json=records, headers=HEADERS)
        
        if response.status_code in [200, 201, 204]:
            return True
        else:
            # 打印详细错误信息
            print(f"    [DEBUG] 保存失败: {response.status_code}")
            print(f"    [DEBUG] 错误详情: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"    [DEBUG] 异常: {e}")
        return False


def main():
    """主函数"""
    print("=" * 60)
    print("基金持仓获取脚本（从数据库读取基金列表）")
    print("=" * 60)
    
    # 从数据库读取基金列表
    fund_list = fetch_fund_list_from_db()
    
    if fund_list is None:
        return
    
    # 分批配置
    BATCH_MODE = True
    START_INDEX = 8872   # 修改这里设置起始位置
    BATCH_SIZE = 10000    # 每批处理数量
    
    if BATCH_MODE:
        MAX_FUNDS = BATCH_SIZE
    else:
        MAX_FUNDS = len(fund_list)
    
    print(f"\n正在获取第 {START_INDEX+1} 到 {min(START_INDEX+MAX_FUNDS, len(fund_list))} 只基金的持仓数据...")
    print("=" * 60)
    
    success_count = 0
    skip_count = 0
    
    for loop_idx, (orig_idx, row) in enumerate(fund_list.iloc[START_INDEX:START_INDEX+MAX_FUNDS].iterrows()):
        fund_code = str(row.get('fund_code', ''))
        fund_name = str(row.get('fund_name', ''))
        
        current_num = START_INDEX + loop_idx + 1  # 使用循环索引，不是原始索引
        total_in_batch = min(START_INDEX + MAX_FUNDS, len(fund_list))
        print(f"\n[{current_num}/{total_in_batch}] {fund_code} - {fund_name}")
        
        try:
            # 获取持仓数据
            holdings = fetch_fund_holdings(fund_code)
            if holdings is not None and len(holdings) > 0:
                if save_fund_holdings_to_db(fund_code, holdings):
                    print(f"  [OK] 持仓: {len(holdings)} 条")
                    success_count += 1
                else:
                    print(f"  [SKIP] 持仓保存失败")
                    skip_count += 1
            else:
                print(f"  [SKIP] 无持仓数据")
                skip_count += 1
        
        except KeyboardInterrupt:
            print("\n[中断] 用户停止操作")
            break
        except Exception as e:
            print(f"  [ERROR] {e}")
            skip_count += 1
            continue
        
        # 每 50 个显示统计
        if (loop_idx + 1) % 50 == 0:
            print(f"\n--- 进度统计 ---")
            print(f"已处理: {loop_idx + 1} 只")
            print(f"成功: {success_count} 只")
            print(f"跳过: {skip_count} 只")
    
    print("\n" + "=" * 60)
    print("[完成] 基金持仓数据获取完成！")
    print(f"成功获取: {success_count} 只基金")
    print(f"跳过/失败: {skip_count} 只基金")
    print(f"总计处理: {success_count + skip_count} 只基金")
    print("=" * 60)
    print("\n提示：fund_holdings 表通过 report_date 字段记录不同时期的持仓")
    print("      每个季度的持仓变化都会作为新记录插入")


if __name__ == "__main__":
    main()
