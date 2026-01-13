"""
测试脚本：验证 AKShare 和 Supabase 连接
在运行主脚本前，先运行此脚本测试环境配置是否正确
"""

import os
import sys
from dotenv import load_dotenv

# 设置控制台编码为 UTF-8（解决 Windows 中文乱码问题）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("=" * 50)
print("环境测试开始")
print("=" * 50)

# 1. 测试环境变量加载
print("\n1. 测试环境变量...")
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] 环境变量未配置")
    print("   请复制 env.template 为 .env 并填写配置")
    exit(1)
else:
    print(f"[OK] Supabase URL: {SUPABASE_URL}")
    print(f"[OK] Service Key: {SUPABASE_KEY[:20]}...")

# 2. 测试 AKShare
print("\n2. 测试 AKShare...")
try:
    import akshare as ak
    print("[OK] AKShare 已安装")
    
    # 测试获取简单数据
    print("  测试获取数据...")
    test_data = ak.stock_zh_a_spot_em()
    print(f"[OK] 成功获取 {len(test_data)} 条 A股数据")
except ImportError:
    print("[ERROR] AKShare 未安装，请运行: pip install akshare")
    exit(1)
except Exception as e:
    print(f"[ERROR] AKShare 测试失败: {e}")
    exit(1)

# 3. 测试 Supabase 连接
print("\n3. 测试 Supabase 连接...")
try:
    import requests
    print("[OK] requests 库已安装")
    
    # 测试 Supabase REST API 连接
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}'
    }
    url = f"{SUPABASE_URL}/rest/v1/fund_list?select=*&limit=1"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"[OK] 成功连接 Supabase")
        print(f"[OK] fund_list 表存在（包含 {len(data)} 条数据）")
    elif response.status_code == 404:
        print("[WARN] fund_list 表不存在")
        print("  请在 Supabase SQL Editor 中执行 create_tables.sql")
    else:
        print(f"[WARN] Supabase 连接异常: {response.status_code}")
        print("  请检查 .env 中的配置是否正确")
    
except ImportError:
    print("[ERROR] requests 库未安装，请运行: pip install requests")
    exit(1)
except Exception as e:
    print(f"[ERROR] Supabase 连接失败: {e}")
    print("  请检查 .env 中的配置是否正确")
    exit(1)

# 4. 测试完成
print("\n" + "=" * 50)
print("[OK] 所有测试通过！可以运行主脚本了")
print("  运行: python fund_data_fetcher.py")
print("=" * 50)

