@echo off
REM 只获取基金列表并存入 fund_list 表

REM 设置控制台编码为 UTF-8
chcp 65001 >nul 2>&1

echo ========================================
echo 基金列表获取脚本（简化版）
echo ========================================
echo.
echo 功能：只获取基金列表并存入 fund_list 表
echo 不包含：持仓数据、规模数据
echo.

REM 检查虚拟环境
if not exist "venv\" (
    echo [错误] 虚拟环境不存在
    echo [提示] 请先运行: run.bat
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
echo [开始] 运行基金列表获取脚本...
echo ========================================
python fetch_fund_list_only.py

echo.
echo ========================================
echo [完成] 脚本执行完毕
echo ========================================
pause

