@echo off
chcp 65001 >nul
title 商机管家 - 本地服务器
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Python。请先安装 Python（python.org），或改用其他方式部署。
  echo 也可以直接双击 index.html 使用（仅无法"添加到主屏幕"安装）。
  pause
  exit /b 1
)

echo ============================================
echo  商机管家 已启动
echo  本机访问:   http://localhost:8000
echo  手机访问:   http://电脑IP:8000  （同一WiFi，电脑IP用 ipconfig 查看）
echo  关闭本窗口即停止服务
echo ============================================
start "" http://localhost:8000/index.html
python -m http.server 8000
pause
