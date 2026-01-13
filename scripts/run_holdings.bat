@echo off
REM 获取基金持仓数据（从数据库读取基金列表）

REM 设置控制台编码为 UTF-8
chcp 65001 >nul 2>&1

echo ========================================
echo 基金持仓获取脚本
echo ========================================
echo.
echo 功能：获取基金的持仓和规模数据
echo 前提：fund_list 表已有数据
echo.

REM 检查虚拟环境
if not exist "venv\" (
    echo [错误] 虚拟环境不存在
    echo [提示] 请先运行: run_list_only.bat
    pause
    exit /b 1
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 检查 .env 文件
if not exist ".env" (
    echo [错误] 未找到 .env 文件
    echo [提示] 请复制 env.template 为 .env 并填写配置
    pause
    exit /b 1
)

REM 运行脚本
echo [开始] 获取基金持仓数据...
echo ========================================
python fetch_holdings_only.py

echo.
echo ========================================
echo [完成] 脚本执行完毕
echo ========================================
echo.
echo 提示：可以修改 fetch_holdings_only.py 中的 START_INDEX
echo       来分批获取不同范围的基金持仓数据
echo.
pause

