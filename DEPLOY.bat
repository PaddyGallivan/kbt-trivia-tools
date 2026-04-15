@echo off
cd /d "%~dp0"
echo.
echo === KBT Question Dev Deploy ===
echo.
git add question-dev.html brain-tool.html face-morph-tool.html ghost-actors-tool.html crack-the-code-tool.html brand-tool.html soundmash-tool.html carmen-sandiego-tool.html linked-pics-tool.html guess-the-year-tool.html
git commit -m "Add Linked Pics + Guess The Year tools — all 9 tools complete"
git push origin main
echo.
echo === Deploy complete! Vercel will auto-build. ===
echo.
pause
