#!/usr/bin/env bash
# Start MixDesign AI — backend + frontend
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== MixDesign AI — NS-EN 206 Concrete Mix Design ==="

# Python venv
if [ ! -d "$ROOT/.venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv "$ROOT/.venv"
fi

source "$ROOT/.venv/bin/activate"

# Install Python deps if needed
pip install -q -r "$ROOT/backend/requirements.txt"

# Train model if not present
if [ ! -f "$ROOT/ml/concrete_model.pkl" ]; then
  echo "Training ML model..."
  python "$ROOT/ml/train.py"
fi

# Start backend
echo "Starting FastAPI backend on http://localhost:8000 ..."
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Install frontend deps if needed
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

# Start frontend
echo "Starting React frontend on http://localhost:5173 ..."
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  Backend API : http://localhost:8000"
echo "  Frontend UI : http://localhost:5173"
echo "  API docs    : http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
