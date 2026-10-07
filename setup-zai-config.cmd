@echo off
echo Creating .z-ai-config file...
(
echo {
echo   "baseUrl": "https://internal-api.z.ai/v1",
echo   "apiKey": "Z.ai",
echo   "chatId": "chat-8807fcf6-1ead-48f2-be79-6439715d5eeb",
echo   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjcxYTQ4NzgtZTEyZC00MTk4LWJiZTgtMTZmMzQ1OTMxNzNjIiwiY2hhdF9pZCI6ImNoYXQtODgwN2ZjZjYtMWVhZC00OGYyLWJlNzktNjQzOTcxNWQ1ZWViIiwicGxhdGZvcm0iOiJ6YWkifQ.Lq2vfnARva1NqVCKTqaNxJZyh0hszvah4z40Pe40iwc",
echo   "userId": "271a4878-e12d-4198-bbe8-16f34593173c"
echo }
) > .z-ai-config
echo Done! File created at: %CD%\.z-ai-config
pause
