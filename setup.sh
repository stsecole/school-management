#!/bin/bash
set -e
echo "============================================"
echo "  School Management System - Setup"
echo "============================================"
mkdir -p db
echo "[1/4] Installing packages..."
npm install
echo "[2/4] Generating Prisma..."
npx prisma generate
echo "[3/4] Creating database..."
npx prisma db push --accept-data-loss
echo "[4/4] Building..."
npm run build
echo ""
echo "✅ Done! Run: npm run start"
echo "Login: admin / admin123"
echo "Finance password: admin123"
