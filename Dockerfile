FROM python:3.10-slim
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY data/ /data/
ENV PORT=10000
EXPOSE 10000
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
