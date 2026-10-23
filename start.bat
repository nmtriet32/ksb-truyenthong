@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5500
echo.
echo  KSB Dashboard - Truyen thong 2027
echo  Mo trinh duyet tai http://localhost:%PORT%
echo.

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  node server.js
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT%
  goto :eof
)

echo Khong tim thay Node.js hoac Python tren may.
echo Cach nhanh nhat: mo thu muc nay bang VS Code, cai tien ich "Live Server",
echo roi bam "Go Live" o goc duoi ben phai.
pause
